import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { ToastService } from '../../shared/services/toast.service';
import { UserService } from './data-access/user.service';
import { UserFormDialog } from './user-form-dialog/user-form-dialog';
import { User, UserSummary } from './data-access/user.model';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';

@Component({
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSortModule,
    MatTableModule,
    MetricCard,
    MatPaginatorModule
  ],
  selector: 'app-users',
  styleUrl: './users.scss',
  templateUrl: './users.html',
})
export class Users implements OnInit {
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });

  protected readonly summary = signal<UserSummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly canCreateUser = computed(() =>
    this.session.hasPermission('users:create') &&
    this.session.hasPermission('users:assign-role')
  );

  protected readonly canUpdateUser = computed(() =>
    this.session.hasPermission('users:update') &&
    this.session.hasPermission('users:assign-role')
  );

  protected readonly canDisableUser = computed(() =>
    this.session.hasPermission('users:disable')
  );

  protected readonly hasUserActions = computed(() =>
    this.canUpdateUser() || this.canDisableUser()
  );

  protected readonly displayedColumns = computed(() => [
    'user',
    'email',
    'role',
    'status',
    'createdAt',
    ...(this.hasUserActions() ? ['actions'] : []),
  ]);

  protected readonly sortedUsers = computed(() => this.users());

  protected readonly totalUsers = computed(() => this.summary()?.totalUsers ?? 0);
  protected readonly activeUsers = computed(() => this.summary()?.activeUsers ?? 0);
  protected readonly inactiveUsers = computed(() => this.summary()?.inactiveUsers ?? 0);
  protected readonly adminUsers = computed(() => this.summary()?.adminUsers ?? 0);

  ngOnInit(): void {
    this.loadSummary();
    this.loadUsers();
  }

  protected loadUsers() {
    this.loading.set(true);
    this.error.set(null);

    this.userService.getUsers({
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: this.sortParam()
    }).subscribe({
      next: (page) => {
        this.users.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los usuarios.');
        this.loading.set(false);
      },
    });
  }

  private loadSummary() {
    this.userService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  protected sortUsers(sort: Sort) {
    this.sort.set(sort);
    this.pageIndex.set(0);
    this.loadUsers();
  }

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadUsers();
  }
  protected openCreateUserDialog() {
    const dialogRef = this.dialog.open(UserFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Usuario creado correctamente.');
        this.loadSummary();
        this.loadUsers();
      }
    });
  }

  protected openEditUserDialog(user: User) {
    const dialogRef = this.dialog.open(UserFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { user },
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Usuario actualizado correctamente.');
        this.loadSummary();
        this.loadUsers();
      }
    });
  }

  protected confirmDisableUser(user: User) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'app-dialog-panel',
      data: {
        title: 'Desactivar usuario',
        message: `Se desactivará "${user.name}". No podrá iniciar sesión ni usar el sistema.`,
        confirmText: 'Desactivar',
        cancelText: 'Cancelar',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.disableUser(user);
      }
    });
  }

  private disableUser(user: User) {
    this.userService.disableUser(user.id).subscribe({
      next: () => {
        this.toast.success('Usuario desactivado correctamente.');
        this.loadSummary();
        this.loadUsers();
      },
      error: () => {
        this.toast.error('No fue posible desactivar el usuario.');
      },
    });
  }


  private sortParam() {
    const sort = this.sort();

    if (!sort.active || !sort.direction) {
      return 'name,asc';
    }

    if (sort.active === 'role') {
      return `role.name,${sort.direction}`;
    }

    return `${sort.active},${sort.direction}`;
  }
}
