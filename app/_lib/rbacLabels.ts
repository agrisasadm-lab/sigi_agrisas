export const RESOURCE_LABELS: Record<string, string> = {
  users: "Usuarios",
  roles: "Roles y Permisos",
  payment_methods: "Formas de Pago",
  folios: "Folios",
  departments: "Departamentos",
  branches: "Sucursales",
  providers: "Proveedores",
  vehicles: "Vehículos",
  drivers: "Operadores",
  products: "Productos",
  inventory: "Inventario",
  customers: "Clientes",
  sales: "Ventas",
  quotes: "Cotizaciones",
  returns: "Devoluciones",
  payments: "Abonos",
  purchases: "Compras",
  reports: "Reportes",
  tax_rates: "Tasas de Impuesto",
  billing: "Facturación",
  waybills: "Traspasos",
  settings: "Configuración",
};

export function getPermissionGroupLabel(resource: string): string {
  return (
    RESOURCE_LABELS[resource] ??
    resource.charAt(0).toUpperCase() + resource.slice(1)
  );
}

const ROLE_NAME_LABELS: Record<string, string> = {
  admin: "Administrador",
  operator: "Operador",
  viewer: "Visor",
};

export function getRoleNameLabel(name: string): string {
  if (ROLE_NAME_LABELS[name]) return ROLE_NAME_LABELS[name];
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
