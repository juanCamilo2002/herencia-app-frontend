import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ProductFormDialog } from './product-form-dialog';
import { Product, CreateProductRequest, UpdateProductRequest } from '../data-access/product.model';
import { ProductService } from '../data-access/product.service';
import { ProductCategoryService } from '../../product-categories/data-access/product-category.service';

const product: Product = {
  id: 'p1',
  name: 'Vino reserva',
  categoryId: 'inactive-category',
  categoryName: 'Vinos',
  categoryActive: false,
  description: 'Una descripción',
  attributes: [
    { name: 'Cepa', value: 'Merlot' },
    { name: 'Añada', value: '2024' },
  ],
  price: 20,
  stock: 10,
  minimumStock: 2,
  active: true,
  createdAt: '',
  updatedAt: '',
};

describe('Formulario de producto general', () => {
  async function setup(existing?: Product) {
    const result = new Subject<Product>();
    const service = {
      createProduct: vi.fn((_request: CreateProductRequest) => result),
      updateProduct: vi.fn((_id: string, _request: UpdateProductRequest) => result),
    };
    const ref = { close: vi.fn(), disableClose: false };
    await TestBed.configureTestingModule({
      imports: [ProductFormDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: existing ? { product: existing } : null },
        { provide: MatDialogRef, useValue: ref },
        { provide: ProductService, useValue: service },
        { provide: ProductCategoryService, useValue: { options: () => of([]) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductFormDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, service, result, ref };
  }

  it('crea un accesorio sin categoría ni datos de vino, permitiendo céntimos', async () => {
    const { fixture, component, service } = await setup();
    component['form'].patchValue({ name: ' Sacacorchos ', price: 0.25, stock: 5, minimumStock: 1 });
    component['submit']();
    expect(service.createProduct).toHaveBeenCalledWith({
      name: 'Sacacorchos',
      categoryId: null,
      description: null,
      attributes: [],
      price: 0.25,
      stock: 5,
      minimumStock: 1,
    });
    expect(fixture.nativeElement.textContent).not.toContain('Registra un vino');
  });

  it('exige características completas y rechaza nombres repetidos ignorando espacios y mayúsculas', async () => {
    const { component, service } = await setup();
    component['form'].patchValue({ name: 'Sacacorchos', price: 20 });
    component['addAttribute']();
    component['submit']();
    expect(service.createProduct).not.toHaveBeenCalled();
    component['attributes'].at(0).setValue({ name: 'Color', value: 'Negro' });
    component['addAttribute']();
    component['attributes'].at(1).setValue({ name: ' color ', value: 'Azul' });
    component['submit']();
    expect(component['attributes'].hasError('duplicateNames')).toBe(true);
    expect(service.createProduct).not.toHaveBeenCalled();
    component['removeAttribute'](1);
    component['submit']();
    expect(service.createProduct).toHaveBeenCalledOnce();
  });

  it('mantiene la categoría inactiva y los datos migrados al editar sin enviar el stock', async () => {
    const { fixture, component, service } = await setup(product);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component['currentCategoryMissing']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('asignación actual');
    component['submit']();
    expect(service.updateProduct).toHaveBeenCalledWith('p1', {
      name: 'Vino reserva',
      categoryId: 'inactive-category',
      description: 'Una descripción',
      attributes: product.attributes,
      price: 20,
      minimumStock: 2,
      active: true,
    });
    expect(service.updateProduct.mock.calls[0][1]).not.toHaveProperty('stock');
  });

  it('bloquea cierre y doble envío, y conserva el borrador tras un error', async () => {
    const { component, service, ref, result } = await setup(product);
    component['submit']();
    component['submit']();
    component['close']();
    expect(service.updateProduct).toHaveBeenCalledOnce();
    expect(ref.disableClose).toBe(true);
    expect(ref.close).not.toHaveBeenCalled();
    result.error(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'An inactive category cannot be assigned to a product.' },
      }),
    );
    expect(component['form'].enabled).toBe(true);
    expect(component['form'].controls.name.value).toBe(product.name);
    expect(component['attributes'].getRawValue()).toEqual(product.attributes);
    expect(ref.disableClose).toBe(false);
  });

  it('limita la lista a veinte características y no acepta stock fraccionario', async () => {
    const { component } = await setup();
    for (let index = 0; index < 25; index++) component['addAttribute']();
    expect(component['attributes'].length).toBe(20);
    component['form'].controls.stock.setValue(0.5);
    expect(component['form'].controls.stock.invalid).toBe(true);
  });
});
