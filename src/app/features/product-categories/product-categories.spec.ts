import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProductCategories } from './product-categories';
import { ProductCategoryService } from './data-access/product-category.service';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ToastService } from '../../shared/services/toast.service';

describe('Administración de categorías', () => {
  async function setup(write: boolean) {
    const row = {
      id: 'c1',
      name: 'Accesorios',
      description: 'Complementos',
      active: false,
      createdAt: '',
      updatedAt: '',
    };
    const setActive = vi.fn(() => of({ ...row, active: true }));
    const open = vi.fn(() => ({ afterClosed: () => of(true) }));
    await TestBed.configureTestingModule({
      imports: [ProductCategories],
      providers: [
        { provide: ProductCategoryService, useValue: { list: () => of([row]), setActive } },
        { provide: MatDialog, useValue: { open } },
        {
          provide: AuthSessionService,
          useValue: {
            hasPermission: (permission: string) => permission.endsWith(':read') || write,
          },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductCategories);
    fixture.detectChanges();
    return { fixture, row, setActive, open };
  }
  it('permite consultar categorías inactivas sin exponer acciones de escritura a lectura', async () => {
    const { fixture, open } = await setup(false);
    expect(fixture.nativeElement.textContent).toContain('Accesorios');
    expect(fixture.nativeElement.textContent).toContain('Inactiva');
    fixture.componentInstance['changeActive'](fixture.componentInstance['rows']()[0]);
    expect(open).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Nueva categoría');
  });
  it('reactiva una categoría con confirmación y actualiza su estado en el listado', async () => {
    const { fixture, row, setActive } = await setup(true);
    fixture.componentInstance['changeActive'](row);
    fixture.detectChanges();
    expect(setActive).toHaveBeenCalledExactlyOnceWith('c1', true);
    expect(fixture.componentInstance['rows']()[0].active).toBe(true);
  });
});
