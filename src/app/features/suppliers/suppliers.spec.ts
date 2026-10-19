import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { PageRequest, PageResponse } from '../../shared/data-access/page.model';
import { ToastService } from '../../shared/services/toast.service';
import { Supplier, SupplierFilters } from './data-access/supplier.model';
import { SupplierService } from './data-access/supplier.service';
import { Suppliers } from './suppliers';

describe('Listado de proveedores', () => {
  const supplier: Supplier = {
    id: 'supplier-1',
    name: 'Distribuidora Central',
    document: '900123456-7',
    phone: '3001234567',
    email: 'contacto@example.test',
    address: 'Calle 10 # 20-30',
    active: true,
    createdAt: '2026-10-18T09:00:00',
    updatedAt: '2026-10-18T09:00:00',
  };

  function page(
    pageIndex = 0,
    content: Supplier[] = [supplier],
    totalElements = 40,
  ): PageResponse<Supplier> {
    const totalPages = Math.ceil(totalElements / 20);

    return {
      content,
      page: pageIndex,
      size: 20,
      totalElements,
      totalPages,
      first: pageIndex === 0,
      last: pageIndex >= totalPages - 1,
    };
  }

  async function setup(
    permissions = ['suppliers:read', 'suppliers:create', 'suppliers:update', 'suppliers:disable'],
  ) {
    const listRequests: Subject<PageResponse<Supplier>>[] = [];
    const stateRequests: Subject<Supplier>[] = [];
    const dialogResults: Subject<boolean>[] = [];

    const service = {
      getSuppliers: vi.fn((_request: PageRequest, _filters: SupplierFilters) => {
        const response = new Subject<PageResponse<Supplier>>();

        listRequests.push(response);

        return response;
      }),
      setActive: vi.fn((_id: string, _active: boolean) => {
        const response = new Subject<Supplier>();

        stateRequests.push(response);

        return response;
      }),
    };

    const dialog = {
      open: vi.fn((_component: unknown, _config?: unknown) => {
        const result = new Subject<boolean>();

        dialogResults.push(result);

        return {
          afterClosed: () => result,
        };
      }),
    };

    const toast = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Suppliers],
      providers: [
        {
          provide: SupplierService,
          useValue: service,
        },
        {
          provide: MatDialog,
          useValue: dialog,
        },
        {
          provide: AuthSessionService,
          useValue: {
            hasPermission: (permission: string) => permissions.includes(permission),
          },
        },
        {
          provide: ToastService,
          useValue: toast,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Suppliers);

    fixture.detectChanges();

    function closeDialog(result: boolean) {
      const response = dialogResults.at(-1)!;

      response.next(result);
      response.complete();
    }

    function clickButton(label: string) {
      const buttons = fixture.nativeElement.querySelectorAll(
        'button',
      ) as NodeListOf<HTMLButtonElement>;

      const button = [...buttons].find((candidate) => candidate.textContent?.trim() === label);

      expect(button).toBeDefined();

      button!.click();
    }

    return {
      fixture,
      component: fixture.componentInstance,
      service,
      dialog,
      toast,
      listRequests,
      stateRequests,
      closeDialog,
      clickButton,
    };
  }

  it('separa filtros aplicados de borradores al paginar y ordenar', async () => {
    const { fixture, component, service, listRequests } = await setup();

    expect(service.getSuppliers).toHaveBeenLastCalledWith(
      {
        page: 0,
        size: 20,
        sort: 'name,asc',
      },
      { includeInactive: false },
    );

    listRequests[0].next(page());
    fixture.detectChanges();

    component['filtersForm'].setValue({
      name: '  Distribuidora  ',
      includeInactive: true,
    });

    component['applyFilters']();

    const appliedFilters = {
      name: 'Distribuidora',
      includeInactive: true,
    };

    expect(service.getSuppliers).toHaveBeenLastCalledWith(
      {
        page: 0,
        size: 20,
        sort: 'name,asc',
      },
      appliedFilters,
    );

    listRequests[1].next(page());
    fixture.detectChanges();

    component['filtersForm'].setValue({
      name: 'Borrador sin aplicar',
      includeInactive: false,
    });

    component['pageChanged']({
      pageIndex: 1,
      previousPageIndex: 0,
      pageSize: 20,
      length: 40,
    });

    expect(service.getSuppliers).toHaveBeenLastCalledWith(
      {
        page: 1,
        size: 20,
        sort: 'name,asc',
      },
      appliedFilters,
    );

    listRequests[2].next(page(1));
    fixture.detectChanges();

    component['sortSuppliers']({
      active: 'document',
      direction: 'desc',
    });

    expect(service.getSuppliers).toHaveBeenLastCalledWith(
      {
        page: 0,
        size: 20,
        sort: 'document,desc',
      },
      appliedFilters,
    );
  });

  it('cancela lecturas anteriores y se desuscribe al destruirse', async () => {
    const { fixture, component, listRequests } = await setup();

    component['loadSuppliers']();

    expect(listRequests[0].observed).toBe(false);
    expect(listRequests[1].observed).toBe(true);

    const currentSupplier: Supplier = {
      ...supplier,
      id: 'supplier-2',
      name: 'Respuesta actual',
    };

    listRequests[1].next(page(0, [currentSupplier], 1));

    listRequests[0].next(page(0, [supplier], 40));

    expect(component['suppliers']()).toEqual([currentSupplier]);
    expect(component['totalElements']()).toBe(1);

    fixture.destroy();

    expect(listRequests[1].observed).toBe(false);
  });

  it('reintenta un listado fallido conservando los filtros aplicados', async () => {
    const { fixture, component, service, listRequests, clickButton } = await setup();

    listRequests[0].next(page());
    fixture.detectChanges();

    component['filtersForm'].setValue({
      name: 'Central',
      includeInactive: true,
    });

    component['applyFilters']();

    listRequests[1].error(new Error('Sin conexión'));

    fixture.detectChanges();

    expect(component['loading']()).toBe(false);
    expect(component['error']()).not.toBeNull();

    clickButton('Reintentar listado');

    expect(service.getSuppliers).toHaveBeenLastCalledWith(
      {
        page: 0,
        size: 20,
        sort: 'name,asc',
      },
      {
        name: 'Central',
        includeInactive: true,
      },
    );

    listRequests[2].next(page());
    fixture.detectChanges();

    expect(component['error']()).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
  });

  it('no expone acciones de escritura a un usuario de solo lectura', async () => {
    const { fixture, component, dialog, service, listRequests } = await setup(['suppliers:read']);

    listRequests[0].next(page());
    fixture.detectChanges();

    expect(component['displayedColumns']()).not.toContain('actions');

    expect(fixture.nativeElement.textContent).not.toContain('Nuevo proveedor');

    component['openForm']();
    component['openForm'](supplier);
    component['changeActive'](supplier);

    expect(dialog.open).not.toHaveBeenCalled();
    expect(service.setActive).not.toHaveBeenCalled();

    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
  });

  it('no recarga al cancelar y vuelve a la primera página después de crear', async () => {
    const { fixture, component, service, dialog, listRequests, closeDialog } = await setup();

    listRequests[0].next(page());
    fixture.detectChanges();

    component['pageChanged']({
      pageIndex: 1,
      pageSize: 20,
      length: 40,
    });

    listRequests[1].next(page(1));
    fixture.detectChanges();

    component['openForm']();
    component['openForm']();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(component['busy']()).toBe(true);

    closeDialog(false);

    expect(component['busy']()).toBe(false);
    expect(service.getSuppliers).toHaveBeenCalledTimes(2);
    expect(component['pageIndex']()).toBe(1);

    component['openForm']();
    closeDialog(true);

    expect(service.getSuppliers).toHaveBeenCalledTimes(3);
    expect(service.getSuppliers).toHaveBeenLastCalledWith(
      {
        page: 0,
        size: 20,
        sort: 'name,asc',
      },
      { includeInactive: false },
    );
  });

  it('respeta cancelación, bloquea acciones simultáneas y conserva filas ante un error de estado', async () => {
    const { fixture, component, service, dialog, listRequests, stateRequests, closeDialog } =
      await setup();

    listRequests[0].next(page());
    fixture.detectChanges();

    component['changeActive'](supplier);
    component['changeActive'](supplier);

    expect(dialog.open).toHaveBeenCalledTimes(1);

    closeDialog(false);

    expect(service.setActive).not.toHaveBeenCalled();
    expect(service.getSuppliers).toHaveBeenCalledTimes(1);

    component['changeActive'](supplier);
    closeDialog(true);

    expect(component['busy']()).toBe(true);

    component['changeActive'](supplier);
    component['openForm'](supplier);
    component['pageChanged']({
      pageIndex: 1,
      pageSize: 20,
      length: 40,
    });

    expect(dialog.open).toHaveBeenCalledTimes(2);
    expect(service.setActive).toHaveBeenCalledTimes(1);
    expect(service.getSuppliers).toHaveBeenCalledTimes(1);

    stateRequests[0].error(new Error('No fue posible guardar'));

    fixture.detectChanges();

    expect(component['busy']()).toBe(false);
    expect(component['actionError']()).not.toBeNull();
    expect(component['suppliers']()).toEqual([supplier]);

    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
  });

  it('recupera la página anterior si una desactivación deja vacía la última', async () => {
    const { fixture, component, service, listRequests, stateRequests, closeDialog } = await setup();

    listRequests[0].next(page());
    fixture.detectChanges();

    component['pageChanged']({
      pageIndex: 1,
      pageSize: 20,
      length: 40,
    });

    listRequests[1].next(page(1));
    fixture.detectChanges();

    component['changeActive'](supplier);
    closeDialog(true);

    stateRequests[0].next({
      ...supplier,
      active: false,
    });

    // La recarga de la página 1 revela que solo queda una página.
    listRequests[2].next(page(1, [], 20));

    expect(component['pageIndex']()).toBe(0);
    expect(service.getSuppliers).toHaveBeenLastCalledWith(
      {
        page: 0,
        size: 20,
        sort: 'name,asc',
      },
      { includeInactive: false },
    );

    const remainingSupplier: Supplier = {
      ...supplier,
      id: 'supplier-2',
      name: 'Otro proveedor',
    };

    listRequests[3].next(page(0, [remainingSupplier], 20));

    fixture.detectChanges();

    expect(component['loading']()).toBe(false);
    expect(component['suppliers']()).toEqual([remainingSupplier]);
  });

  it.each([true, false])(
    'confirma el cambio desde active=%s y recarga el listado una vez',
    async (active) => {
      const { fixture, component, service, listRequests, stateRequests, closeDialog } =
        await setup();

      const current: Supplier = {
        ...supplier,
        active,
      };

      listRequests[0].next(page(0, [current]));
      fixture.detectChanges();

      component['changeActive'](current);
      closeDialog(true);

      expect(service.setActive).toHaveBeenCalledWith(current.id, !active);

      stateRequests[0].next({
        ...current,
        active: !active,
      });

      expect(component['busy']()).toBe(false);
      expect(service.getSuppliers).toHaveBeenCalledTimes(2);
    },
  );
});
