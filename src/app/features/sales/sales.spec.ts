import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { PageRequest, PageResponse } from '../../shared/data-access/page.model';
import { ToastService } from '../../shared/services/toast.service';
import { Sale, SaleSummary } from './data-access/sales.model';
import { SalesService } from './data-access/sales.service';
import { Sales } from './sales';

describe('Listado de ventas', () => {
  const sale: Sale = {
    id: 'sale-123456',
    customerId: 'customer-1',
    customerName: 'María Pérez',
    employeeId: null,
    employeeName: null,
    status: 'COMPLETED',
    total: 150.25,
    paymentType: 'CREDIT',
    paymentStatus: 'PARTIAL',
    paidAmount: 100,
    balanceAmount: 50.25,
    historical: false,
    saleDateTime: '2026-10-15T14:07',
    registeredById: 'user-1',
    registeredByName: 'Ana',
    createdAt: '2026-10-15T14:07',
    items: [],
  };
  const summary: SaleSummary = {
    totalSales: 40,
    totalRevenue: 6000,
    todaySales: 1,
    averageTicket: 150,
    collectedAmount: 4000,
    outstandingAmount: 2000,
    historicalPaidAmount: 0,
  };
  const page = (pageIndex: number): PageResponse<Sale> => ({
    content: [sale],
    page: pageIndex,
    size: 20,
    totalElements: 40,
    totalPages: 2,
    first: pageIndex === 0,
    last: pageIndex === 1,
  });

  async function setup() {
    const listRequests: Subject<PageResponse<Sale>>[] = [];
    const summaryRequest = new Subject<SaleSummary>();
    const service = {
      getSales: vi.fn((_request: PageRequest) => {
        const response = new Subject<PageResponse<Sale>>();
        listRequests.push(response);
        return response;
      }),
      getSummary: vi.fn(() => summaryRequest),
    };
    await TestBed.configureTestingModule({
      imports: [Sales],
      providers: [
        { provide: SalesService, useValue: service },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: AuthSessionService, useValue: { hasPermission: () => false } },
        { provide: ToastService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Sales);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, service, listRequests, summaryRequest };
  }

  it('presenta siete columnas financieras y una tarjeta móvil sin datos repetidos', async () => {
    const { fixture, listRequests, summaryRequest } = await setup();
    summaryRequest.next(summary);
    listRequests[0].next(page(0));
    fixture.detectChanges();

    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('table th') as NodeListOf<HTMLElement>,
    ).map((element) => element.textContent?.trim());
    expect(headers).toEqual([
      'Venta',
      'Cliente',
      'Modalidad',
      'Total',
      'Saldo pendiente',
      'Estado de pago',
      'Acciones',
    ]);
    expect(fixture.nativeElement.querySelector('.mat-column-sale small').textContent).toContain(
      '14:07',
    );
    expect(fixture.nativeElement.querySelector('td.mat-column-total').textContent).toMatch(
      /150[,.]25/,
    );
    expect(
      fixture.nativeElement.querySelector('td.mat-column-paymentStatus').textContent,
    ).toContain('Parcial');
    expect(fixture.nativeElement.querySelector('.sales-mobile__customer').textContent).toContain(
      'María Pérez',
    );
    expect(fixture.nativeElement.querySelectorAll('.sales-mobile .sales-list__date').length).toBe(
      1,
    );
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Ver detalle de venta SALE-123"]'),
    ).not.toBeNull();
  });

  it('mantiene métricas al paginar, bloquea el paginador y permite reintentar la página fallida', async () => {
    const { fixture, component, service, listRequests, summaryRequest } = await setup();
    summaryRequest.next(summary);
    listRequests[0].next(page(0));
    fixture.detectChanges();
    component['pageChanged']({ pageIndex: 1, previousPageIndex: 0, pageSize: 20, length: 40 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.data-stats')).not.toBeNull();
    expect(fixture.debugElement.query(By.directive(MatPaginator)).componentInstance.disabled).toBe(
      true,
    );
    expect(service.getSales).toHaveBeenLastCalledWith({
      page: 1,
      size: 20,
      sort: 'saleDateTime,desc',
    });
    listRequests[1].error(new Error('Sin conexión'));
    fixture.detectChanges();
    const retry = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Reintentar ventas');
    retry!.click();
    listRequests[2].next(page(1));
    fixture.detectChanges();

    expect(service.getSummary).toHaveBeenCalledTimes(1);
    expect(fixture.debugElement.query(By.directive(MatPaginator)).componentInstance.disabled).toBe(
      false,
    );
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
  });

  it('permite consultar las ventas aunque falle la consulta de métricas', async () => {
    const { fixture, listRequests, summaryRequest } = await setup();
    summaryRequest.error(new Error('Error de métricas'));
    listRequests[0].next(page(0));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No fue posible actualizar las métricas.');
  });

  it('muestra En mora con tono danger en la tabla y en la tarjeta móvil', async () => {
    const { fixture, listRequests, summaryRequest } = await setup();
    const overdueSale: Sale = { ...sale, paymentStatus: 'OVERDUE' };

    summaryRequest.next(summary);
    listRequests[0].next({ ...page(0), content: [overdueSale] });
    fixture.detectChanges();

    const tableStatus: HTMLElement = fixture.nativeElement.querySelector(
      'td.mat-column-paymentStatus app-status-badge',
    );
    const mobileStatus: HTMLElement = fixture.nativeElement.querySelector(
      '.sales-mobile__status app-status-badge',
    );

    expect(tableStatus.textContent?.trim()).toBe('En mora');
    expect(mobileStatus.textContent?.trim()).toBe('En mora');
    expect(tableStatus.querySelector('.status-badge--danger')).not.toBeNull();
    expect(mobileStatus.querySelector('.status-badge--danger')).not.toBeNull();
  });
});
