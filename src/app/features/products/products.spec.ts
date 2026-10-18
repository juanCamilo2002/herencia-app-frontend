import { TestBed } from '@angular/core/testing';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { Products } from './products';
import { ProductService } from './data-access/product.service';
import { ProductCategoryService } from '../product-categories/data-access/product-category.service';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ToastService } from '../../shared/services/toast.service';
import { Product } from './data-access/product.model';

describe('Filtros del catálogo general', () => {
  it('muestra descripción y características completas en un detalle de solo lectura', async () => {
    const product: Product = {
      id: 'p1',
      name: 'Sacacorchos',
      categoryId: null,
      categoryName: null,
      categoryActive: null,
      description: 'Descripción extensa\ncon todos sus detalles.',
      attributes: [{ name: 'Material', value: 'Acero inoxidable' }],
      price: 25,
      stock: 10,
      minimumStock: 2,
      active: true,
      createdAt: '',
      updatedAt: '',
    };
    const getProducts = vi.fn(() =>
      of({
        content: [product],
        totalElements: 1,
        page: 0,
        size: 20,
        totalPages: 1,
        first: true,
        last: true,
      }),
    );
    await TestBed.configureTestingModule({
      imports: [Products],
      providers: [
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
        {
          provide: ProductService,
          useValue: { getProducts, getSummary: () => of({ totalProducts: 1 }) },
        },
        { provide: ProductCategoryService, useValue: { options: () => of([]) } },
        { provide: AuthSessionService, useValue: { hasPermission: () => false } },
        { provide: ToastService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Products);
    fixture.detectChanges();
    fixture.componentInstance['openDetailDialog'](product);
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = document.querySelector<HTMLElement>('[role=dialog]')!;
    expect(overlay.querySelector('.product-detail__text')!.textContent).toBe(product.description);
    expect(overlay.textContent).toContain('Acero inoxidable');
    expect(overlay.textContent).not.toContain('Sin cepa');
    expect(getProducts).toHaveBeenCalledOnce();
    const dialog = TestBed.inject(MatDialog);
    const closed = firstValueFrom(dialog.openDialogs[0].afterClosed());
    overlay
      .querySelector<HTMLButtonElement>('button[aria-label="Cerrar detalle de producto"]')!
      .click();
    await closed;
  });
  it('aplica los filtros sin recargar estadísticas y separa borradores de la paginación', async () => {
    const getProducts = vi.fn(() => new Subject());
    const getSummary = vi.fn(() => of({ totalProducts: 10 }));
    await TestBed.configureTestingModule({
      imports: [Products],
      providers: [
        { provide: ProductService, useValue: { getProducts, getSummary } },
        { provide: ProductCategoryService, useValue: { options: () => of([]) } },
        { provide: MatDialog, useValue: {} },
        { provide: AuthSessionService, useValue: { hasPermission: () => false } },
        { provide: ToastService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Products);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['filtersForm'].setValue({ name: ' Sacacorchos ', category: 'uncategorized' });
    component['applyFilters']();
    expect(getProducts).toHaveBeenLastCalledWith(
      { page: 0, size: 20, sort: 'name,asc' },
      { name: 'Sacacorchos', categoryId: undefined, uncategorized: true },
    );
    component['filtersForm'].controls.name.setValue('Borrador');
    component['pageChanged']({ pageIndex: 1, pageSize: 20, length: 40 });
    expect(getProducts).toHaveBeenLastCalledWith(
      { page: 1, size: 20, sort: 'name,asc' },
      { name: 'Sacacorchos', categoryId: undefined, uncategorized: true },
    );
    component['clearFilters']();
    expect(getSummary).toHaveBeenCalledOnce();
  });
});
