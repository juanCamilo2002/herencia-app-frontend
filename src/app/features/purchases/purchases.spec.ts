import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { PageResponse } from '../../shared/data-access/page.model';
import { PurchaseListItem, PurchaseStatus, PurchaseSummary } from './data-access/purchases.model';
import { PurchasesService } from './data-access/purchases.service';
import { Purchases } from './purchases';

describe('Listado de compras', () => {
  it('mantiene estadísticas al filtrar y paginar y separa filtros aplicados de borradores', async () => {
    const requests: Subject<PageResponse<PurchaseListItem>>[] = [];
    const stats = new Subject<PurchaseSummary>();
    const list = vi.fn(
      (_page: number, _size: number, _search: string | null, _status: PurchaseStatus | null) => {
        const request = new Subject<PageResponse<PurchaseListItem>>();
        requests.push(request);
        return request;
      },
    );
    const summary = vi.fn(() => stats);
    await TestBed.configureTestingModule({
      imports: [Purchases],
      providers: [
        { provide: PurchasesService, useValue: { list, summary } },
        { provide: MatDialog, useValue: {} },
        { provide: AuthSessionService, useValue: { hasPermission: () => false } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Purchases);
    fixture.detectChanges();
    stats.next({
      totalPurchases: 40,
      orderedCount: 2,
      orderedAmount: '10000.00',
      receivedAmount: '20000.00',
    });
    requests[0].next({
      content: [],
      page: 0,
      size: 20,
      totalElements: 40,
      totalPages: 2,
      first: true,
      last: false,
    });
    fixture.detectChanges();
    const metric = fixture.nativeElement.querySelector('app-metric-card');
    const component = fixture.componentInstance;
    component['filters'].setValue({ search: ' Proveedor ', status: 'ORDERED' });
    component['applyFilters']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-metric-card')).toBe(metric);
    requests[1].next({
      content: [],
      page: 0,
      size: 20,
      totalElements: 40,
      totalPages: 2,
      first: true,
      last: false,
    });
    component['filters'].controls.search.setValue('Borrador');
    component['pageChanged']({ pageIndex: 1, pageSize: 20, length: 40 });
    expect(list).toHaveBeenLastCalledWith(1, 20, 'Proveedor', 'ORDERED');
    expect(summary).toHaveBeenCalledOnce();
  });
});
