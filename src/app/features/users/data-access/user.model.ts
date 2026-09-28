export type UserSummary = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
};

export type UserRoleOption = {
    id: string;
    code: string;
    name: string;
};

export type User = {
    id: string;
    name: string;
    email: string;
    role: UserRoleOption;
    active: boolean;
    createdAt: string;
    updatedAt: string;
};

export type CreateUserRequest = {
    name: string;
    email: string;
    password: string;
    roleId: string;
};

export type UpdateUserRequest = {
    name: string;
    email: string;
    roleId: string;
    active: boolean;
};

