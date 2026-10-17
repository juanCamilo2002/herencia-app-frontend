import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { PageResponse } from '../../shared/data-access/page.model';
import { ToastService } from '../../shared/services/toast.service';
import { Sale } from '../sales/data-access/sales.model';
import { SalesService } from '../sales/data-access/sales.service';
import { SaleDetailDialog } from '../sales/sale-detail-dialog/sale-detail-dialog';
import { PaymentListItem, PaymentPageRequest } from './data-access/payments.model';
import { PaymentsService } from './data-access/payments.service';
import { PaymentDetailDialog } from './payment-detail-dialog/payment-detail-dialog';
import { Payments } from './payments';

describe('Pagos generales', () => {
  const row: PaymentListItem = {
    id: 'payment-1',
    saleId: 'sale-1',
    customerId: 'customer-1',
    customerName: 'María',
    amount: 120,
    method: 'BANK_TRANSFER',
    status: 'REGISTERED',
    paymentDateTime: '2026-10-15T14:07:00',
    registeredByName: 'Ana',
    deletedAt: null,
  };
  const fullSale: Sale = {
    id: row.saleId,
    customerId: row.customerId,
    customerName: 'María',
    employeeId: null,
    employeeName: null,
    status: 'COMPLETED',
    total: 300,
    paymentType: 'CREDIT',
    paymentStatus: 'PARTIAL',
    paidAmount: 120,
    balanceAmount: 180,
    historical: false,
    saleDateTime: '2026-10-14T10:00:00',
    registeredById: 'user-1',
    registeredByName: 'Ana',
    createdAt: '2026-10-14T10:00:00',
    items: [],
  };

  function makePage(index = 0, total = 1): PageResponse<PaymentListItem> {
    const size = 20;
    const length = Math.min(size, Math.max(0, total - index * size));
    const totalPages = Math.ceil(total / size);
    return {
      content: Array.from({ length }, (_, offset) => ({
        ...row,
        id: `payment-${index * size + offset + 1}`,
      })),
      page: index,
      size,
      totalElements: total,
      totalPages,
      first: index === 0,
      last: index >= Math.max(0, totalPages - 1),
    };
  }

  async function setup(canReadSales = false, total = 1) {
    const requests: Subject<PageResponse<PaymentListItem>>[] = [];
    const saleRequests: Subject<Sale>[] = [];
    const service = {
      getPayments: vi.fn((_request: PaymentPageRequest) => {
        const response = new Subject<PageResponse<PaymentListItem>>();
        requests.push(response);
        return response;
      }),
    };
    const sales = {
      getSale: vi.fn((_id: string): Observable<Sale> => {
        const response = new Subject<Sale>();
        saleRequests.push(response);
        return response;
      }),
    };
    const closed = new Subject<void>();
    const detail = { hasChanges: vi.fn(() => false) };
    const dialog = {
      open: vi.fn(() => ({ componentInstance: detail, afterClosed: () => closed })),
    };
    const toast = { error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: [
        { provide: PaymentsService, useValue: service },
        { provide: SalesService, useValue: sales },
        { provide: MatDialog, useValue: dialog },
        {
          provide: AuthSessionService,
          useValue: {
            hasPermission: (key: string) =>
              key === 'payments:read' || (canReadSales && key === 'sales:read'),
          },
        },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Payments);
    fixture.detectChanges();
    requests[0].next(makePage(0, total));
    requests[0].complete();
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      service,
      sales,
      dialog,
      toast,
      requests,
      saleRequests,
      closed,
      detail,
    };
  }

  it('pagina con filtros aplicados y conserva la fecha final sin transformarla', async () => {
    const { component, service, requests } = await setup(false, 41);
    component['filtersForm'].patchValue({
      customerName: '  María  ',
      paymentStatus: 'REGISTERED',
      paymentMethod: 'BANK_TRANSFER',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-15',
      includeDeleted: true,
    });
    component['applyFilters']();
    requests[1].next(makePage(0, 21));
    requests[1].complete();
    component['filtersForm'].patchValue({ customerName: 'José', includeDeleted: false });
    component['pageChanged']({ pageIndex: 1, previousPageIndex: 0, pageSize: 20, length: 21 });
    expect(service.getPayments).toHaveBeenLastCalledWith({
      page: 1,
      size: 20,
      customerName: 'María',
      paymentStatus: 'REGISTERED',
      paymentMethod: 'BANK_TRANSFER',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-15',
      includeDeleted: true,
    });
  });

  it('rechaza rangos invertidos, fechas inexistentes y nombres demasiado largos', async () => {
    const { component, service, fixture } = await setup();
    const form = component['filtersForm'];
    form.patchValue({ dateFrom: '2026-10-16', dateTo: '2026-10-15' });
    component['applyFilters']();
    fixture.detectChanges();
    expect(form.hasError('dateRange')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('no puede ser posterior');
    form.patchValue({ dateFrom: '2026-02-30', dateTo: '' });
    component['applyFilters']();
    expect(form.controls.dateFrom.invalid).toBe(true);
    form.patchValue({ dateFrom: '', customerName: 'a'.repeat(161) });
    component['applyFilters']();
    expect(form.controls.customerName.touched).toBe(true);
    expect(service.getPayments).toHaveBeenCalledTimes(1);
  });

  it('abre el pago con payments:read pero no obtiene la venta sin sales:read', async () => {
    const { component, fixture, sales, dialog, closed, service } = await setup();
    expect(fixture.nativeElement.querySelector('button[aria-label^="Ver venta"]')).toBeNull();
    component['openSale'](row);
    expect(sales.getSale).not.toHaveBeenCalled();
    const view: HTMLButtonElement = fixture.nativeElement.querySelector(
      'table button[aria-label^="Ver pago "]',
    );
    view.click();
    expect(dialog.open).toHaveBeenCalledWith(
      PaymentDetailDialog,
      expect.objectContaining({ data: { paymentId: row.id, customerName: row.customerName } }),
    );
    closed.next();
    closed.complete();
    expect(service.getPayments).toHaveBeenCalledTimes(1);
  });

  it('una lectura antigua no sobrescribe los resultados del último filtro', async () => {
    const { component, requests } = await setup();
    component['filtersForm'].controls.customerName.setValue('Primero');
    component['applyFilters']();
    const previous = requests[1];
    component['filtersForm'].controls.customerName.setValue('Segundo');
    component['applyFilters']();
    expect(previous.observed).toBe(false);
    const latest = makePage();
    latest.content[0].customerName = 'Segundo';
    requests[2].next(latest);
    requests[2].complete();
    const old = makePage();
    old.content[0].customerName = 'Primero';
    previous.next(old);
    expect(component['rows']()[0].customerName).toBe('Segundo');
  });

  it('recarga al cerrar un pago modificado y recupera una página válida con los mismos filtros', async () => {
    const { component, service, requests, closed, detail, fixture } = await setup(false, 21);
    component['filtersForm'].controls.paymentStatus.setValue('REGISTERED');
    component['applyFilters']();
    requests[1].next(makePage(0, 21));
    requests[1].complete();
    component['pageChanged']({ pageIndex: 1, previousPageIndex: 0, pageSize: 20, length: 21 });
    requests[2].next(makePage(1, 21));
    requests[2].complete();
    component['openPayment'](component['rows']()[0]);
    detail.hasChanges.mockReturnValue(true);
    closed.next();
    closed.complete();
    requests[3].next(makePage(1, 20));
    expect(service.getPayments).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0, paymentStatus: 'REGISTERED' }),
    );
    requests[4].next(makePage(0, 20));
    requests[4].complete();
    fixture.detectChanges();
    expect(component['pageIndex']()).toBe(0);
    expect(component['rows']().length).toBe(20);
    expect(component['loading']()).toBe(false);
  });

  it('reintenta un error con los filtros aplicados, ignorando el borrador', async () => {
    const { fixture, component, requests, service } = await setup();
    component['filtersForm'].controls.customerName.setValue('María');
    component['applyFilters']();
    requests[1].error(new Error('List unavailable'));
    fixture.detectChanges();
    component['filtersForm'].controls.customerName.setValue('José');
    const retry = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Reintentar pagos');
    retry!.click();
    expect(service.getPayments).toHaveBeenLastCalledWith(
      expect.objectContaining({ customerName: 'María' }),
    );
    requests[2].next(makePage());
    requests[2].complete();
    fixture.detectChanges();
    expect(component['error']()).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
  });

  it('abre una venta completa solo con permiso y recupera el bloqueo si falla su lectura', async () => {
    const { component, sales, saleRequests, dialog, detail, closed, requests, toast } =
      await setup(true);
    component['openSale'](row);
    saleRequests[0].error(new HttpErrorResponse({ status: 403 }));
    expect(component['openingSaleId']()).toBeNull();
    expect(toast.error).toHaveBeenCalled();
    component['openSale'](row);
    saleRequests[1].next(fullSale);
    saleRequests[1].complete();
    expect(sales.getSale).toHaveBeenCalledTimes(2);
    expect(dialog.open).toHaveBeenCalledWith(
      SaleDetailDialog,
      expect.objectContaining({ data: fullSale }),
    );
    detail.hasChanges.mockReturnValue(true);
    closed.next();
    closed.complete();
    requests[1].next(makePage());
    requests[1].complete();
    expect(component['loading']()).toBe(false);
  });

  it('muestra los eliminados con su estado original y su importe sin reclasificarlos', async () => {
    const { component, fixture, requests, service } = await setup();
    component['filtersForm'].controls.includeDeleted.setValue(true);
    component['applyFilters']();
    const response = makePage();
    response.content[0] = {
      ...response.content[0],
      status: 'CONFIRM',
      deletedAt: '2026-10-16T09:00:00',
    };
    requests[1].next(response);
    requests[1].complete();
    fixture.detectChanges();
    const status: HTMLElement = fixture.nativeElement.querySelector('td.mat-column-status');
    expect(status.textContent).toContain('Confirmado');
    expect(status.textContent).toContain('Eliminado');
    expect(status.querySelectorAll('app-status-badge').length).toBe(2);
    expect(component['rows']()[0].amount).toBe(120);
    expect(service.getPayments).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
  });
});
