import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../../shared/services/toast.service';
import { PermissionCatalogSection, Role } from '../data-access/role.model';
import { RoleService } from '../data-access/role.service';

export type RolePermissionsDialogData = {
  role: Role;
};

@Component({
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
  ],
  selector: 'app-role-permissions-dialog',
  styleUrl: './role-permissions-dialog.scss',
  templateUrl: './role-permissions-dialog.html',
})
export class RolePermissionsDialog implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<RolePermissionsDialog>);
  private readonly data = inject<RolePermissionsDialogData>(MAT_DIALOG_DATA);

  protected readonly role = this.data.role;
  protected readonly catalog = signal<PermissionCatalogSection[]>([]);
  protected readonly selectedPermissionIds = signal<Set<string>>(new Set());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly selectedCount = computed(() => this.selectedPermissionIds().size);

  ngOnInit(): void {
    this.loadCatalog();
  }

  protected close() {
    this.dialogRef.close(false);
  }

  protected isSelected(permissionId: string) {
    return this.selectedPermissionIds().has(permissionId);
  }

  protected sectionSelectedCount(section: PermissionCatalogSection) {
    const selected = this.selectedPermissionIds();

    return section.permissions.filter((permission) => selected.has(permission.id)).length;
  }

  protected isSectionChecked(section: PermissionCatalogSection) {
    return section.permissions.length > 0 && this.sectionSelectedCount(section) === section.permissions.length;
  }

  protected isSectionIndeterminate(section: PermissionCatalogSection) {
    const selectedCount = this.sectionSelectedCount(section);
    return selectedCount > 0 && selectedCount < section.permissions.length;
  }

  protected togglePermission(permissionId: string, event: MatCheckboxChange) {
    const selected = new Set(this.selectedPermissionIds());

    if (event.checked) {
      selected.add(permissionId);
    } else {
      selected.delete(permissionId);
    }

    this.selectedPermissionIds.set(selected);
  }

  protected toggleSection(section: PermissionCatalogSection, event: MatCheckboxChange) {
    const selected = new Set(this.selectedPermissionIds());

    for (const permission of section.permissions) {
      if (event.checked) {
        selected.add(permission.id);
      } else {
        selected.delete(permission.id);
      }
    }

    this.selectedPermissionIds.set(selected);
  }

  protected submit() {
    this.saving.set(true);
    this.error.set(null);

    this.roleService.updatePermissions(this.role.id, {
      permissionIds: [...this.selectedPermissionIds()],
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = this.resolvePermissionError(error);
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);
      },
    });
  }

  private loadCatalog() {
    this.loading.set(true);

    this.roleService.getPermissionCatalog().subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.selectedPermissionIds.set(this.currentPermissionIds(catalog));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar el catálogo de permisos.');
        this.loading.set(false);
      },
    });
  }

  private currentPermissionIds(catalog: PermissionCatalogSection[]) {
    const selected = new Set<string>();
    const currentPermissions = new Set(this.role.permissions);

    for (const section of catalog) {
      for (const permission of section.permissions) {
        if (currentPermissions.has(permission.key)) {
          selected.add(permission.id);
        }
      }
    }

    return selected;
  }

  private resolvePermissionError(error: unknown) {
    const message = error instanceof HttpErrorResponse ? error.error?.message : null;

    switch (message) {
      case 'System role cannot be modified':
        return 'Los roles de sistema no pueden modificarse.';
      case 'Invalid permissions':
        return 'Uno o varios permisos seleccionados no son válidos.';
      default:
        return 'No fue posible actualizar los permisos.';
    }
  }
}