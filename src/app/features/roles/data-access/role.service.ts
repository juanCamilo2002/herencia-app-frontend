import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateRoleRequest,
  PermissionCatalogSection,
  Role,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
} from './role.model';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly http = inject(HttpClient);

  getRoles() {
    return this.http.get<Role[]>('/roles');
  }

  getPermissionCatalog() {
    return this.http.get<PermissionCatalogSection[]>('/roles/permissions/catalog');
  }

  createRole(request: CreateRoleRequest) {
    return this.http.post<Role>('/roles', request);
  }

  updateRole(id: string, request: UpdateRoleRequest) {
    return this.http.put<Role>(`/roles/${id}`, request);
  }

  disableRole(id: string) {
    return this.http.delete<void>(`/roles/${id}`);
  }

  updatePermissions(id: string, request: UpdateRolePermissionsRequest) {
    return this.http.put<Role>(`/roles/${id}/permissions`, request);
  }
}