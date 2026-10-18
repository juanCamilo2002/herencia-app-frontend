import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../core/auth/auth-session.service';
import { ToastService } from '../shared/services/toast.service';
import { Products } from './products/products';
import { ProductService } from './products/data-access/product.service';
import { Supplies } from './supplies/supplies';
import { SupplyService } from './supplies/data-access/supply.service';
import { Customers } from './customers/customers';
import { CustomerService } from './customers/data-access/customer.service';
import { Employees } from './employees/employees';
import { EmployeeService } from './employees/data-access/employee.service';
import { Users } from './users/users';
import { UserService } from './users/data-access/user.service';
import { Inventory } from './inventory/inventory';
import { InventoryService } from './inventory/data-access/inventory.service';
import { SupplyInventory } from './supply-inventory/supply-inventory';
import { SupplyInventoryService } from './supply-inventory/data-access/supply-inventory.service';
import { Productions } from './productions/productions';
import { ProductionService } from './productions/data-access/production.service';
import { Roles } from './roles/roles';
import { RoleService } from './roles/data-access/role.service';

const modules: {
  name: string;
  component: Type<unknown>;
  service: Type<unknown>;
  list: string;
  load: string;
  sort?: string;
  create: string;
  total: string;
}[] = [
  {
    name: 'Productos',
    component: Products,
    service: ProductService,
    list: 'getProducts',
    load: 'loadProducts',
    sort: 'sortProducts',
    create: 'openCreateProductDialog',
    total: 'totalProducts',
  },
  {
    name: 'Insumos',
    component: Supplies,
    service: SupplyService,
    list: 'getSupplies',
    load: 'loadSupplies',
    sort: 'sortSupplies',
    create: 'openCreateSupplyDialog',
    total: 'totalSupplies',
  },
  {
    name: 'Clientes',
    component: Customers,
    service: CustomerService,
    list: 'getCustomers',
    load: 'loadCustomers',
    sort: 'sortCustomers',
    create: 'openCreateCustomerDialog',
    total: 'totalCustomers',
  },
  {
    name: 'Empleados',
    component: Employees,
    service: EmployeeService,
    list: 'getEmployees',
    load: 'loadEmployees',
    sort: 'sortEmployees',
    create: 'openCreateEmployeeDialog',
    total: 'totalEmployees',
  },
  {
    name: 'Usuarios',
    component: Users,
    service: UserService,
    list: 'getUsers',
    load: 'loadUsers',
    sort: 'sortUsers',
    create: 'openCreateUserDialog',
    total: 'totalUsers',
  },
  {
    name: 'Inventario',
    component: Inventory,
    service: InventoryService,
    list: 'getMovements',
    load: 'loadMovements',
    create: 'openCreateMovementDialog',
    total: 'totalMovements',
  },
  {
    name: 'Inventario de insumos',
    component: SupplyInventory,
    service: SupplyInventoryService,
    list: 'getMovements',
    load: 'loadMovements',
    create: 'openCreateMovementDialog',
    total: 'totalMovements',
  },
  {
    name: 'Producciones',
    component: Productions,
    service: ProductionService,
    list: 'getProductions',
    load: 'loadProductions',
    create: 'openCreateProductionDialog',
    total: 'totalProductions',
  },
];

const page = {
  content: [],
  totalElements: 40,
  page: 0,
  size: 20,
  totalPages: 2,
  first: true,
  last: false,
};

for (const module of modules) {
  describe(`Estadísticas independientes: ${module.name}`, () => {
    async function setup() {
      const lists: Subject<typeof page>[] = [];
      const summaries: Subject<Record<string, number>>[] = [];
      const closed = new Subject<boolean>();
      const list = vi.fn(() => {
        const request = new Subject<typeof page>();
        lists.push(request);
        return request;
      });
      const getSummary = vi.fn(() => {
        const request = new Subject<Record<string, number>>();
        summaries.push(request);
        return request;
      });
      await TestBed.configureTestingModule({
        imports: [module.component],
        providers: [
          { provide: module.service, useValue: { [module.list]: list, getSummary } },
          { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => closed }) } },
          { provide: AuthSessionService, useValue: { hasPermission: () => false } },
          { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(module.component);
      fixture.detectChanges();
      const invoke = (name: string, ...args: unknown[]) => {
        const component = fixture.componentInstance as object;
        const method = Reflect.get(component, name) as (...args: unknown[]) => void;
        method.apply(component, args);
      };
      const click = (label: string) => {
        const buttons = fixture.nativeElement.querySelectorAll(
          'button',
        ) as NodeListOf<HTMLButtonElement>;
        [...buttons].find((button) => button.textContent?.trim() === label)!.click();
      };
      return { fixture, invoke, click, list, getSummary, lists, summaries, closed };
    }

    it('muestra métricas antes del listado y conserva los mismos nodos al paginar y ordenar', async () => {
      const { fixture, summaries, lists, invoke, getSummary } = await setup();
      expect(fixture.nativeElement.querySelector('app-metric-card')).toBeNull();
      summaries[0].next({ [module.total]: 41 });
      fixture.detectChanges();
      const metric = fixture.nativeElement.querySelector('app-metric-card');
      expect(metric.textContent).toContain('41');
      lists[0].next(page);
      fixture.detectChanges();
      invoke('pageChanged', { pageIndex: 1, pageSize: 20, length: 40 });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
      if (module.sort) {
        invoke(module.sort, { active: 'name', direction: 'desc' });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
      }
      expect(getSummary).toHaveBeenCalledTimes(1);
    });

    it('permite usar el listado y reintentar solo las estadísticas cuando fallan', async () => {
      const { fixture, summaries, lists, click, list } = await setup();
      lists[0].next(page);
      summaries[0].error(new Error('summary failed'));
      fixture.detectChanges();
      const listNode = fixture.nativeElement.querySelector('.empty-state');
      expect(listNode).not.toBeNull();
      click('Reintentar estadísticas');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBe(listNode);
      expect(list).toHaveBeenCalledTimes(1);
      summaries[1].next({ [module.total]: 41 });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-metric-card').textContent).toContain('41');
    });

    it('conserva métricas al fallar y reintentar solo el listado', async () => {
      const { fixture, summaries, lists, click, getSummary } = await setup();
      summaries[0].next({ [module.total]: 41 });
      fixture.detectChanges();
      const metric = fixture.nativeElement.querySelector('app-metric-card');
      lists[0].error(new Error('list failed'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
      click('Reintentar listado');
      lists[1].next(page);
      fixture.detectChanges();
      expect(getSummary).toHaveBeenCalledTimes(1);
      expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
    });

    it('cancela lecturas anteriores y mantiene el último resumen visible durante su actualización', async () => {
      const { fixture, summaries, lists, invoke } = await setup();
      summaries[0].next({ [module.total]: 41 });
      fixture.detectChanges();
      const metric = fixture.nativeElement.querySelector('app-metric-card');
      invoke('loadSummary');
      invoke(module.load);
      expect(summaries[0].observed).toBe(false);
      expect(lists[0].observed).toBe(false);
      summaries[0].next({ [module.total]: 999 });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
      expect(metric.textContent).toContain('41');
      summaries[1].error(new Error('refresh failed'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
      fixture.destroy();
      expect(lists[1].observed).toBe(false);
    });

    it('actualiza listado y resumen una vez después de guardar, sin hacerlo al cancelar', async () => {
      const { invoke, closed, list, getSummary } = await setup();
      invoke(module.create);
      closed.next(false);
      expect(list).toHaveBeenCalledTimes(1);
      expect(getSummary).toHaveBeenCalledTimes(1);
      closed.next(true);
      expect(list).toHaveBeenCalledTimes(2);
      expect(getSummary).toHaveBeenCalledTimes(2);
    });
  });
}

describe('Estadísticas de Roles', () => {
  it('conserva las tarjetas después de una carga vacía, durante recarga y error', async () => {
    const requests: Subject<unknown[]>[] = [];
    await TestBed.configureTestingModule({
      imports: [Roles],
      providers: [
        {
          provide: RoleService,
          useValue: {
            getRoles: () => {
              const request = new Subject<unknown[]>();
              requests.push(request);
              return request;
            },
          },
        },
        { provide: MatDialog, useValue: {} },
        { provide: AuthSessionService, useValue: { hasPermission: () => false } },
        { provide: ToastService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Roles);
    fixture.detectChanges();
    requests[0].next([]);
    fixture.detectChanges();
    const metric = fixture.nativeElement.querySelector('app-metric-card');
    expect(metric).not.toBeNull();
    fixture.componentInstance['loadRoles']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
    requests[1].error(new Error('failed'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
  });
});
