import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaProductDosificationRepository } from "@/modules/products/infrastructure/repositories/PrismaProductDosificationRepository";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { UpdateProductUseCase } from "@/modules/products/application/use-cases/UpdateProductUseCase";
import { ListProductsUseCase } from "@/modules/products/application/use-cases/ListProductsUseCase";
import { SoftDeleteProductUseCase } from "@/modules/products/application/use-cases/SoftDeleteProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { CreateProductDosificationUseCase } from "@/modules/products/application/use-cases/CreateProductDosificationUseCase";
import { ListProductDosificationsUseCase } from "@/modules/products/application/use-cases/ListProductDosificationsUseCase";
import { PrismaPricingSettingsRepository } from "@/modules/settings/infrastructure/repositories/PrismaPricingSettingsRepository";

const PCODE = "PRODTEST_PROD_1";
const DCODE = "PRODTEST_DEPT_1";
const BCODE = "PRODTEST_BR_1";

async function cleanup() {
  await prisma.product.deleteMany({ where: { code: { startsWith: "PRODTEST_" } } });
  await prisma.department.deleteMany({ where: { code: { startsWith: "PRODTEST_" } } });
  await prisma.branch.deleteMany({ where: { code: { startsWith: "PRODTEST_" } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("Products CRUD — integration (real DB)", () => {
  const departmentRepo = new PrismaDepartmentRepository(prisma);
  const branchRepo = new PrismaBranchRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const dosificationRepo = new PrismaProductDosificationRepository(prisma);
  const pricingSettingsRepo = new PrismaPricingSettingsRepository(prisma);

  const createProduct = new CreateProductUseCase(productRepo, departmentRepo);
  const updateProduct = new UpdateProductUseCase(productRepo, departmentRepo);
  const listProducts = new ListProductsUseCase(productRepo);
  const softDeleteProduct = new SoftDeleteProductUseCase(productRepo);
  const createPrice = new CreateProductPriceUseCase(productRepo, priceRepo, branchRepo);
  const createDosification = new CreateProductDosificationUseCase(productRepo, priceRepo, dosificationRepo, pricingSettingsRepo);
  const listDosifications = new ListProductDosificationsUseCase(productRepo, priceRepo, dosificationRepo, pricingSettingsRepo);

  let departmentId: string;
  let branchId: string;
  let productId: string;

  beforeAll(async () => {
    await cleanup();
    const dept = await departmentRepo.create({ code: DCODE, name: "Departamento Integración" });
    departmentId = dept.id;
    const branch = await branchRepo.create({ code: BCODE, name: "Sucursal Integración" });
    branchId = branch.id;
  });

  it("creates a product", async () => {
    const product = await createProduct.execute({ code: PCODE, name: "Producto Integración", unit: "kg", departmentId });
    productId = product.id;
    expect(product.code).toBe(PCODE);
    expect(product.departmentName).toBe("Departamento Integración");
    expect(product.isActive).toBe(true);
  });

  it("adds two prices (one default)", async () => {
    const def = await createPrice.execute(productId, { branchId, name: "Menudeo", price: 100, isDefault: true });
    const bulk = await createPrice.execute(productId, { branchId, name: "Mayoreo", price: 80, minQuantity: 10 });
    expect(def.isDefault).toBe(true);
    expect(bulk.isDefault).toBe(false);
  });

  it("adds a dosification and computes its unit price using the default price", async () => {
    await createDosification.execute(productId, branchId, { name: "Por dosis", numParts: 10 });
    const result = await listDosifications.execute(productId, branchId);
    const dose = result.items.find((d) => d.name === "Por dosis");
    expect(dose).toBeDefined();
    expect(dose?.requiresDefaultPrice).toBe(false);
    expect(dose?.computedUnitPrice).toBeCloseTo(10.5, 6);
  });

  it("updates the product name", async () => {
    const updated = await updateProduct.execute(productId, { name: "Producto Editado" });
    expect(updated.name).toBe("Producto Editado");
  });

  it("soft deletes the product (disappears from active list)", async () => {
    await softDeleteProduct.execute(productId);
    const result = await listProducts.execute({ page: 1, pageSize: 100, includeInactive: false });
    expect(result.items.find((p) => p.id === productId)).toBeUndefined();
  });

  it("shows the inactive product with includeInactive=true", async () => {
    const result = await listProducts.execute({ page: 1, pageSize: 100, includeInactive: true });
    const found = result.items.find((p) => p.id === productId);
    expect(found).toBeDefined();
    expect(found?.isActive).toBe(false);
  });
});
