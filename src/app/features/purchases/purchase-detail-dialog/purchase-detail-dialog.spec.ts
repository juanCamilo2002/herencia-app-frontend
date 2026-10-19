import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Purchase, ReceiptPreview, ReceiptRequest } from '../data-access/purchases.model';
import { PurchasesService } from '../data-access/purchases.service';
import { PurchaseDetailDialog } from './purchase-detail-dialog';

describe('Recepción de compras', () => {
  const purchase: Purchase = {
    id: 'buy1',
    requestId: 'key1',
    version: 1,
    supplierId: 's1',
    supplierName: 'Proveedor',
    purchaseDateTime: '2026-01-01T10:00',
    reference: null,
    status: 'ORDERED',
    total: '10000.00',
    receivedAt: null,
    notes: null,
    createdByName: 'Ana',
    createdAt: '2026-01-01T10:00',
    orderedAt: '2026-01-01T10:00',
    receivedByName: null,
    cancelledAt: null,
    cancellationReason: null,
    items: [],
    history: [],
  };
  async function setup(cost: string | null = null, allowed = true) {
    const result = new Subject<Purchase>();
    const preview: ReceiptPreview = {
      version: 1,
      items: [
        {
          itemId: 'item1',
          itemName: 'Alcohol',
          itemUnit: 'LITER',
          currentStock: 2.5,
          averageUnitCost: cost,
          suggestedInitialCost: '20000.00',
          active: true,
          unitMatches: true,
        },
      ],
    };
    const receive = vi.fn((_id: string, _request: ReceiptRequest) => result);
    const ref = { close: vi.fn(), disableClose: false };
    await TestBed.configureTestingModule({
      imports: [PurchaseDetailDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: 'buy1' },
        { provide: MatDialogRef, useValue: ref },
        { provide: MatDialog, useValue: {} },
        {
          provide: PurchasesService,
          useValue: { get: () => of(purchase), preview: () => of(preview), receive },
        },
        {
          provide: AuthSessionService,
          useValue: {
            hasPermission: (permission: string) => allowed && permission === 'purchases:receive',
          },
        },
        { provide: ToastService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PurchaseDetailDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, result, receive, ref };
  }
  it('exige confirmar el costo desconocido y envía la cantidad de existencias consultada', async () => {
    const { component, receive, result, ref } = await setup();
    component['prepareReceipt']();
    component['receiptForm'].controls.receivedAt.setValue('2026-01-02T10:00');
    component['receive']();
    expect(receive).not.toHaveBeenCalled();
    expect(component['declarations'].at(0).controls.unitCost.value).toBe('');
    component['useReference'](0);
    component['receive']();
    component['receive']();
    component['close']();
    expect(receive).toHaveBeenCalledExactlyOnceWith('buy1', {
      version: 1,
      receivedAt: '2026-01-02T10:00',
      declarations: [{ itemId: 'item1', cost: { expectedStock: '2.5', unitCost: '20000.00' } }],
    });
    expect(ref.close).not.toHaveBeenCalled();
    expect(ref.disableClose).toBe(true);
    result.error(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Stock changed after the initial cost was declared.' },
      }),
    );
    expect(component['declarations'].at(0).controls.unitCost.value).toBe('20000.00');
    expect(ref.disableClose).toBe(false);
    expect(component['error']()).toContain('existencias cambiaron');
  });
  it('reconoce un promedio cero como conocido y no pide inicialización', async () => {
    const { component, receive } = await setup('0.000000');
    component['prepareReceipt']();
    expect(component['declarations'].length).toBe(0);
    component['receiptForm'].controls.receivedAt.setValue('2026-01-02T10:00');
    component['receive']();
    expect(receive.mock.calls[0][1].declarations).toEqual([]);
  });
  it('no permite preparar o ejecutar recepción con permisos de lectura', async () => {
    const { component, receive } = await setup(null, false);
    component['prepareReceipt']();
    component['receive']();
    expect(component['preview']()).toBeNull();
    expect(receive).not.toHaveBeenCalled();
  });
});
