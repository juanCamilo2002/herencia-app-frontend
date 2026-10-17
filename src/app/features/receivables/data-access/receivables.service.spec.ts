import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PageResponse } from '../../../shared/data-access/page.model';
import { Receivable, ReceivableSummary } from './receivables.model';
import { ReceivablesService } from './receivables.service';

describe('ReceivablesService', () => {
  let service: ReceivablesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReceivablesService],
    });

    service = TestBed.inject(ReceivablesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('envía paginación y omite filtros vacíos', () => {
    const page: PageResponse<Receivable> = {
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    };

    service
      .getReceivables({
        page: 0,
        size: 20,
        customerName: '   ',
        paymentType: null,
        paymentStatus: null,
      })
      .subscribe((response) => {
        expect(response).toEqual(page);
      });

    const request = http.expectOne((candidate) => candidate.url === '/receivables');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('20');
    expect(request.request.params.has('customerName')).toBe(false);
    expect(request.request.params.has('paymentType')).toBe(false);
    expect(request.request.params.has('paymentStatus')).toBe(false);
    expect(request.request.params.has('sort')).toBe(false);

    request.flush(page);
  });

  it('envía filtros sin convertir los caracteres del nombre en un patrón SQL', () => {
    service
      .getReceivables({
        page: 1,
        size: 50,
        customerName: '  María_50%!  ',
        paymentType: 'CREDIT',
        paymentStatus: 'OVERDUE',
      })
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/receivables');

    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('size')).toBe('50');
    expect(request.request.params.get('customerName')).toBe('María_50%!');
    expect(request.request.params.get('paymentType')).toBe('CREDIT');
    expect(request.request.params.get('paymentStatus')).toBe('OVERDUE');

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

  it('consulta las métricas globales sin parámetros de listado', () => {
    const summary: ReceivableSummary = {
      outstandingAmount: 320,
      overdueAmount: 50,
      salesWithBalance: 3,
      overdueSales: 1,
    };

    service.getSummary().subscribe((response) => {
      expect(response).toEqual(summary);
    });

    const request = http.expectOne('/receivables/summary');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush(summary);
  });
});
