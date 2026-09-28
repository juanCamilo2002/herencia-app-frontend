import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { ToastService } from '../../shared/services/toast.service';
import { CustomerFormDialog } from './customer-form-dialog/customer-form-dialog';
import { Customer, CustomerSummary } from './data-access/customer.model';
import { CustomerService } from './data-access/customer.service';
import { AuthSessionService } from '../../core/auth/auth-session.service';

@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSortModule,
    MatTableModule,
    MetricCard,
    MatPaginatorModule
  ],
  selector: 'app-customers',
  styleUrl: './customers.scss',
  templateUrl: './customers.html'
})
export class Customers implements OnInit {
  private readonly customerService = inject(CustomerService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });

  protected readonly summary = signal<CustomerSummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly displayedColumns = computed(() => [
    'customer',
    'document',
    'phone',
    'email',
    'address',
    ...(this.hasCustomerActions() ? ['actions'] : []),
  ]);

  protected readonly sortedCustomers = computed(() => this.customers());

  protected readonly totalCustomers = computed(() => this.summary()?.totalCustomers ?? 0);

  protected readonly customersWithEmail = computed(() => this.summary()?.customersWithEmail ?? 0);

  protected readonly customersWithPhone = computed(() => this.summary()?.customersWithPhone ?? 0);

  protected readonly customersWithoutContact = computed(() => this.summary()?.customersWithoutContact ?? 0);

  protected readonly canCreateCustomer = computed(() =>
    this.session.hasPermission('customers:create')
  );

  protected readonly canUpdateCustomer = computed(() =>
    this.session.hasPermission('customers:update')
  );

  protected readonly canDeleteCustomer = computed(() =>
    this.session.hasPermission('customers:delete')
  );

  protected readonly hasCustomerActions = computed(() =>
    this.canUpdateCustomer() || this.canDeleteCustomer()
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadCustomers();
  }

  protected loadCustomers() {
    this.loading.set(true);
    this.error.set(null);

    this.customerService.getCustomers({
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: this.sortParam()
    }).subscribe({
      next: (page) => {
        this.customers.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los clientes.');
        this.loading.set(false);
      }
    });
  }

  private loadSummary() {
    this.customerService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary)
    });
  }

  protected sortCustomers(sort: Sort) {
    this.sort.set(sort);
    this.pageIndex.set(0);
    this.loadCustomers();
  }

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadCustomers();
  }

  protected openCreateCustomerDialog() {
    const dialogRef = this.dialog.open(CustomerFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel'
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Cliente creado correctamente.');
        this.loadSummary();
        this.loadCustomers();
      }
    });
  }

  protected openEditCustomerDialog(customer: Customer) {
    const dialogRef = this.dialog.open(CustomerFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { customer },
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Cliente actualizado correctamente.');
        this.loadSummary();
        this.loadCustomers();
      }
    });
  }

  protected confirmDeleteCustomer(customer: Customer) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'app-dialog-panel',
      data: {
        title: 'Eliminar cliente',
        message: `Se desactivará "${customer.name}" del registro de clientes. Podrás conservar su historial de ventas.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        tone: 'danger',
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteCustomer(customer);
      }
    });
  }

  private deleteCustomer(customer: Customer) {
    this.customerService.deleteCustomer(customer.id).subscribe({
      next: () => {
        this.toast.success('Cliente eliminado correctamente.');
        this.loadSummary();
        this.loadCustomers();
      },
      error: () => {
        this.toast.error('No fue posible eliminar el cliente.');
      }
    });
  }

  private sortParam() {
    const sort = this.sort();

    if (!sort.active || !sort.direction) {
      return 'name,asc';
    }

    return `${sort.active},${sort.direction}`;
  }
}