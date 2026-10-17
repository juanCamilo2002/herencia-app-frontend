import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { SalePayment } from '../../sales/data-access/sales.model';
import {
  PaymentAttachment,
  PaymentAttachmentsService,
} from '../data-access/payment-attachments.service';
import { PaymentAttachments } from './payment-attachments';

describe('Soportes del pago', () => {
  const attachment: PaymentAttachment = {
    id: 'attachment-1',
    saleId: 'sale-1',
    paymentId: 'payment-1',
    originalFilename: 'soporte.pdf',
    contentType: 'application/pdf',
    sizeBytes: 100,
    uploadedAt: '2026-10-17T09:00:00',
    uploadedByName: 'Ana',
    removedAt: null,
    removedByName: null,
    removalReason: null,
  };

  async function setup(status = 'REGISTERED', permission = true) {
    const result = new Subject<PaymentAttachment>();
    const service = {
      list: vi.fn(() => of([attachment])),
      upload: vi.fn(() => result),
      remove: vi.fn(() => result),
      download: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [PaymentAttachments],
      providers: [
        { provide: PaymentAttachmentsService, useValue: service },
        { provide: AuthSessionService, useValue: { hasPermission: () => permission } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PaymentAttachments);
    fixture.componentRef.setInput('payment', {
      id: 'payment-1',
      saleId: 'sale-1',
      status,
      deletedAt: null,
    } as SalePayment);
    fixture.detectChanges();
    const button = (text: string) =>
      [...(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)].find(
        (item) => (item.getAttribute('aria-label') ?? item.textContent?.trim()) === text,
      )!;
    const select = (file: File) => {
      const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, service, result, button, select };
  }

  it('consulta evidencia sin permisos de gestión y sin controles de carga', async () => {
    const { fixture, service } = await setup('REGISTERED', false);
    expect(service.list).toHaveBeenCalledWith('sale-1', 'payment-1');
    expect(fixture.nativeElement.textContent).toContain('soporte.pdf');
    expect(fixture.nativeElement.querySelector('input[type=file]')).toBeNull();
  });

  it('conserva la consulta en pagos confirmados', async () => {
    const { fixture, button } = await setup('CONFIRM');
    expect(button('Descargar')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[type=file]')).toBeNull();
  });

  it('rechaza archivos vacíos o con extensión no admitida', async () => {
    const { fixture, select, button, service } = await setup();
    select(new File([], 'vacio.pdf'));
    expect(button('Guardar soporte').disabled).toBe(true);
    select(new File(['html'], 'soporte.html'));
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'máximo 5 MB',
    );
    expect(service.upload).not.toHaveBeenCalled();
  });

  it('envía el ID esperado, bloquea doble envío y conserva el archivo ante error', async () => {
    const { fixture, select, button, service, result } = await setup();
    const busy: boolean[] = [];
    fixture.componentInstance.busyChange.subscribe((value) => busy.push(value));
    const file = new File(['%PDF-1.4'], 'nuevo.pdf');
    select(file);
    button('Guardar soporte').click();
    fixture.detectChanges();
    expect(service.upload).toHaveBeenCalledWith('sale-1', 'payment-1', file, 'attachment-1');
    expect(button('Procesando...').disabled).toBe(true);
    result.error(new Error('network'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('nuevo.pdf');
    expect(button('Guardar soporte').disabled).toBe(false);
    expect(busy).toEqual([true, false]);
  });

  it('exige motivo y conserva el borrador cuando falla la retirada', async () => {
    const { fixture, button, service, result } = await setup();
    button('Retirar soporte').click();
    fixture.detectChanges();
    button('Confirmar retirada').click();
    expect(service.remove).not.toHaveBeenCalled();
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Archivo incorrecto';
    textarea.dispatchEvent(new Event('input'));
    button('Confirmar retirada').click();
    result.error(new Error('network'));
    fixture.detectChanges();
    expect(service.remove).toHaveBeenCalledWith(
      'sale-1',
      'payment-1',
      'attachment-1',
      'Archivo incorrecto',
    );
    expect(textarea.value).toBe('Archivo incorrecto');
  });
});
