import { getPermissionGroupLabel, getRoleNameLabel, RESOURCE_LABELS } from "../../../../app/_lib/rbacLabels";

describe("getPermissionGroupLabel", () => {
  it("returns Spanish label for known resources", () => {
    expect(getPermissionGroupLabel("users")).toBe("Usuarios");
    expect(getPermissionGroupLabel("roles")).toBe("Roles y Permisos");
    expect(getPermissionGroupLabel("inventory")).toBe("Inventario");
    expect(getPermissionGroupLabel("billing")).toBe("Facturación");
  });

  it("returns Spanish label for resources previously missing from the dictionary", () => {
    expect(getPermissionGroupLabel("vehicles")).toBe("Vehículos");
    expect(getPermissionGroupLabel("drivers")).toBe("Operadores");
    expect(getPermissionGroupLabel("tax_rates")).toBe("Tasas de Impuesto");
    expect(getPermissionGroupLabel("waybills")).toBe("Traspasos");
    expect(getPermissionGroupLabel("payments")).toBe("Abonos");
    expect(getPermissionGroupLabel("payment_methods")).toBe("Formas de Pago");
  });

  it("capitalizes the first letter of unknown resources", () => {
    expect(getPermissionGroupLabel("unknown")).toBe("Unknown");
    expect(getPermissionGroupLabel("custom_module")).toBe("Custom_module");
  });

  it("RESOURCE_LABELS covers every resource seeded in prisma/seed.ts", () => {
    const expected = [
      "users", "roles", "payment_methods", "folios", "departments", "branches",
      "providers", "vehicles", "drivers", "products", "inventory", "customers",
      "sales", "quotes", "returns", "payments", "purchases", "reports",
      "tax_rates", "billing", "waybills", "settings",
    ];
    expected.forEach((key) => {
      expect(RESOURCE_LABELS).toHaveProperty(key);
    });
  });
});

describe("getRoleNameLabel", () => {
  it("returns Spanish name for seeded roles", () => {
    expect(getRoleNameLabel("admin")).toBe("Administrador");
    expect(getRoleNameLabel("operator")).toBe("Operador");
    expect(getRoleNameLabel("viewer")).toBe("Visor");
  });

  it("humanizes a multi-word custom role name", () => {
    expect(getRoleNameLabel("supervisor_almacen")).toBe("Supervisor Almacen");
  });

  it("humanizes a single-word custom role name without error", () => {
    expect(getRoleNameLabel("contador")).toBe("Contador");
  });
});
