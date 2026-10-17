import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SalesService } from '../data-access/sales.service';
import { Sale, SaleInstallment, SalePayment } from '../data-access/sales.model';
import { SaleDetailDialog } from './sale-detail-dialog';

describe('Acciones financieras del detalle de venta', () => {
  const sale: Sale = {
    id: 'sale-1',
    customerId: 'customer-1',
    customerName: 'Cliente',
    employeeId: null,
    employeeName: null,
    status: 'COMPLETED',
    total: 150,
    paymentType: 'CREDIT',
    paymentStatus: 'PENDING',
    paidAmount: 0,
    balanceAmount: 150,
    historical: false,
    saleDateTime: '2026-10-14T14:07',
    registeredById: 'user-1',
    registeredByName: 'Ana',
    createdAt: '2026-10-14T14:07',
    items: [],
  };
  const payment: SalePayment = {
    id: 'payment-1',
    saleId: sale.id,
    amount: 120,
    method: 'CASH',
    paymentDateTime: '2026-10-14T14:07',
    notes: null,
    status: 'REGISTERED',
    registeredById: 'user-1',
    registeredByName: 'Ana',
    confirmedById: null,
    confirmedByName: null,
    confirmedAt: null,
    declinedById: null,
    declinedByName: null,
    declinedAt: null,
    declineReason: null,
    deletedById: null,
    deletedByName: null,
    deletedAt: null,
    deletionReason: null,
    createdAt: '2026-10-14T14:07',
    updatedAt: '2026-10-14T14:07',
  };

  async function setup(status: SalePayment['status'], allowed = true) {
    const page = <T>(content: T[]) => ({
      content,
      page: 0,
      size: 10,
      totalElements: content.length,
      totalPages: 1,
      first: true,
      last: true,
    });
    const confirmation = new Subject<SalePayment>();
    const service = {
      getSale: vi.fn(() => of(sale)),
      getInstallments: vi.fn(() => of([] as SaleInstallment[])),
      getPayments: vi.fn(() => of(page([{ ...payment, status }]))),
      getHistory: vi.fn(() => of(page([]))),
      deletePayment: vi.fn(() => of(payment)),
      confirmPayment: vi.fn(() => confirmation),
    };
    HTMLElement.prototype.scrollIntoView = vi.fn();
    await TestBed.configureTestingModule({
      imports: [SaleDetailDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: sale },
        { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
        { provide: SalesService, useValue: service },
        { provide: AuthSessionService, useValue: { hasPermission: () => allowed } },
        { provide: ToastService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SaleDetailDialog);
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const tabs = await loader.getHarness(MatTabGroupHarness);
    await tabs.selectTab({ label: 'Pagos' });
    const button = (label: string) =>
      Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((element) => element.textContent?.trim() === label);
    return { fixture, button, service, confirmation, tabs };
  }

  it('no ofrece edición, confirmación ni rechazo para pagos confirmados', async () => {
    const { button } = await setup('CONFIRM');
    expect(button('Editar')).toBeUndefined();
    expect(button('Confirmar')).toBeUndefined();
    expect(button('Rechazar')).toBeUndefined();
    expect(button('Eliminar')).toBeDefined();
  });

  it('oculta acciones financieras y notas sin los permisos correspondientes', async () => {
    const { fixture, button, tabs } = await setup('REGISTERED', false);
    for (const label of [
      'Registrar pago',
      'Editar',
      'Confirmar',
      'Rechazar',
      'Eliminar',
      'Agregar nota',
    ]) {
      expect(button(label)).toBeUndefined();
    }

    await tabs.selectTab({ label: 'Historial' });
    expect(button('Agregar nota')).toBeUndefined();
  });

  it('conserva el resumen y cierra el editor al cambiar de pestaña', async () => {
    const { fixture, button, tabs } = await setup('REGISTERED');
    button('Editar')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sale-detail__editor')).not.toBeNull();

    await tabs.selectTab({ label: 'Historial' });

    expect(fixture.nativeElement.querySelector('.sale-detail__editor')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sale-detail__sidebar').textContent).toContain(
      'Saldo pendiente',
    );
    expect(button('Agregar nota')).toBeDefined();
  });

  it('no solicita eliminar un pago sin motivo', async () => {
    const { fixture, button, service } = await setup('CONFIRM');
    button('Eliminar')!.click();
    fixture.detectChanges();
    button('Eliminar pago')!.click();
    fixture.detectChanges();
    expect(service.deletePayment).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Escribe un motivo');
  });

  it('bloquea envíos repetidos y recarga saldos e historial después de confirmar', async () => {
    const { fixture, button, service, confirmation, tabs } = await setup('REGISTERED');
    button('Confirmar')!.click();
    fixture.detectChanges();
    button('Confirmar pago')!.click();
    fixture.detectChanges();
    const savingButton = button('Guardando...')!;
    expect(savingButton.disabled).toBe(true);
    savingButton.click();
    expect(service.confirmPayment).toHaveBeenCalledTimes(1);
    confirmation.next({ ...payment, status: 'CONFIRM' });
    confirmation.complete();
    fixture.detectChanges();
    expect(service.getSale).toHaveBeenCalledTimes(2);
    expect(service.getInstallments).toHaveBeenCalledTimes(2);
    expect(service.getHistory).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.hasChanges()).toBe(true);
    expect(await (await tabs.getSelectedTab()).getLabel()).toBe('Pagos');
  });

  it('muestra la mora en el resumen y una sola etiqueta en la cuota, conservando los importes', async () => {
    const { fixture, service, tabs } = await setup('REGISTERED');
    const installment: SaleInstallment = {
      id: 'installment-1',
      installmentNumber: 1,
      dueDate: '2026-10-14',
      amount: 150,
      paidAmount: 50,
      balanceAmount: 100,
      status: 'OVERDUE',
      overdue: true,
    };

    service.getSale.mockReturnValue(
      of({ ...sale, paymentStatus: 'OVERDUE', paidAmount: 50, balanceAmount: 100 }),
    );
    service.getInstallments.mockReturnValue(of([installment]));
    fixture.componentInstance['load']();
    await tabs.selectTab({ label: 'Acuerdo de pago' });

    const article: HTMLElement = fixture.nativeElement.querySelector('.sale-detail__installment');
    const summaryStatus: HTMLElement = fixture.nativeElement.querySelector(
      '.sale-detail__sidebar app-status-badge',
    );

    expect(summaryStatus.textContent?.trim()).toBe('En mora');
    expect(summaryStatus.querySelector('.status-badge--danger')).not.toBeNull();
    expect(article.classList.contains('sale-detail__installment--overdue')).toBe(true);
    expect(article.querySelectorAll('app-status-badge').length).toBe(1);
    expect(article.querySelector('app-status-badge')?.textContent?.trim()).toBe('En mora');
    expect(article.querySelector('.status-badge--danger')).not.toBeNull();
    expect(article.textContent).not.toContain('Vencida');
    expect(fixture.componentInstance['installments']()[0].paidAmount).toBe(50);
    expect(fixture.componentInstance['installments']()[0].balanceAmount).toBe(100);
  });
});
