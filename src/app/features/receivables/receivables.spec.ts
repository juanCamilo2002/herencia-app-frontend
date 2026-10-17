import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthSessionService } from '../../core/auth/auth-session.service';
import { PageResponse } from '../../shared/data-access/page.model';
import { ToastService } from '../../shared/services/toast.service';
import { Sale } from '../sales/data-access/sales.model';
import { SalesService } from '../sales/data-access/sales.service';
import { SaleDetailDialog } from '../sales/sale-detail-dialog/sale-detail-dialog';
import {
  Receivable,
  ReceivablePageRequest,
  ReceivableSummary,
} from './data-access/receivables.model';
import { ReceivablesService } from './data-access/receivables.service';
import { Receivables } from './receivables';

describe('Cartera', () => {
  const row: Receivable = {
    saleId: 'sale-1',
    customerId: 'customer-1',
    customerName: 'María Pérez',
    saleDateTime: '2026-10-15T14:07',
    paymentType: 'CASH',
    paymentStatus: 'PENDING',
    total: 100,
    paidAmount: 0,
    balanceAmount: 100,
    overdueAmount: 0,
    oldestPendingDueDate: '2026-11-15',
  };

  function makePage(pageIndex = 0, totalElements = 1): PageResponse<Receivable> {
    const size = 20;
    const remaining = Math.max(0, totalElements - pageIndex * size);
    const length = Math.min(size, remaining);
    const totalPages = Math.ceil(totalElements / size);

    return {
      content: Array.from({ length }, (_, index) => ({
        ...row,
        saleId: `sale-${pageIndex * size + index + 1}`,
      })),
      page: pageIndex,
      size,
      totalElements,
      totalPages,
      first: pageIndex === 0,
      last: pageIndex >= Math.max(0, totalPages - 1),
    };
  }

  function makeSummary(totalElements: number): ReceivableSummary {
    return {
      outstandingAmount: totalElements * 100,
      overdueAmount: 0,
      salesWithBalance: totalElements,
      overdueSales: 0,
    };
  }

  async function setup(canReadSales = true, totalElements = 1) {
    const listRequests: Subject<PageResponse<Receivable>>[] = [];
    const summaryRequests: Subject<ReceivableSummary>[] = [];
    const saleRequests: Subject<Sale>[] = [];

    const service = {
      getReceivables: vi.fn((_request: ReceivablePageRequest) => {
        const response = new Subject<PageResponse<Receivable>>();
        listRequests.push(response);
        return response;
      }),
      getSummary: vi.fn(() => {
        const response = new Subject<ReceivableSummary>();
        summaryRequests.push(response);
        return response;
      }),
    };

    const salesService = {
      getSale: vi.fn((_saleId: string) => {
        const response = new Subject<Sale>();
        saleRequests.push(response);
        return response;
      }),
    };

    const closed = new Subject<void>();
    const detail = { hasChanges: vi.fn(() => false) };

    const dialog = {
      open: vi.fn(() => ({
        componentInstance: detail,
        afterClosed: () => closed,
      })),
    };

    await TestBed.configureTestingModule({
      imports: [Receivables],
      providers: [
        { provide: ReceivablesService, useValue: service },
        { provide: SalesService, useValue: salesService },
        { provide: MatDialog, useValue: dialog },
        {
          provide: AuthSessionService,
          useValue: {
            hasPermission: (permission: string) =>
              permission === 'receivables:read' || (canReadSales && permission === 'sales:read'),
          },
        },
        {
          provide: ToastService,
          useValue: { error: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Receivables);
    fixture.detectChanges();

    listRequests[0].next(makePage(0, totalElements));
    listRequests[0].complete();

    summaryRequests[0].next(makeSummary(totalElements));
    summaryRequests[0].complete();

    fixture.detectChanges();

    return {
      fixture,
      component: fixture.componentInstance,
      service,
      salesService,
      dialog,
      detail,
      closed,
      listRequests,
      summaryRequests,
      saleRequests,
    };
  }

  it('pagina con los filtros aplicados y no con cambios pendientes del formulario', async () => {
    const { fixture, component, service, listRequests } = await setup(true, 41);

    component['filtersForm'].patchValue({
      customerName: '  María  ',
      paymentType: 'CASH',
      paymentStatus: 'PENDING',
    });

    component['applyFilters']();

    listRequests[1].next(makePage(0, 21));
    listRequests[1].complete();

    component['filtersForm'].controls.customerName.setValue('José');

    component['pageChanged']({
      pageIndex: 1,
      previousPageIndex: 0,
      pageSize: 20,
      length: 21,
    });

    fixture.detectChanges();

    expect(service.getReceivables).toHaveBeenLastCalledWith({
      page: 1,
      size: 20,
      customerName: 'María',
      paymentType: 'CASH',
      paymentStatus: 'PENDING',
    });

    expect(service.getSummary).toHaveBeenCalledTimes(1);

    expect(fixture.nativeElement.querySelector('#receivables-summary-title')).not.toBeNull();
  });

  it('permite consultar cartera sin conceder acceso al detalle de venta', async () => {
    const { fixture, component, salesService, dialog } = await setup(false);

    expect(component['displayedColumns']()).not.toContain('actions');

    expect(fixture.nativeElement.querySelector('.mat-column-actions')).toBeNull();

    const table: HTMLElement = fixture.nativeElement.querySelector('.receivables-table');

    expect(table.classList.contains('data-table--actions-end')).toBe(false);

    component['openSale'](row);

    expect(salesService.getSale).not.toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('cancela la lectura anterior para que una respuesta antigua no reemplace la nueva', async () => {
    const { fixture, component, listRequests } = await setup();

    component['filtersForm'].controls.customerName.setValue('Primero');
    component['applyFilters']();

    const previousRequest = listRequests[1];

    component['filtersForm'].controls.customerName.setValue('Segundo');
    component['applyFilters']();

    expect(previousRequest.observed).toBe(false);

    const latestPage = makePage();
    latestPage.content[0].customerName = 'Segundo';

    listRequests[2].next(latestPage);
    listRequests[2].complete();

    const oldPage = makePage();
    oldPage.content[0].customerName = 'Primero';

    previousRequest.next(oldPage);
    fixture.detectChanges();

    expect(component['rows']()[0].customerName).toBe('Segundo');
  });

  it('abre la venta completa y recupera la página anterior si desaparece la última deuda', async () => {
    const {
      fixture,
      component,
      service,
      salesService,
      dialog,
      detail,
      closed,
      listRequests,
      summaryRequests,
      saleRequests,
    } = await setup(true, 21);

    component['pageChanged']({
      pageIndex: 1,
      previousPageIndex: 0,
      pageSize: 20,
      length: 21,
    });

    listRequests[1].next(makePage(1, 21));
    listRequests[1].complete();

    const lastRow = component['rows']()[0];

    const fullSale: Sale = {
      id: lastRow.saleId,
      customerId: lastRow.customerId,
      customerName: lastRow.customerName || 'Cliente general',
      employeeId: null,
      employeeName: null,
      status: 'COMPLETED',
      total: 100,
      paymentType: 'CASH',
      paymentStatus: 'PENDING',
      paidAmount: 0,
      balanceAmount: 100,
      historical: false,
      saleDateTime: lastRow.saleDateTime,
      registeredById: 'user-1',
      registeredByName: 'Ana',
      createdAt: lastRow.saleDateTime,
      items: [],
    };

    component['openSale'](lastRow);

    expect(salesService.getSale).toHaveBeenCalledWith(lastRow.saleId);
    expect(dialog.open).not.toHaveBeenCalled();

    saleRequests[0].next(fullSale);
    saleRequests[0].complete();

    expect(dialog.open).toHaveBeenCalledWith(
      SaleDetailDialog,
      expect.objectContaining({ data: fullSale }),
    );

    detail.hasChanges.mockReturnValue(true);
    closed.next();
    closed.complete();

    expect(service.getSummary).toHaveBeenCalledTimes(2);

    // Después del pago solo quedan 20 ventas: la página 1 ya está vacía.
    listRequests[2].next(makePage(1, 20));

    expect(service.getReceivables).toHaveBeenLastCalledWith({
      page: 0,
      size: 20,
    });

    listRequests[3].next(makePage(0, 20));
    listRequests[3].complete();

    summaryRequests[1].next(makeSummary(20));
    summaryRequests[1].complete();

    fixture.detectChanges();

    expect(component['pageIndex']()).toBe(0);
    expect(component['rows']().length).toBe(20);
    expect(component['loading']()).toBe(false);
  });

  it('conserva el listado cuando falla una actualización del resumen', async () => {
    const { fixture, component, summaryRequests } = await setup();

    component['loadSummary']();

    summaryRequests[1].error(new Error('Summary unavailable'));
    fixture.detectChanges();

    expect(component['rows']().length).toBe(1);
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();

    expect(fixture.nativeElement.textContent).toContain(
      'No fue posible actualizar el resumen de cartera.',
    );
  });

  it('permite reintentar un listado fallido conservando sus filtros', async () => {
    const { fixture, component, service, listRequests } = await setup();

    component['filtersForm'].controls.customerName.setValue('María');
    component['applyFilters']();

    listRequests[1].error(new Error('List unavailable'));
    fixture.detectChanges();

    const retry = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Reintentar cartera');

    expect(retry).toBeDefined();

    retry!.click();

    expect(service.getReceivables).toHaveBeenLastCalledWith({
      page: 0,
      size: 20,
      customerName: 'María',
      paymentType: null,
      paymentStatus: null,
    });

    listRequests[2].next(makePage());
    listRequests[2].complete();

    fixture.detectChanges();

    expect(component['error']()).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
  });
});
