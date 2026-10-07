import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { findBranchInventoryPairsMissingPrice } from "@/shared/infrastructure/inventory/findBranchInventoryPairsMissingPrice";

const DCODE = "PRICECOV_DEPT_1";
const PCODE_COVERED = "PRICECOV_PROD_OK";
const PCODE_GAP = "PRICECOV_PROD_GAP";
const PCODE_INACTIVE = "PRICECOV_PROD_INACTIVE";
const BCODE_OK = "PRICECOV_BR_OK";
const BCODE_GAP = "PRICECOV_BR_GAP";
const BCODE_INACTIVE = "PRICECOV_BR_INACTIVE";

async function cleanup() {
  await prisma.product.deleteMany({ where: { code: { startsWith: "PRICECOV_" } } });
  await prisma.branch.deleteMany({ where: { code: { startsWith: "PRICECOV_" } } });
  await prisma.department.deleteMany({ where: { code: { startsWith: "PRICECOV_" } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("Branch price coverage guardrail — integration (real DB)", () => {
  const departmentRepo = new PrismaDepartmentRepository(prisma);
  const branchRepo = new PrismaBranchRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const createProduct = new CreateProductUseCase(productRepo, departmentRepo);

  let departmentId: string;
  let branchOkId: string;
  let branchGapId: string;
  let branchInactiveId: string;
  let productCoveredId: string;
  let productGapId: string;
  let productInactiveId: string;

  beforeAll(async () => {
    await cleanup();

    const dept = await departmentRepo.create({ code: DCODE, name: "Depto cobertura precios" });
    departmentId = dept.id;

    const branchOk = await branchRepo.create({ code: BCODE_OK, name: "Sucursal con cobertura" });
    branchOkId = branchOk.id;
    const branchGap = await branchRepo.create({ code: BCODE_GAP, name: "Sucursal con hueco" });
    branchGapId = branchGap.id;
    const branchInactive = await branchRepo.create({ code: BCODE_INACTIVE, name: "Sucursal inactiva" });
    branchInactiveId = branchInactive.id;
    await branchRepo.update(branchInactiveId, { isActive: false });

    const productCovered = await createProduct.execute({
      code: PCODE_COVERED,
      name: "Producto con precio en todas sus sucursales",
      unit: "kg",
      departmentId,
    });
    productCoveredId = productCovered.id;

    const productGap = await createProduct.execute({
      code: PCODE_GAP,
      name: "Producto sin precio en una sucursal",
      unit: "kg",
      departmentId,
    });
    productGapId = productGap.id;

    const productInactive = await createProduct.execute({
      code: PCODE_INACTIVE,
      name: "Producto inactivo sin precio",
      unit: "kg",
      departmentId,
    });
    productInactiveId = productInactive.id;
    await productRepo.update(productInactiveId, { isActive: false });

    // Producto cubierto: inventario + precio en branchOk -> no debe reportarse.
    await prisma.branchInventory.create({
      data: { branchId: branchOkId, productId: productCoveredId, quantity: 10 },
    });
    await prisma.productPrice.create({
      data: { branchId: branchOkId, productId: productCoveredId, name: "Precio Publico", price: 100, isDefault: true },
    });

    // Producto con hueco real: inventario en branchGap, SIN precio -> debe reportarse.
    await prisma.branchInventory.create({
      data: { branchId: branchGapId, productId: productGapId, quantity: 5 },
    });

    // Producto/sucursal inactivos con el mismo hueco -> NO deben reportarse.
    await prisma.branchInventory.create({
      data: { branchId: branchInactiveId, productId: productGapId, quantity: 5 },
    });
    await prisma.branchInventory.create({
      data: { branchId: branchOkId, productId: productInactiveId, quantity: 5 },
    });
  });

  it("does not report a pair that already has its own branch price", async () => {
    const pairs = await findBranchInventoryPairsMissingPrice(prisma);
    const found = pairs.find((p) => p.branchId === branchOkId && p.productId === productCoveredId);
    expect(found).toBeUndefined();
  });

  it("reports a branch_inventory pair with no matching product_prices row", async () => {
    const pairs = await findBranchInventoryPairsMissingPrice(prisma);
    const found = pairs.find((p) => p.branchId === branchGapId && p.productId === productGapId);
    expect(found).toEqual({ branchId: branchGapId, productId: productGapId });
  });

  it("excludes pairs belonging to an inactive branch", async () => {
    const pairs = await findBranchInventoryPairsMissingPrice(prisma);
    const found = pairs.find((p) => p.branchId === branchInactiveId);
    expect(found).toBeUndefined();
  });

  it("excludes pairs belonging to an inactive product", async () => {
    const pairs = await findBranchInventoryPairsMissingPrice(prisma);
    const found = pairs.find((p) => p.productId === productInactiveId);
    expect(found).toBeUndefined();
  });
});
