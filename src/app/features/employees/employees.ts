import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { ToastService } from '../../shared/services/toast.service';
import { EmployeeFormDialog } from './employee-form-dialog/employee-form-dialog';
import { Employee, EmployeeSummary } from './data-access/employee.model';
import { EmployeeService } from './data-access/employee.service';

@Component({
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MetricCard,
  ],
  selector: 'app-employees',
  styleUrl: './employees.scss',
  templateUrl: './employees.html',
})
export class Employees implements OnInit {
  private readonly employeeService = inject(EmployeeService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);

  protected readonly employees = signal<Employee[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });

  protected readonly summary = signal<EmployeeSummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly displayedColumns = computed(() => [
    'employee',
    'document',
    'position',
    'phone',
    'email',
    'hireDate',
    ...(this.hasEmployeeActions() ? ['actions'] : []),
  ]);

  protected readonly sortedEmployees = computed(() => this.employees());

  protected readonly totalEmployees = computed(() => this.summary()?.totalEmployees ?? 0);
  protected readonly employeesWithEmail = computed(() => this.summary()?.employeesWithEmail ?? 0);
  protected readonly employeesWithPhone = computed(() => this.summary()?.employeesWithPhone ?? 0);
  protected readonly employeesWithoutContact = computed(() => this.summary()?.employeesWithoutContact ?? 0);

  protected readonly canCreateEmployee = computed(() =>
    this.session.hasPermission('employees:create')
  );

  protected readonly canUpdateEmployee = computed(() =>
    this.session.hasPermission('employees:update')
  );

  protected readonly canDisableEmployee = computed(() =>
    this.session.hasPermission('employees:disable')
  );

  protected readonly hasEmployeeActions = computed(() =>
    this.canUpdateEmployee() || this.canDisableEmployee()
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadEmployees();
  }

  protected loadEmployees() {
    this.loading.set(true);
    this.error.set(null);

    this.employeeService.getEmployees({
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: this.sortParam(),
    }).subscribe({
      next: (page) => {
        this.employees.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los empleados.');
        this.loading.set(false);
      },
    });
  }

  protected sortEmployees(sort: Sort) {
    this.sort.set(sort);
    this.pageIndex.set(0);
    this.loadEmployees();
  }

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadEmployees();
  }

  protected openCreateEmployeeDialog() {
    const dialogRef = this.dialog.open(EmployeeFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Empleado creado correctamente.');
        this.loadSummary();
        this.loadEmployees();
      }
    });
  }

  protected openEditEmployeeDialog(employee: Employee) {
    const dialogRef = this.dialog.open(EmployeeFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { employee },
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Empleado actualizado correctamente.');
        this.loadSummary();
        this.loadEmployees();
      }
    });
  }

  protected confirmDisableEmployee(employee: Employee) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'app-dialog-panel',
      data: {
        title: 'Desactivar empleado',
        message: `Se desactivará "${employee.name}" del registro de empleados.`,
        confirmText: 'Desactivar',
        cancelText: 'Cancelar',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.disableEmployee(employee);
      }
    });
  }

  private loadSummary() {
    this.employeeService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  private disableEmployee(employee: Employee) {
    this.employeeService.disableEmployee(employee.id).subscribe({
      next: () => {
        this.toast.success('Empleado desactivado correctamente.');
        this.loadSummary();
        this.loadEmployees();
      },
      error: () => {
        this.toast.error('No fue posible desactivar el empleado.');
      },
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