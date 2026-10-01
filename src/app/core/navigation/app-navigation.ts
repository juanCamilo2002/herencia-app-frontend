export type AppNavigationItem = {
  type: 'item';
  label: string;
  icon: string;
  route: string;
  permission: string;
};

export type AppNavigationGroup = {
  type: 'group';
  id: string;
  label: string;
  icon: string;
  items: AppNavigationItem[];
};

export type AppNavigationEntry = AppNavigationItem | AppNavigationGroup;

export const APP_NAVIGATION_ENTRIES: AppNavigationEntry[] = [
  {
    type: 'item',
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard',
    permission: 'dashboard:read',
  },
  {
    type: 'group',
    id: 'commercial',
    label: 'Comercial',
    icon: 'storefront',
    items: [
      { type: 'item', label: 'Clientes', icon: 'groups', route: '/customers', permission: 'customers:read' },
      { type: 'item', label: 'Ventas', icon: 'point_of_sale', route: '/sales', permission: 'sales:read' },
    ],
  },
  {
    type: 'group',
    id: 'operation',
    label: 'Operación',
    icon: 'inventory_2',
    items: [
      { type: 'item', label: 'Productos', icon: 'wine_bar', route: '/products', permission: 'products:read' },
      { type: 'item', label: 'Inventario productos', icon: 'inventory_2', route: '/inventory', permission: 'inventory:read' },
      { type: 'item', label: 'Insumos', icon: 'science', route: '/supplies', permission: 'supplies:read' },
      { type: 'item', label: 'Inventario insumos', icon: 'warehouse', route: '/supply-inventory', permission: 'supply-inventory:read' },
      { type: 'item', label: 'Producciones', icon: 'precision_manufacturing', route: '/productions', permission: 'productions:read' },
    ],
  },
  {
    type: 'group',
    id: 'team',
    label: 'Equipo',
    icon: 'badge',
    items: [
      { type: 'item', label: 'Empleados', icon: 'badge', route: '/employees', permission: 'employees:read' },
    ],
  },
  {
    type: 'group',
    id: 'administration',
    label: 'Administración',
    icon: 'admin_panel_settings',
    items: [
      { type: 'item', label: 'Usuarios', icon: 'manage_accounts', route: '/users', permission: 'users:read' },
      { type: 'item', label: 'Roles', icon: 'admin_panel_settings', route: '/roles', permission: 'roles:read' },
    ],
  }
];

export const APP_NAVIGATION_ITEMS = APP_NAVIGATION_ENTRIES.flatMap((entry) =>
  entry.type === 'item' ? [entry] : entry.items
);