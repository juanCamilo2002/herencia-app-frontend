import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PageResponse } from '../../../shared/data-access/page.model';
import { SalePayment } from '../../sales/data-access/sales.model';
import { PaymentListItem } from './payments.model';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PaymentsService],
    });

    service = TestBed.inject(PaymentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('envía paginación, excluye eliminados por defecto y omite filtros vacíos', () => {
    const page: PageResponse<PaymentListItem> = {
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    };

    service
      .getPayments({
        page: 0,
        size: 20,
        customerName: '   ',
        paymentStatus: null,
        paymentMethod: null,
        dateFrom: '',
        dateTo: null,
      })
      .subscribe((response) => {
        expect(response).toEqual(page);
      });

    const request = http.expectOne((candidate) => candidate.url === '/payments');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('20');
    expect(request.request.params.get('includeDeleted')).toBe('false');

    expect(request.request.params.has('customerName')).toBe(false);
    expect(request.request.params.has('paymentStatus')).toBe(false);
    expect(request.request.params.has('paymentMethod')).toBe(false);
    expect(request.request.params.has('dateFrom')).toBe(false);
    expect(request.request.params.has('dateTo')).toBe(false);
    expect(request.request.params.has('sort')).toBe(false);

    request.flush(page);
  });

  it('envía los filtros y conserva el día final sin adelantarlo en frontend', () => {
    service
      .getPayments({
        page: 1,
        size: 50,
        customerName: '  María_50%!  ',
        paymentStatus: 'REGISTERED',
        paymentMethod: 'BANK_TRANSFER',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-15',
        includeDeleted: true,
      })
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/payments');

    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('size')).toBe('50');
    expect(request.request.params.get('customerName')).toBe('María_50%!');
    expect(request.request.params.get('paymentStatus')).toBe('REGISTERED');
    expect(request.request.params.get('paymentMethod')).toBe('BANK_TRANSFER');
    expect(request.request.params.get('dateFrom')).toBe('2026-10-01');
    expect(request.request.params.get('dateTo')).toBe('2026-10-15');
    expect(request.request.params.get('includeDeleted')).toBe('true');

    request.flush({
      content: [],
      page: 1,
      size: 50,
      totalElements: 0,
      totalPages: 0,
      first: false,
      last: true,
    });
  });

  it('consulta un pago eliminado desde el endpoint global y conserva su estado', () => {
    const payment: SalePayment = {
      id: 'payment-1',
      saleId: 'sale-1',
      amount: 120000,
      method: 'BANK_TRANSFER',
      paymentDateTime: '2026-10-15T14:07:00',
      notes: 'Transferencia registrada.',
      status: 'CONFIRM',

      registeredById: 'user-1',
      registeredByName: 'Ana',

      confirmedById: 'user-1',
      confirmedByName: 'Ana',
      confirmedAt: '2026-10-15T14:15:00',

      declinedById: null,
      declinedByName: null,
      declinedAt: null,
      declineReason: null,

      deletedById: 'user-1',
      deletedByName: 'Ana',
      deletedAt: '2026-10-15T15:00:00',
      deletionReason: 'Pago duplicado.',

      createdAt: '2026-10-15T14:10:00',
      updatedAt: '2026-10-15T15:00:00',
    };

    service.getPayment(payment.id).subscribe((response) => {
      expect(response).toEqual(payment);
      expect(response.status).toBe('CONFIRM');
      expect(response.deletedAt).not.toBeNull();
    });

    const request = http.expectOne('/payments/payment-1');

    expect(request.request.method).toBe('GET');

    request.flush(payment);
  });
});
