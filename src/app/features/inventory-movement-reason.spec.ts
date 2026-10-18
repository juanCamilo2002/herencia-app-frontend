import { ANIMATION_MODULE_TYPE, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../core/auth/auth-session.service';
import { ToastService } from '../shared/services/toast.service';
import { Inventory } from './inventory/inventory';
import { InventoryService } from './inventory/data-access/inventory.service';
import { StockMovement } from './inventory/data-access/inventory.model';
import { SupplyInventory } from './supply-inventory/supply-inventory';
import { SupplyInventoryService } from './supply-inventory/data-access/supply-inventory.service';
import { SupplyMovement } from './supply-inventory/data-access/supply-inventory.model';

const reason = `Revisión de existencias después del cierre.\n${'ReferenciaSinEspacios'.repeat(40)}\nSe conserva el detalle completo.`;
const common = {
  id: 'movement-1',
  type: 'OUTBOUND' as const,
  sourceType: 'MANUAL' as const,
  sourceId: null,
  movementDateTime: '2026-10-17T14:07:00',
  createdAt: '2026-10-17T14:08:00',
  reason,
};
const product: StockMovement = {
  ...common,
  productId: 'product-1',
  productName: 'Producto con un nombre descriptivo muy extenso',
  quantity: 25000,
  previousStock: 125000,
  newStock: 100000,
};
const supply: SupplyMovement = {
  ...common,
  supplyId: 'supply-1',
  supplyName: 'Insumo con un nombre descriptivo muy extenso',
  supplyUnit: 'LITER',
  quantity: 0.25,
  previousStock: 120000.125,
  newStock: 119999.875,
};

const modules: {
  name: string;
  component: Type<unknown>;
  service: Type<unknown>;
  movement: StockMovement | SupplyMovement;
}[] = [
  { name: 'Productos', component: Inventory, service: InventoryService, movement: product },
  {
    name: 'Insumos',
    component: SupplyInventory,
    service: SupplyInventoryService,
    movement: supply,
  },
];

for (const module of modules) {
  describe(`Consulta de motivos: ${module.name}`, () => {
    async function setup(movement = module.movement) {
      const getMovements = vi.fn(() =>
        of({
          content: [movement],
          totalElements: 1,
          page: 0,
          size: 20,
          totalPages: 1,
          first: true,
          last: true,
        }),
      );
      const getSummary = vi.fn(() => of({ totalMovements: 1 }));
      await TestBed.configureTestingModule({
        imports: [module.component],
        providers: [
          { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
          { provide: module.service, useValue: { getMovements, getSummary } },
          { provide: AuthSessionService, useValue: { hasPermission: () => false } },
          { provide: ToastService, useValue: {} },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(module.component);
      fixture.detectChanges();
      return { fixture, dialog: TestBed.inject(MatDialog), getMovements, getSummary };
    }

    it('permite leer el motivo completo desde tabla y móvil, sin volver a consultar datos', async () => {
      const { fixture, dialog, getMovements, getSummary } = await setup();
      for (const selector of ['.movement-table', '.data-mobile-list']) {
        const container = fixture.nativeElement.querySelector(selector) as HTMLElement;
        const button = container.querySelector<HTMLButtonElement>('.movement-reason__button')!;
        expect(button.getAttribute('aria-label')).toContain('Ver motivo del movimiento de');
        button.click();
        const ref = dialog.openDialogs.at(-1)!;
        fixture.detectChanges();
        const overlay = document.getElementById(ref.id)!;
        expect(overlay).not.toBeNull();
        expect(overlay.querySelector('.app-form-dialog__header h2')?.textContent).toBe(
          'Motivo del movimiento',
        );
        expect(overlay.querySelector('.movement-reason-dialog__text')?.textContent).toBe(reason);
        const closed = firstValueFrom(ref.afterClosed());
        overlay.querySelector<HTMLButtonElement>('button[aria-label="Cerrar motivo"]')!.click();
        fixture.detectChanges();
        await closed;
        expect(dialog.openDialogs.length).toBe(0);
      }
      expect(getMovements).toHaveBeenCalledTimes(1);
      expect(getSummary).toHaveBeenCalledTimes(1);
      const stock = fixture.nativeElement.querySelector('.mat-column-stock .movement-stock');
      expect(stock.textContent).toContain('Antes');
      expect(stock.textContent).toContain('Ahora');
      const date = fixture.nativeElement.querySelector('td.mat-column-movementDateTime');
      expect(date.querySelector('small').textContent).toBe('14:07');
    });

    it('muestra Sin motivo sin acción de consulta cuando no hay texto', async () => {
      const { fixture, dialog } = await setup({ ...module.movement, reason: null });
      expect(fixture.nativeElement.querySelector('td.mat-column-reason').textContent).toContain(
        'Sin motivo',
      );
      expect(fixture.nativeElement.querySelector('.movement-reason__button')).toBeNull();
      expect(dialog.openDialogs.length).toBe(0);
    });
  });
}
