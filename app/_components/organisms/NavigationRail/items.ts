import type { IconName } from "../../atoms/Icon/icons";

export interface RailItem {
  key: string;
  href: string;
  icon: IconName;
  label: string;
  requires?: string;
  children?: RailItem[];
}

export const primaryItems: RailItem[] = [
  { key: "pos", href: "/pos", icon: "point_of_sale", label: "POS", requires: "sales:create" },
  { key: "sales", href: "/sales", icon: "receipt_long", label: "Ventas", requires: "sales:read" },
  { key: "quotes", href: "/quotes", icon: "request_quote", label: "Cotizaciones", requires: "quotes:read" },
  { key: "returns", href: "/returns", icon: "assignment_return", label: "Devoluciones", requires: "returns:read" },
  { key: "payments", href: "/payments", icon: "payments", label: "Abonos", requires: "payments:read" },
  { key: "expenses", href: "/expenses", icon: "trending_down", label: "Gastos", requires: "expenses:read" },
  { key: "purchases", href: "/purchases", icon: "shopping_cart", label: "Compras", requires: "purchases:read" },
  { key: "billing", href: "/billing", icon: "description", label: "Facturación", requires: "billing:read" },
  { key: "inventory", href: "/inventory", icon: "inventory_2", label: "Inventario", requires: "inventory:read" },
  { key: "waybills", href: "/waybills", icon: "swap_horiz", label: "Traspasos", requires: "waybills:read" },
  { key: "reports", href: "/reports", icon: "summarize", label: "Reportes", requires: "reports:account_statements_read" },
  {
    key: "catalogs",
    href: "/catalogs",
    icon: "category",
    label: "Catálogos",
    children: [
      { key: "payment-methods", href: "/catalogs/payment-methods", icon: "payments", label: "Formas de pago", requires: "payment_methods:read" },
      { key: "folios", href: "/catalogs/folios", icon: "tag", label: "Folios", requires: "folios:read" },
      { key: "departments", href: "/catalogs/departments", icon: "apartment", label: "Departamentos", requires: "departments:read" },
      { key: "branches", href: "/catalogs/branches", icon: "store", label: "Sucursales", requires: "branches:read" },
      { key: "providers", href: "/catalogs/providers", icon: "local_shipping", label: "Proveedores", requires: "providers:read" },
      { key: "products", href: "/catalogs/products", icon: "inventory_2", label: "Productos", requires: "products:read" },
      { key: "customers", href: "/catalogs/customers", icon: "groups", label: "Clientes", requires: "customers:read" },
      { key: "vehicles", href: "/catalogs/vehicles", icon: "local_shipping", label: "Vehículos", requires: "vehicles:read" },
      { key: "drivers", href: "/catalogs/drivers", icon: "badge", label: "Operadores", requires: "drivers:read" },
    ],
  },
  { key: "users", href: "/users", icon: "group", label: "Usuarios", requires: "users:read" },
  { key: "roles", href: "/roles", icon: "shield_person", label: "Roles", requires: "roles:read" },
];

export const secondaryItems: RailItem[] = [
  { key: "account", href: "/account", icon: "account_circle", label: "Mi cuenta" },
  { key: "settings", href: "/settings", icon: "settings", label: "Configuración", requires: "settings:read" },
];
