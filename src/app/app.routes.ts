import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        canActivate: [permissionGuard],
        data: { permission: 'dashboard:read' },
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'products',
        canActivate: [permissionGuard],
        data: { permission: 'products:read' },
        loadComponent: () => import('./features/products/products').then((m) => m.Products),
      },
      {
        path: 'customers',
        canActivate: [permissionGuard],
        data: { permission: 'customers:read' },
        loadComponent: () => import('./features/customers/customers').then((m) => m.Customers),
      },
      {
        path: 'inventory',
        canActivate: [permissionGuard],
        data: { permission: 'inventory:read' },
        loadComponent: () => import('./features/inventory/inventory').then((m) => m.Inventory),
      },
      {
        path: 'sales',
        canActivate: [permissionGuard],
        data: { permission: 'sales:read' },
        loadComponent: () => import('./features/sales/sales').then((m) => m.Sales),
      },
      {
        path: 'employees',
        canActivate: [permissionGuard],
        data: { permission: 'employees:read' },
        loadComponent: () => import('./features/employees/employees').then((m) => m.Employees),
      },
      {
        path: 'users',
        canActivate: [permissionGuard],
        data: { permission: 'users:read' },
        loadComponent: () => import('./features/users/users').then((m) => m.Users),
      },
      {
        path: 'roles',
        canActivate: [permissionGuard],
        data: { permission: 'roles:read' },
        loadComponent: () => import('./features/roles/roles').then((m) => m.Roles),
      },
      {
        path: 'supplies',
        canActivate: [permissionGuard],
        data: { permission: 'supplies:read' },
        loadComponent: () => import('./features/supplies/supplies').then((m) => m.Supplies),
      },
      {
        path: 'supply-inventory',
        canActivate: [permissionGuard],
        data: { permission: 'supply-inventory:read' },
        loadComponent: () => import('./features/supply-inventory/supply-inventory').then((m) => m.SupplyInventory),
      },
      {
        path: 'productions',
        canActivate: [permissionGuard],
        data: { permission: 'productions:read' },
        loadComponent: () => import('./features/productions/productions').then((m) => m.Productions),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];