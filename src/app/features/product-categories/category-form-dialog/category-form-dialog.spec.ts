import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { CategoryFormDialog } from './category-form-dialog';
import { ProductCategory, ProductCategoryService } from '../data-access/product-category.service';

describe('Categorías de productos', () => {
  it('normaliza el nombre, bloquea guardado repetido y conserva el borrador ante duplicados', async () => {
    const response = new Subject<ProductCategory>();
    const create = vi.fn(() => response);
    const ref = { close: vi.fn(), disableClose: false };
    await TestBed.configureTestingModule({
      imports: [CategoryFormDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: MatDialogRef, useValue: ref },
        { provide: ProductCategoryService, useValue: { create } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CategoryFormDialog);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['form'].patchValue({ name: ' Accesorios ', description: '  Artículos  ' });
    component['submit']();
    component['submit']();
    component['close']();
    expect(create).toHaveBeenCalledExactlyOnceWith({
      name: 'Accesorios',
      description: 'Artículos',
    });
    expect(ref.disableClose).toBe(true);
    expect(ref.close).not.toHaveBeenCalled();
    response.error(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'A category with this name already exists.' },
      }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ya existe una categoría');
    expect(component['form'].controls.name.value).toBe(' Accesorios ');
    expect(ref.disableClose).toBe(false);
  });
});
