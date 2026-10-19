import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { Supplier, SupplierRequest } from '../data-access/supplier.model';
import { SupplierService } from '../data-access/supplier.service';
import { SupplierFormDialog } from './supplier-form-dialog';

describe('Formulario de proveedores', () => {
  const supplier: Supplier = {
    id: 'supplier-1',
    name: 'Proveedor existente',
    document: '900123456-7',
    phone: null,
    email: 'contacto@example.test',
    address: null,
    active: false,
    createdAt: '2026-10-18T09:00:00',
    updatedAt: '2026-10-18T09:00:00',
  };

  async function setup(existing?: Supplier, initialDisableClose = false) {
    const result = new Subject<Supplier>();

    const service = {
      createSupplier: vi.fn((_request: SupplierRequest) => result),
      updateSupplier: vi.fn((_id: string, _request: SupplierRequest) => result),
    };

    const ref = {
      close: vi.fn(),
      disableClose: initialDisableClose,
    };

    await TestBed.configureTestingModule({
      imports: [SupplierFormDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: existing ? { supplier: existing } : null,
        },
        {
          provide: MatDialogRef,
          useValue: ref,
        },
        {
          provide: SupplierService,
          useValue: service,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SupplierFormDialog);

    fixture.detectChanges();

    return {
      fixture,
      component: fixture.componentInstance,
      service,
      ref,
      result,
    };
  }

  it('normaliza los datos y cierra indicando cambios después de crear', async () => {
    const { component, service, result, ref } = await setup();

    component['form'].setValue({
      name: '  Distribuidora Central  ',
      document: '  ',
      phone: '',
      email: '  contacto@example.test  ',
      address: '  Calle 10  ',
    });

    component['submit']();

    expect(service.createSupplier).toHaveBeenCalledWith({
      name: 'Distribuidora Central',
      document: null,
      phone: null,
      email: 'contacto@example.test',
      address: 'Calle 10',
    });

    expect(ref.close).not.toHaveBeenCalled();

    result.next({
      ...supplier,
      active: true,
    });

    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('edita un proveedor inactivo sin enviar cambios de estado', async () => {
    const { fixture, component, service } = await setup(supplier);

    expect(fixture.nativeElement.textContent).toContain('Editar sus datos no lo reactiva');

    component['form'].controls.phone.setValue('3001234567');

    component['submit']();

    expect(service.updateSupplier).toHaveBeenCalledWith(supplier.id, {
      name: supplier.name,
      document: supplier.document,
      phone: '3001234567',
      email: supplier.email,
      address: null,
    });

    const request = service.updateSupplier.mock.calls[0][1];

    expect(request).not.toHaveProperty('active');
    expect(service.createSupplier).not.toHaveBeenCalled();
  });

  it('rechaza nombres vacíos y correos inválidos antes de llamar al servicio', async () => {
    const { fixture, component, service } = await setup();

    component['form'].patchValue({
      name: '   ',
      email: 'invalid-email',
    });

    component['submit']();
    fixture.detectChanges();

    expect(component['form'].controls.name.invalid).toBe(true);
    expect(component['form'].controls.email.invalid).toBe(true);

    expect(service.createSupplier).not.toHaveBeenCalled();
    expect(service.updateSupplier).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'bloquea doble envío y cierre, conserva el borrador y restaura disableClose=%s ante error',
    async (initialDisableClose) => {
      const { component, service, ref, result } = await setup(supplier, initialDisableClose);

      component['form'].controls.phone.setValue('3001234567');

      component['submit']();
      component['submit']();
      component['close']();

      expect(service.updateSupplier).toHaveBeenCalledTimes(1);

      expect(component['form'].disabled).toBe(true);
      expect(ref.disableClose).toBe(true);
      expect(ref.close).not.toHaveBeenCalled();

      result.error(
        new HttpErrorResponse({
          status: 500,
          error: { message: 'Unexpected error' },
        }),
      );

      expect(component['saving']()).toBe(false);
      expect(component['form'].enabled).toBe(true);
      expect(ref.disableClose).toBe(initialDisableClose);

      expect(component['form'].controls.phone.value).toBe('3001234567');

      expect(component['form'].controls.name.value).toBe(supplier.name);

      expect(component['error']()).toContain('Tus datos se conservan');
    },
  );
});
