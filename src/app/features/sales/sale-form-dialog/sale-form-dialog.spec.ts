import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CustomerService } from '../../customers/data-access/customer.service';
import { EmployeeService } from '../../employees/data-access/employee.service';
import { ProductService } from '../../products/data-access/product.service';
import { CreateSaleRequest, Sale } from '../data-access/sales.model';
import { SalesService } from '../data-access/sales.service';
import { SaleFormDialog } from './sale-form-dialog';

describe('Creación de ventas', () => {
  async function setup(customPricePermission = true) {
    const result = new Subject<Sale>();
    const service = { createSale: vi.fn((_request: CreateSaleRequest) => result) };
    const dialog = { close: vi.fn(), disableClose: false };
    HTMLElement.prototype.scrollIntoView = vi.fn();

    await TestBed.configureTestingModule({
      imports: [SaleFormDialog],
      providers: [
        { provide: SalesService, useValue: service },
        { provide: MatDialogRef, useValue: dialog },
        { provide: AuthSessionService, useValue: { hasPermission: () => customPricePermission } },
        { provide: ToastService, useValue: { error: vi.fn() } },
        {
          provide: CustomerService,
          useValue: { getCustomerOptions: () => of([{ id: 'customer-1', name: 'Cliente' }]) },
        },
        {
          provide: EmployeeService,
          useValue: { getEmployeeOptions: () => of([{ id: 'employee-1', name: 'Ana' }]) },
        },
        {
          provide: ProductService,
          useValue: {
            getProductOptions: () =>
              of([{ id: 'product-1', name: 'Producto', price: 100, stock: 10 }]),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SaleFormDialog);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const form = component['form'];
    form.patchValue({
      employeeId: 'employee-1',
      saleDate: new Date(2026, 9, 14),
      saleTime: '14:07',
    });
    form.controls.items.at(0).patchValue({ productId: 'product-1', quantity: 3 });
    fixture.detectChanges();

    return { fixture, component, form, service, dialog, result };
  }

  it('requiere cliente en crédito y muestra nombre manual solo para contado sin cliente', async () => {
    const { fixture, form } = await setup();
    expect(
      fixture.nativeElement.querySelector('input[formControlName="customerName"]'),
    ).not.toBeNull();

    form.controls.customerName.setValue('a'.repeat(161));
    expect(form.controls.customerName.invalid).toBe(true);
    form.controls.paymentType.setValue('CREDIT');
    fixture.detectChanges();
    expect(form.controls.customerId.hasError('required')).toBe(true);
    expect(form.controls.customerName.valid).toBe(true);
    expect(fixture.nativeElement.querySelector('input[formControlName="customerName"]')).toBeNull();

    form.controls.customerId.setValue('customer-1');
    form.controls.paymentType.setValue('CASH');
    fixture.detectChanges();
    expect(form.controls.customerId.valid).toBe(true);
    expect(fixture.nativeElement.querySelector('input[formControlName="customerName"]')).toBeNull();
  });

  it('muestra cuánto falta o excede y rechaza un calendario desbalanceado', async () => {
    const { fixture, component, form, service } = await setup();
    form.patchValue({
      paymentType: 'CREDIT',
      customerId: 'customer-1',
      installmentCount: 4,
      firstInstallmentAmount: 60,
    });
    component['personalizeSchedule']();
    expect(component['scheduleTotal']()).toBe(300);
    expect(component['scheduleDifference']()).toBe(0);

    form.controls.installments.at(3).controls.amount.setValue(90);
    fixture.detectChanges();
    expect(component['scheduleDifference']()).toBe(-10);
    expect(fixture.nativeElement.textContent).toContain('Excede el total por');
    component['submit']();
    expect(service.createSale).not.toHaveBeenCalled();

    form.controls.installments.at(3).controls.amount.setValue(70);
    fixture.detectChanges();
    expect(component['scheduleDifference']()).toBe(10);
    expect(fixture.nativeElement.textContent).toContain('Falta distribuir');
  });

  it('envía solo el calendario personalizado y conserva la hora exacta', async () => {
    const { component, form, service } = await setup();
    form.patchValue({
      paymentType: 'CREDIT',
      customerId: 'customer-1',
      installmentCount: 4,
      firstInstallmentAmount: 60,
    });
    component['personalizeSchedule']();
    component['submit']();

    expect(service.createSale).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentType: 'CREDIT',
        customerId: 'customer-1',
        saleDateTime: '2026-10-14T14:07',
        installments: [
          { dueDate: '2026-10-14', amount: 60 },
          { dueDate: '2026-11-14', amount: 80 },
          { dueDate: '2026-12-14', amount: 80 },
          { dueDate: '2027-01-14', amount: 80 },
        ],
      }),
    );
    const request = service.createSale.mock.calls[0][0];
    expect(request.installmentCount).toBeUndefined();
    expect(request.firstInstallmentAmount).toBeUndefined();
  });

  it('impide doble envío y cierre, y conserva los datos tras un error del backend', async () => {
    const { component, form, service, dialog, result } = await setup();
    const original = form.getRawValue();
    component['submit']();
    component['submit']();
    component['close']();
    expect(service.createSale).toHaveBeenCalledTimes(1);
    expect(service.createSale.mock.calls[0][0].paymentType).toBe('CASH');
    expect(service.createSale.mock.calls[0][0].installments).toBeUndefined();
    expect(dialog.close).not.toHaveBeenCalled();
    expect(dialog.disableClose).toBe(true);
    expect(form.disabled).toBe(true);

    result.error(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Insufficient stock for product: Producto' },
      }),
    );
    expect(form.getRawValue()).toEqual(original);
    expect(form.enabled).toBe(true);
    expect(dialog.disableClose).toBe(false);
    expect(component['error']()).toContain('stock');
  });

  it('no bloquea por un precio personalizado oculto ni permite superar el stock', async () => {
    const { component, form, service } = await setup();
    const item = form.controls.items.at(0);
    item.patchValue({ useCustomPrice: true, customUnitPrice: -1 });
    expect(component['productValidationError'](0)).toContain('precio personalizado');
    item.controls.useCustomPrice.setValue(false);
    expect(component['productValidationError'](0)).toBeNull();
    item.controls.quantity.setValue(11);
    component['submit']();
    expect(component['productValidationError'](0)).toContain('Stock insuficiente');
    expect(service.createSale).not.toHaveBeenCalled();
  });

  it('marca y enfoca campos obligatorios al intentar registrar', async () => {
    const { fixture, component, form, service } = await setup();
    form.controls.employeeId.setValue('');
    component['submit']();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.controls.employeeId.touched).toBe(true);
    expect(service.createSale).not.toHaveBeenCalled();
    expect(document.activeElement?.getAttribute('formcontrolname')).toBe('employeeId');
  });
});
