/**
 * @jest-environment jsdom
 */
import "fake-indexeddb/auto";
import { resetOfflineDbForTests } from "../../../../../app/_lib/offline/db";
import { resetConnectivityForTests } from "../../../../../app/_lib/offline/connectivity";

jest.mock("../../../../../app/_lib/authFetch", () => {
  const actual = jest.requireActual("../../../../../app/_lib/authFetch");
  return { ...actual, authFetch: jest.fn() };
});

import { authFetch, NetworkError } from "../../../../../app/_lib/authFetch";
import {
  refreshCatalogCache,
  getCatalogStalenessMs,
  searchProductsFromCache,
  getProductPricesFromCache,
  getProductDosificationsFromCache,
  getPaymentMethodsFromCache,
  getFoliosFromCache,
  searchCustomersFromCache,
} from "../../../../../app/_lib/offline/catalogCache";
import { resolveBranchScope, fixWorkingBranch } from "../../../../../app/_lib/offline/branchScope";
import { enqueueSale } from "../../../../../app/_lib/offline/outbox";

const mockAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>;

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function mockCatalogEndpoints() {
  mockAuthFetch.mockImplementation(async (input: string) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.includes("/admin/products?")) {
      return jsonResponse({
        items: [
          {
            id: "p1",
            code: "P1",
            name: "Producto 1",
            ivaRate: 0.16,
            iepsRate: null,
            isActive: true,
            departmentId: "d1",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            stock: 42,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      });
    }
    if (url.includes("/prices")) {
      return jsonResponse({ items: [{ id: "pp1", productId: "p1", name: "Menudeo", price: 100, minQuantity: 1, discountPct: 0, isDefault: true }] });
    }
    if (url.includes("/dosifications")) {
      return jsonResponse({ items: [] });
    }
    if (url.includes("/payment-methods")) {
      return jsonResponse({ items: [{ id: "pm1", code: "EFECTIVO", name: "Efectivo", isActive: true, isCredit: false }] });
    }
    if (url.includes("/folios")) {
      return jsonResponse({ items: [{ id: "f1", code: "TK", name: "Ticket", prefix: "TK-", currentNumber: 10, isActive: true }] });
    }
    if (url.includes("/customers")) {
      return jsonResponse({
        items: [{ id: "c1", code: "C1", name: "Cliente 1", rfc: "XAXX010101000", currentBalance: 0, isActive: true }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
    }
    throw new Error(`unexpected URL in test: ${url}`);
  });
}

async function resetAll() {
  await resetOfflineDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("agrisas-offline");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  resetConnectivityForTests(true);
  mockAuthFetch.mockReset();
}

beforeEach(async () => {
  await resetAll();
});

describe("catalogCache — pull inicial", () => {
  it("puebla productos/precios/dosificaciones/métodos de pago/folios/clientes para la sucursal", async () => {
    mockCatalogEndpoints();
    await refreshCatalogCache("b1");

    const products = await searchProductsFromCache("b1", undefined);
    expect(products).toHaveLength(1);
    expect(products[0].code).toBe("P1");
    expect(products[0].stock).toBe(42);

    expect(await getProductPricesFromCache("p1")).toHaveLength(1);
    expect(await getProductDosificationsFromCache("p1")).toHaveLength(0);
    expect(await getPaymentMethodsFromCache("b1")).toHaveLength(1);
    expect(await getFoliosFromCache("b1")).toHaveLength(1);
    expect(await searchCustomersFromCache("b1", undefined)).toHaveLength(1);

    const priceCall = mockAuthFetch.mock.calls.find(([url]) => String(url).includes("/prices"));
    expect(String(priceCall?.[0])).toContain("branchId=b1");
  });

  it("actualiza catalogSyncedAt tras un pull exitoso", async () => {
    mockCatalogEndpoints();
    expect(await getCatalogStalenessMs()).toBeNull();
    await refreshCatalogCache("b1");
    expect(await getCatalogStalenessMs()).not.toBeNull();
  });

  it("propaga NetworkError si se cae la conexión a mitad del pull, sin tocar el cache previo", async () => {
    mockCatalogEndpoints();
    await refreshCatalogCache("b1");

    mockAuthFetch.mockRejectedValueOnce(new NetworkError());
    await expect(refreshCatalogCache("b1")).rejects.toThrow(NetworkError);

    // El cache previo (del pull exitoso anterior) sigue disponible.
    expect(await searchProductsFromCache("b1", undefined)).toHaveLength(1);
  });

  it("no intenta refrescar si isOnline()===false", async () => {
    resetConnectivityForTests(false);
    await expect(refreshCatalogCache("b1")).rejects.toThrow(NetworkError);
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });
});

describe("catalogCache — búsqueda offline con filtro", () => {
  it("filtra por código o nombre, sin distinguir mayúsculas", async () => {
    mockCatalogEndpoints();
    await refreshCatalogCache("b1");

    expect(await searchProductsFromCache("b1", "p1")).toHaveLength(1);
    expect(await searchProductsFromCache("b1", "producto")).toHaveLength(1);
    expect(await searchProductsFromCache("b1", "inexistente")).toHaveLength(0);
  });
});

describe("branchScope — purga al cambiar de sucursal (guard de ownerBranchId)", () => {
  it("cachear sucursal A, cambiar sesión a sucursal B purga los datos de A", async () => {
    mockCatalogEndpoints();
    const first = await resolveBranchScope("branchA", false);
    expect(first.ownerBranchId).toBe("branchA");
    await refreshCatalogCache("branchA");
    expect(await searchProductsFromCache("branchA", undefined)).toHaveLength(1);

    const second = await resolveBranchScope("branchB", false);
    expect(second.ownerBranchId).toBe("branchB");
    expect(second.blockedByPendingOutbox).toBe(false);
    expect(await searchProductsFromCache("branchA", undefined)).toHaveLength(0);
  });

  it("bloquea la purga si la sucursal anterior tiene outbox pendiente", async () => {
    await resolveBranchScope("branchA", false);
    await enqueueSale({ ownerBranchId: "branchA", payload: {}, localTotal: 100 });

    const resolution = await resolveBranchScope("branchB", false);
    expect(resolution.blockedByPendingOutbox).toBe(true);
    expect(resolution.ownerBranchId).toBe("branchA");
  });

  it("usuario bypass sin sucursal fijada: offline deshabilitado", async () => {
    const resolution = await resolveBranchScope(null, true);
    expect(resolution.offlineEnabled).toBe(false);
  });

  it("usuario bypass fija sucursal de trabajo: offline queda habilitado para esa sucursal", async () => {
    await fixWorkingBranch("branchC");
    const resolution = await resolveBranchScope(null, true);
    expect(resolution.offlineEnabled).toBe(true);
    expect(resolution.ownerBranchId).toBe("branchC");
  });
});
