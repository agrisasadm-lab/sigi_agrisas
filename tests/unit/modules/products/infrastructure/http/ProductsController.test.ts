jest.mock("@/modules/rbac/infrastructure/di/container", () => ({
  rbacContainer: {
    authorizationService: {
      userCan: jest.fn().mockResolvedValue(false),
      listUserPermissions: jest.fn().mockResolvedValue([]),
      invalidate: jest.fn(),
      invalidateByRole: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

import { NextRequest } from "next/server";
import { rbacContainer } from "@/modules/rbac/infrastructure/di/container";
import { ProductsController } from "@/modules/products/infrastructure/http/ProductsController";
import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryDepartmentRepository } from "@/modules/departments/infrastructure/repositories/InMemoryDepartmentRepository";
import { ListProductsUseCase } from "@/modules/products/application/use-cases/ListProductsUseCase";
import { GetProductUseCase } from "@/modules/products/application/use-cases/GetProductUseCase";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { UpdateProductUseCase } from "@/modules/products/application/use-cases/UpdateProductUseCase";
import { SoftDeleteProductUseCase } from "@/modules/products/application/use-cases/SoftDeleteProductUseCase";
import { UploadProductImageUseCase } from "@/modules/products/application/use-cases/UploadProductImageUseCase";
import { DeleteProductImageUseCase } from "@/modules/products/application/use-cases/DeleteProductImageUseCase";
import { InMemoryBranchInventoryRepository } from "@/modules/inventory/infrastructure/repositories/InMemoryBranchInventoryRepository";

const noopStorage = {
  upload: jest.fn().mockResolvedValue("https://example.supabase.co/storage/v1/object/public/product-images/test.jpg"),
  delete: jest.fn().mockResolvedValue(undefined),
};

async function buildController(branchInventoryRepo?: InMemoryBranchInventoryRepository) {
  const productRepo = new InMemoryProductRepository();
  productRepo.reset();
  const deptRepo = new InMemoryDepartmentRepository();
  const dept = await deptRepo.create({ code: "DEPT1", name: "Abarrotes" });
  const ctrl = new ProductsController(
    new ListProductsUseCase(productRepo),
    new GetProductUseCase(productRepo),
    new CreateProductUseCase(productRepo, deptRepo, undefined, branchInventoryRepo),
    new UpdateProductUseCase(productRepo, deptRepo),
    new SoftDeleteProductUseCase(productRepo),
    new UploadProductImageUseCase(productRepo, noopStorage),
    new DeleteProductImageUseCase(productRepo, noopStorage),
  );
  return { ctrl, departmentId: dept.id, productRepo };
}

function makeCreateReq(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/v1/admin/products", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function makeListReq(params: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/v1/admin/products");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { headers });
}

describe("ProductsController — Zod validation", () => {
  // Estas pruebas asumen modo general (sin auth headers en makeListReq) — forzar el
  // modo aquí evita que hereden INVENTORY_SCOPE_MODE del proceso (ver task 6.2 del
  // change inventory-branch-scope-mode, que corre la suite con la env var en "branch").
  const originalMode = process.env.INVENTORY_SCOPE_MODE;
  beforeAll(() => { delete process.env.INVENTORY_SCOPE_MODE; });
  afterAll(() => {
    if (originalMode === undefined) delete process.env.INVENTORY_SCOPE_MODE;
    else process.env.INVENTORY_SCOPE_MODE = originalMode;
  });

  it("rejects an invalid code format", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(makeCreateReq({ code: "arroz 001!", name: "Arroz", unit: "kg", departmentId }));
    expect(res.status).toBe(400);
  });

  it("normalizes code to uppercase", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(makeCreateReq({ code: "arroz_001", name: "Arroz", unit: "kg", departmentId }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBe("ARROZ_001");
  });

  it("rejects a non-UUID departmentId", async () => {
    const { ctrl } = await buildController();
    const res = await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/departmentId/i);
  });

  it("rejects an out-of-range ivaRate", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId, ivaRate: 200 }));
    expect(res.status).toBe(400);
  });

  it("normalizes a percentage ivaRate (16) to a decimal (0.16)", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId, ivaRate: 16 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ivaRate).toBeCloseTo(0.16, 10);
  });

  it("rejects an invalid satProductCode format", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId, satProductCode: "ABC123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/satProductCode/i);
  });

  it("rejects a search shorter than 2 characters", async () => {
    const { ctrl } = await buildController();
    const res = await ctrl.list(makeListReq({ search: "a" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/search/i);
  });

  it("rejects pageSize over the maximum", async () => {
    const { ctrl } = await buildController();
    const res = await ctrl.list(makeListReq({ pageSize: "200" }));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid branchId format", async () => {
    const { ctrl } = await buildController();
    const res = await ctrl.list(makeListReq({ branchId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("includes stock:null in every item when branchId is omitted", async () => {
    const { ctrl, departmentId } = await buildController();
    await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }));
    const res = await ctrl.list(makeListReq({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((p: { stock: number | null }) => p.stock === null)).toBe(true);
  });

  it("rejects isTaxable when value is not a boolean (string 'yes')", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(
      new NextRequest("http://localhost/api/v1/admin/products", {
        method: "POST",
        body: JSON.stringify({ code: "P1", name: "Arroz", unit: "kg", departmentId, isTaxable: "yes" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("persists isTaxable=true via PATCH", async () => {
    const { ctrl, departmentId } = await buildController();
    const createRes = await ctrl.create(makeCreateReq({ code: "P2", name: "Azúcar", unit: "kg", departmentId }));
    expect(createRes.status).toBe(201);
    const { id } = await createRes.json();

    const patchRes = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isTaxable: true }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.isTaxable).toBe(true);
  });

  it("persists manufactureDate on creation", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(
      makeCreateReq({ code: "P3", name: "Fertilizante", unit: "kg", departmentId, manufactureDate: "2026-01-15" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.manufactureDate).toBe("2026-01-15");
  });

  it("defaults manufactureDate to null when omitted on creation", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(makeCreateReq({ code: "P4", name: "Fertilizante", unit: "kg", departmentId }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.manufactureDate).toBeNull();
  });

  it("rejects an invalid manufactureDate format", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(
      makeCreateReq({ code: "P5", name: "Fertilizante", unit: "kg", departmentId, manufactureDate: "15-01-2026" })
    );
    expect(res.status).toBe(400);
  });

  it("sets and clears manufactureDate via PATCH", async () => {
    const { ctrl, departmentId } = await buildController();
    const createRes = await ctrl.create(makeCreateReq({ code: "P6", name: "Fertilizante", unit: "kg", departmentId }));
    const { id } = await createRes.json();

    const setRes = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ manufactureDate: "2026-02-01" }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(setRes.status).toBe(200);
    expect((await setRes.json()).manufactureDate).toBe("2026-02-01");

    const clearRes = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ manufactureDate: null }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(clearRes.status).toBe(200);
    expect((await clearRes.json()).manufactureDate).toBeNull();
  });

  it("accepts a valid acquisitionPrice on creation", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(
      makeCreateReq({ code: "P7", name: "Semilla", unit: "kg", departmentId, acquisitionPrice: 45.5 })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.acquisitionPrice).toBe(45.5);
  });

  it("defaults acquisitionPrice to null when omitted on creation", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(makeCreateReq({ code: "P8", name: "Semilla", unit: "kg", departmentId }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.acquisitionPrice).toBeNull();
  });

  it("rejects a negative acquisitionPrice on creation", async () => {
    const { ctrl, departmentId } = await buildController();
    const res = await ctrl.create(
      makeCreateReq({ code: "P9", name: "Semilla", unit: "kg", departmentId, acquisitionPrice: -1 })
    );
    expect(res.status).toBe(400);
  });

  it("sets and clears acquisitionPrice via PATCH", async () => {
    const { ctrl, departmentId } = await buildController();
    const createRes = await ctrl.create(makeCreateReq({ code: "P10", name: "Semilla", unit: "kg", departmentId }));
    const { id } = await createRes.json();

    const setRes = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionPrice: 52.3 }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(setRes.status).toBe(200);
    expect((await setRes.json()).acquisitionPrice).toBe(52.3);

    const clearRes = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionPrice: null }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(clearRes.status).toBe(200);
    expect((await clearRes.json()).acquisitionPrice).toBeNull();
  });

  it("rejects a negative acquisitionPrice on PATCH", async () => {
    const { ctrl, departmentId } = await buildController();
    const createRes = await ctrl.create(makeCreateReq({ code: "P11", name: "Semilla", unit: "kg", departmentId }));
    const { id } = await createRes.json();

    const res = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ acquisitionPrice: -5 }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(res.status).toBe(400);
  });

  it("accepts a real Supabase bucket imageUrl on PATCH", async () => {
    const { ctrl, departmentId } = await buildController();
    const createRes = await ctrl.create(makeCreateReq({ code: "P12", name: "Producto", unit: "kg", departmentId }));
    const { id } = await createRes.json();

    const res = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          imageUrl: "https://example.supabase.co/storage/v1/object/public/product-images/foo.jpg",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).imageUrl).toBe(
      "https://example.supabase.co/storage/v1/object/public/product-images/foo.jpg"
    );
  });

  it("rejects an imageUrl on a foreign host that merely embeds the expected path as a substring", async () => {
    const { ctrl, departmentId } = await buildController();
    const createRes = await ctrl.create(makeCreateReq({ code: "P13", name: "Producto", unit: "kg", departmentId }));
    const { id } = await createRes.json();

    const res = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          imageUrl:
            "https://attacker.com/x?y=example.supabase.co/storage/v1/object/public/product-images/foo.jpg",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(res.status).toBe(400);
  });

  it("rejects an imageUrl on the right host but the wrong path", async () => {
    const { ctrl, departmentId } = await buildController();
    const createRes = await ctrl.create(makeCreateReq({ code: "P14", name: "Producto", unit: "kg", departmentId }));
    const { id } = await createRes.json();

    const res = await ctrl.update(
      new NextRequest(`http://localhost/api/v1/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ imageUrl: "https://example.supabase.co/some/other/path/foo.jpg" }),
        headers: { "Content-Type": "application/json" },
      }),
      id,
    );
    expect(res.status).toBe(400);
  });
});

describe("ProductsController.list — branch scope mode", () => {
  const userCanMock = rbacContainer.authorizationService.userCan as jest.Mock;
  const BRANCH_A = "55555555-5555-5555-5555-555555555555";
  const BRANCH_B = "66666666-6666-6666-6666-666666666666";
  const USER_ID = "77777777-7777-7777-7777-777777777777";
  const originalMode = process.env.INVENTORY_SCOPE_MODE;

  beforeEach(() => {
    userCanMock.mockReset();
    userCanMock.mockResolvedValue(false);
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.INVENTORY_SCOPE_MODE;
    else process.env.INVENTORY_SCOPE_MODE = originalMode;
  });

  it("general mode (default): branchId does not filter, and does not require auth headers", async () => {
    delete process.env.INVENTORY_SCOPE_MODE;
    const { ctrl, departmentId } = await buildController();
    await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }));
    const res = await ctrl.list(makeListReq({ branchId: BRANCH_A }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
  });

  it("branch mode: unauthenticated request (no x-user-id) is rejected", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    const { ctrl } = await buildController();
    const res = await ctrl.list(makeListReq({ branchId: BRANCH_A }));
    expect(res.status).toBe(401);
  });

  it("branch mode: operator without branches:access_all sees the full catalog when branchId is omitted", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(false);
    const { ctrl, departmentId } = await buildController();
    const created = await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }));
    const { id: productId } = await created.json();

    const res = await ctrl.list(makeListReq({}, { "x-user-id": USER_ID, "x-user-branch-id": BRANCH_A }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Sin branchId explícito, el catálogo NO se filtra por sucursal aunque el
    // caller no tenga fila de inventario en BRANCH_A (su sucursal)
    expect(body.total).toBe(1);
    expect(body.items.find((p: { id: string }) => p.id === productId)).toBeDefined();
  });

  it("branch mode: operator without branches:access_all requesting a different branchId is rejected (not silently overridden)", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(false);
    const { ctrl } = await buildController();

    const res = await ctrl.list(
      makeListReq({ branchId: BRANCH_B }, { "x-user-id": USER_ID, "x-user-branch-id": BRANCH_A })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("branches:access_all");
  });

  it("branch mode: operator without an assigned branch still sees the full catalog when branchId is omitted", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(false);
    const { ctrl, departmentId } = await buildController();
    await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }));
    const res = await ctrl.list(makeListReq({}, { "x-user-id": USER_ID, "x-user-branch-id": "" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
  });

  it("branch mode: excludes products without a branch_inventory row", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(false);
    const { ctrl, departmentId, productRepo } = await buildController();
    const created = await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }));
    const { id: productId } = await created.json();
    productRepo.setStock(BRANCH_A, productId, 0);
    await ctrl.create(makeCreateReq({ code: "P2", name: "Frijol", unit: "kg", departmentId }));

    const res = await ctrl.list(
      makeListReq({ branchId: BRANCH_A }, { "x-user-id": USER_ID, "x-user-branch-id": BRANCH_A })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(productId);
    expect(body.items[0].stock).toBe(0);
  });

  it("branch mode: admin with branches:access_all and no branchId sees the full catalog", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(true);
    const { ctrl, departmentId } = await buildController();
    await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }));
    await ctrl.create(makeCreateReq({ code: "P2", name: "Frijol", unit: "kg", departmentId }));

    const res = await ctrl.list(makeListReq({}, { "x-user-id": USER_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
  });

  it("branch mode: explicit branchId matching own branch still filters correctly", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(false);
    const { ctrl, departmentId, productRepo } = await buildController();
    const created = await ctrl.create(makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }));
    const { id: assignedId } = await created.json();
    productRepo.setStock(BRANCH_A, assignedId, 10);
    await ctrl.create(makeCreateReq({ code: "P2", name: "Frijol", unit: "kg", departmentId }));

    const res = await ctrl.list(
      makeListReq({ branchId: BRANCH_A }, { "x-user-id": USER_ID, "x-user-branch-id": BRANCH_A })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(assignedId);
    expect(body.items[0].stock).toBe(10);
  });
});

describe("ProductsController.create — branch auto-assign", () => {
  const userCanMock = rbacContainer.authorizationService.userCan as jest.Mock;
  const BRANCH_A = "55555555-5555-5555-5555-555555555555";
  const USER_ID = "77777777-7777-7777-7777-777777777777";
  const originalMode = process.env.INVENTORY_SCOPE_MODE;

  beforeEach(() => {
    userCanMock.mockReset();
    userCanMock.mockResolvedValue(false);
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.INVENTORY_SCOPE_MODE;
    else process.env.INVENTORY_SCOPE_MODE = originalMode;
  });

  it("branch mode: operator without branches:access_all with x-user-branch-id auto-assigns the product to their branch", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(false);
    const branchInventoryRepo = new InMemoryBranchInventoryRepository();
    const { ctrl, departmentId } = await buildController(branchInventoryRepo);

    const res = await ctrl.create(
      makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }, { "x-user-id": USER_ID, "x-user-branch-id": BRANCH_A })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.autoAssignedBranchId).toBe(BRANCH_A);

    const view = await branchInventoryRepo.findByBranchAndProduct(BRANCH_A, body.id);
    expect(view).not.toBeNull();
    expect(view?.inventory.quantity).toBe(0);
  });

  it("branch mode: admin (branches:access_all) does not trigger auto-assignment", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(true);
    const branchInventoryRepo = new InMemoryBranchInventoryRepository();
    const { ctrl, departmentId } = await buildController(branchInventoryRepo);

    const res = await ctrl.create(
      makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }, { "x-user-id": USER_ID, "x-user-branch-id": BRANCH_A })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.autoAssignedBranchId).toBeNull();

    const view = await branchInventoryRepo.findByBranchAndProduct(BRANCH_A, body.id);
    expect(view).toBeNull();
  });

  it("branch mode: operator without branches:access_all and without an assigned branch does not trigger auto-assignment", async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    userCanMock.mockResolvedValue(false);
    const branchInventoryRepo = new InMemoryBranchInventoryRepository();
    const { ctrl, departmentId } = await buildController(branchInventoryRepo);

    const res = await ctrl.create(
      makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }, { "x-user-id": USER_ID, "x-user-branch-id": "" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.autoAssignedBranchId).toBeNull();
  });

  it("general mode: never auto-assigns even with an operator branch in headers", async () => {
    delete process.env.INVENTORY_SCOPE_MODE;
    userCanMock.mockResolvedValue(false);
    const branchInventoryRepo = new InMemoryBranchInventoryRepository();
    const { ctrl, departmentId } = await buildController(branchInventoryRepo);

    const res = await ctrl.create(
      makeCreateReq({ code: "P1", name: "Arroz", unit: "kg", departmentId }, { "x-user-id": USER_ID, "x-user-branch-id": BRANCH_A })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.autoAssignedBranchId).toBeNull();

    const view = await branchInventoryRepo.findByBranchAndProduct(BRANCH_A, body.id);
    expect(view).toBeNull();
  });
});
