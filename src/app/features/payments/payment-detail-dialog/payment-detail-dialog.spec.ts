import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SalePayment } from '../../sales/data-access/sales.model';
import { SalesService } from '../../sales/data-access/sales.service';
import { PaymentsService } from '../data-access/payments.service';
import { PaymentDetailDialog } from './payment-detail-dialog';

describe('Gestión global de un pago', () => {
  const payment: SalePayment = {
    id: 'payment-1',
    saleId: 'sale-1',
    amount: 120,
    method: 'CASH',
    paymentDateTime: '2026-10-15T14:07:00',
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
    createdAt: '2026-10-15T14:10:00',
    updatedAt: '2026-10-15T14:10:00',
  };

  async function setup(overrides: Partial<SalePayment> = {}, readOnly = false) {
    const current: SalePayment = { ...payment, ...overrides };
    const permissions = new Set(
      readOnly
        ? ['payments:read']
        : [
            'payments:read',
            'sales:update-payment',
            'sales:confirm-payment',
            'sales:decline-payment',
            'sales:delete-payment',
          ],
    );
    const result = new Subject<SalePayment>();
    const reads = { getPayment: vi.fn((_id: string): Observable<SalePayment> => of(current)) };
    const writes = {
      updatePayment: vi.fn((): Observable<SalePayment> => result),
      confirmPayment: vi.fn((): Observable<SalePayment> => result),
      declinePayment: vi.fn((): Observable<SalePayment> => result),
      deletePayment: vi.fn((): Observable<SalePayment> => result),
      getSale: vi.fn(),
    };
    const ref = { close: vi.fn(), disableClose: false };
    HTMLElement.prototype.scrollIntoView = vi.fn();
    await TestBed.configureTestingModule({
      imports: [PaymentDetailDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { paymentId: payment.id, customerName: 'María' } },
        { provide: MatDialogRef, useValue: ref },
        { provide: PaymentsService, useValue: reads },
        { provide: SalesService, useValue: writes },
        {
          provide: AuthSessionService,
          useValue: { hasPermission: (key: string) => permissions.has(key) },
        },
        { provide: ToastService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PaymentDetailDialog);
    fixture.detectChanges();
    const button = (label: string) =>
      Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((element) => element.textContent?.trim() === label);
    return {
      fixture,
      component: fixture.componentInstance,
      reads,
      writes,
      ref,
      result,
      permissions,
      button,
      current,
    };
  }

  it('consulta por payments:read y no ofrece modificaciones sin sus permisos', async () => {
    const { button, reads, writes, component } = await setup({}, true);
    expect(reads.getPayment).toHaveBeenCalledWith(payment.id);
    for (const label of ['Editar', 'Confirmar', 'Rechazar', 'Eliminar']) {
      expect(button(label)).toBeUndefined();
    }
    component['openAction']('confirm');
    expect(component['action']()).toBeNull();
    expect(writes.confirmPayment).not.toHaveBeenCalled();
    expect(writes.getSale).not.toHaveBeenCalled();
  });

  it.each(['CONFIRM', 'DECLINE'] as const)(
    'protege los datos definitivos de un pago %s',
    async (status) => {
      const { button, component, writes } = await setup({ status });
      expect(button('Editar')).toBeUndefined();
      expect(button('Confirmar')).toBeUndefined();
      expect(button('Rechazar')).toBeUndefined();
      expect(button('Eliminar')).toBeDefined();
      component['openAction']('update');
      expect(component['action']()).toBeNull();
      expect(writes.updatePayment).not.toHaveBeenCalled();
    },
  );

  it('muestra el estado original de un eliminado y bloquea toda modificación', async () => {
    const { fixture, button, component } = await setup({
      status: 'CONFIRM',
      deletedAt: '2026-10-16T10:00:00',
      deletionReason: 'Pago duplicado.',
    });
    expect(fixture.nativeElement.textContent).toContain('Confirmado');
    expect(fixture.nativeElement.textContent).toContain('Eliminado');
    for (const label of ['Editar', 'Confirmar', 'Rechazar', 'Eliminar']) {
      expect(button(label)).toBeUndefined();
    }
    component['openAction']('delete');
    expect(component['action']()).toBeNull();
  });

  it('conserva el borrador ante un error y permite corregir y reintentar', async () => {
    const { component, writes, result, current, ref } = await setup();
    component['openAction']('update');
    const draft = {
      amount: 120.25,
      method: 'BANK_TRANSFER' as const,
      paymentDateTime: '2026-10-15T14:07',
      notes: '  Borrador  ',
    };
    component['paymentForm'].setValue(draft);
    component['submitAction']();
    expect(writes.updatePayment).toHaveBeenCalledWith('sale-1', 'payment-1', {
      ...draft,
      notes: 'Borrador',
    });
    result.error(
      new HttpErrorResponse({ status: 400, error: { message: 'Payment validation failed.' } }),
    );
    expect(component['paymentForm'].getRawValue()).toEqual(draft);
    expect(component['paymentForm'].enabled).toBe(true);
    expect(component['actionError']()).toBe('Payment validation failed.');
    expect(component.hasChanges()).toBe(false);
    expect(ref.disableClose).toBe(false);
    writes.updatePayment.mockReturnValueOnce(of({ ...current, ...draft, notes: 'Borrador' }));
    component['submitAction']();
    expect(component['payment']()?.amount).toBe(120.25);
    expect(component.hasChanges()).toBe(true);
  });

  it('impide doble confirmación, actualización y cierre mientras se procesa', async () => {
    const { fixture, component, writes, reads, result, ref, current, button } = await setup();
    button('Confirmar')!.click();
    fixture.detectChanges();
    button('Confirmar pago')!.click();
    fixture.detectChanges();
    component['submitAction']();
    component['cancelAction']();
    component['close']();
    component['load']();
    expect(writes.confirmPayment).toHaveBeenCalledTimes(1);
    expect(reads.getPayment).toHaveBeenCalledTimes(1);
    expect(ref.close).not.toHaveBeenCalled();
    expect(ref.disableClose).toBe(true);
    expect(component['paymentForm'].disabled).toBe(true);
    result.next({ ...current, status: 'CONFIRM' });
    result.complete();
    fixture.detectChanges();
    expect(component.hasChanges()).toBe(true);
    expect(ref.disableClose).toBe(false);
    expect(button('Confirmar')).toBeUndefined();
    component['close']();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it.each(['decline', 'delete'] as const)(
    'exige y normaliza el motivo al ejecutar %s',
    async (action) => {
      const { component, writes, result, current } = await setup();
      const operation = action === 'decline' ? writes.declinePayment : writes.deletePayment;
      component['openAction'](action);
      component['reason'].setValue('   ');
      component['submitAction']();
      expect(operation).not.toHaveBeenCalled();
      component['reason'].setValue('a'.repeat(1001));
      component['submitAction']();
      expect(operation).not.toHaveBeenCalled();
      component['reason'].setValue('  Corrección de registro.  ');
      component['submitAction']();
      expect(operation).toHaveBeenCalledWith('sale-1', 'payment-1', 'Corrección de registro.');
      result.next(
        action === 'decline'
          ? { ...current, status: 'DECLINE' }
          : { ...current, deletedAt: '2026-10-16T10:00:00' },
      );
      expect(component.hasChanges()).toBe(true);
    },
  );

  it('rechaza importes con exceso de precisión y fechas vacías antes del envío', async () => {
    const { component, writes } = await setup();
    component['openAction']('update');
    component['paymentForm'].controls.amount.setValue(12.345);
    component['submitAction']();
    expect(component['paymentForm'].controls.amount.invalid).toBe(true);
    expect(writes.updatePayment).not.toHaveBeenCalled();
    component['paymentForm'].patchValue({ amount: 12.34, paymentDateTime: '' });
    component['submitAction']();
    expect(writes.updatePayment).not.toHaveBeenCalled();
  });

  it('revisa el permiso nuevamente antes de enviar una acción abierta', async () => {
    const { component, permissions, writes } = await setup();
    component['openAction']('confirm');
    permissions.delete('sales:confirm-payment');
    component['submitAction']();
    expect(writes.confirmPayment).not.toHaveBeenCalled();
    expect(component['actionError']()).toContain('ya no está disponible');
  });

  it('permite reintentar la lectura global después de un fallo', async () => {
    const { fixture, component, reads } = await setup();
    reads.getPayment.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    component['load']();
    fixture.detectChanges();
    expect(component['loadError']()).not.toBeNull();
    component['load']();
    fixture.detectChanges();
    expect(component['loadError']()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Registrado');
  });
});
