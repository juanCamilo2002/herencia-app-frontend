export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  systemRole: boolean;
  active: boolean;
  permissions: string[];
  activeUsersCount: number;
  canUpdate: boolean;
  canAssignPermissions: boolean;
  canDisable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateRoleRequest = {
  code: string;
  name: string;
  description: string | null;
};

export type UpdateRoleRequest = {
  name: string;
  description: string | null;
  active: boolean;
};

export type UpdateRolePermissionsRequest = {
  permissionIds: string[];
};

export type PermissionCatalogSection = {
  sectionCode: string;
  sectionName: string;
  permissions: PermissionCatalogItem[];
};

export type PermissionCatalogItem = {
  id: string;
  key: string;
  actionCode: string;
  actionName: string;
};