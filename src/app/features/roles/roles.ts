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
import { Role } from './data-access/role.model';
import { RoleService } from './data-access/role.service';
import { RoleFormDialog } from './role-form-dialog/role-form-dialog';
import { RolePermissionsDialog } from './role-permissions-dialog/role-permissions-dialog';

@Component({
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSortModule,
    MatTableModule,
    MetricCard,
  ],
  selector: 'app-roles',
  styleUrl: './roles.scss',
  templateUrl: './roles.html',
})
export class Roles implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);

  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });

  protected readonly canCreateRole = computed(() =>
    this.session.hasPermission('roles:create')
  );

  protected readonly canUpdateRole = computed(() =>
    this.session.hasPermission('roles:update')
  );

  protected readonly canDisableRole = computed(() =>
    this.session.hasPermission('roles:disable')
  );

  protected readonly canAssignPermissions = computed(() =>
    this.session.hasPermission('roles:assign-permissions')
  );

  protected readonly hasRoleActions = computed(() =>
    this.canUpdateRole() || this.canDisableRole() || this.canAssignPermissions()
  );

  protected readonly displayedColumns = computed(() => [
    'role',
    'code',
    'permissions',
    'users',
    'type',
    'status',
    'createdAt',
    ...(this.hasRoleActions() ? ['actions'] : []),
  ]);

  protected readonly sortedRoles = computed(() => {
    const roles = [...this.roles()];
    const sort = this.sort();

    if (!sort.active || !sort.direction) {
      return roles;
    }

    return roles.sort((a, b) => {
      const result = this.compareRoles(a, b, sort.active);
      return sort.direction === 'asc' ? result : -result;
    });
  });

  protected readonly totalRoles = computed(() => this.roles().length);
  protected readonly activeRoles = computed(() => this.roles().filter((role) => role.active).length);
  protected readonly inactiveRoles = computed(() => this.roles().filter((role) => !role.active).length);
  protected readonly systemRoles = computed(() => this.roles().filter((role) => role.systemRole).length);

  ngOnInit(): void {
    this.loadRoles();
  }

  protected loadRoles() {
    this.loading.set(true);
    this.error.set(null);

    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los roles.');
        this.loading.set(false);
      },
    });
  }

  protected hasActionsForRole(role: Role) {
    return (
      (this.canUpdateRole() && role.canUpdate) ||
      (this.canAssignPermissions() && role.canAssignPermissions) ||
      (this.canDisableRole() && role.canDisable)
    );
  }

  protected sortRoles(sort: Sort) {
    this.sort.set(sort);
  }

  protected openCreateRoleDialog() {
    const dialogRef = this.dialog.open(RoleFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Rol creado correctamente.');
        this.loadRoles();
      }
    });
  }

  protected openEditRoleDialog(role: Role) {
    const dialogRef = this.dialog.open(RoleFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { role },
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Rol actualizado correctamente.');
        this.loadRoles();
      }
    });
  }

  protected openPermissionsDialog(role: Role) {
    const dialogRef = this.dialog.open(RolePermissionsDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '820px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { role },
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Permisos actualizados correctamente.');
        this.loadRoles();
      }
    });
  }

  protected confirmDisableRole(role: Role) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'app-dialog-panel',
      data: {
        title: 'Desactivar rol',
        message: `Se desactivará "${role.name}". No podrá asignarse a nuevos usuarios.`,
        confirmText: 'Desactivar',
        cancelText: 'Cancelar',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.disableRole(role);
      }
    });
  }

  protected permissionCount(role: Role) {
    return role.permissions.length;
  }

  private disableRole(role: Role) {
    this.roleService.disableRole(role.id).subscribe({
      next: () => {
        this.toast.success('Rol desactivado correctamente.');
        this.loadRoles();
      },
      error: () => {
        this.toast.error('No fue posible desactivar el rol.');
      },
    });
  }

  private compareRoles(a: Role, b: Role, field: string) {
    switch (field) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'code':
        return a.code.localeCompare(b.code);
      case 'permissions':
        return a.permissions.length - b.permissions.length;
      case 'createdAt':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'users':
        return a.activeUsersCount - b.activeUsersCount;
      default:
        return 0;
    }
  }
}