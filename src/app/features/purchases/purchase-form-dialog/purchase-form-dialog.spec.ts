import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { SupplierService } from '../../suppliers/data-access/supplier.service';
import { PurchasesService } from '../data-access/purchases.service';
import { Purchase, PurchaseRequest } from '../data-access/purchases.model';
import { PurchaseFormDialog } from './purchase-form-dialog';

describe('Formulario de compras', () => {
  async function setup() {
    const result = new Subject<Purchase>();
    const create = vi.fn((_request: PurchaseRequest) => result);
    const ref = { close: vi.fn(), disableClose: false };
    await TestBed.configureTestingModule({
      imports: [PurchaseFormDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: MatDialogRef, useValue: ref },
        {
          provide: SupplierService,
          useValue: {
            getSupplierOptions: () => of([{ id: 's1', name: 'Proveedor', document: null }]),
          },
        },
        {
          provide: PurchasesService,
          useValue: {
            create,
            catalog: () =>
              of([
                {
                  id: 'p1',
                  type: 'PRODUCT',
                  name: 'Copa',
                  unit: 'UNIT',
                  stock: 0,
                  averageUnitCost: null,
                  suggestedInitialCost: null,
                },
                {
                  id: 'i1',
                  type: 'SUPPLY',
                  name: 'Alcohol',
                  unit: 'LITER',
                  stock: 0,
                  averageUnitCost: null,
                  suggestedInitialCost: 20000,
                },
              ]),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PurchaseFormDialog);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['form'].patchValue({ supplierId: 's1', purchaseDateTime: '2026-01-01T10:00' });
    component['items'].at(0).setValue({ target: 'PRODUCT:p1', quantity: '10', unitCost: '10000' });
    return { fixture, component, result, create, ref };
  }
  it('crea un pedido mixto sin modificar stock, bloquea cierre y doble envío', async () => {
    const { component, create, ref } = await setup();
    component['addLine']();
    component['items'].at(1).setValue({ target: 'SUPPLY:i1', quantity: '0.5', unitCost: '20000' });
    component['submit']();
    component['submit']();
    component['close']();
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].items).toEqual([
      { productId: 'p1', supplyId: null, quantity: '10', unitCost: '10000' },
      { productId: null, supplyId: 'i1', quantity: '0.5', unitCost: '20000' },
    ]);
    expect(ref.disableClose).toBe(true);
    expect(ref.close).not.toHaveBeenCalled();
  });
  it('rechaza artículos duplicados y cantidades fraccionarias de productos', async () => {
    const { component, create } = await setup();
    component['items'].at(0).controls.quantity.setValue('0.5');
    component['submit']();
    expect(create).not.toHaveBeenCalled();
    component['items'].at(0).controls.quantity.setValue('1');
    component['addLine']();
    component['items'].at(1).setValue({ target: 'PRODUCT:p1', quantity: '1', unitCost: '10' });
    component['submit']();
    expect(create).not.toHaveBeenCalled();
  });
  it('conserva la clave y el borrador al reintentar un resultado desconocido', async () => {
    const { component, create, result, ref } = await setup();
    component['submit']();
    const first = create.mock.calls[0][0];
    result.error(new HttpErrorResponse({ status: 0 }));
    expect(ref.disableClose).toBe(false);
    component['form'].controls.notes.setValue('Datos diferentes');
    component['submit']();
    expect(create).toHaveBeenCalledOnce();
    component['form'].controls.notes.setValue('');
    component['submit']();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].requestId).toBe(first.requestId);
  });
});
