/**
 * Integration test: idempotencia real de PrismaSaleRepository.createCompleted bajo
 * conflicto de client_request_id — tanto secuencial (segunda llamada tras la primera
 * ya comprometida) como concurrente (Promise.all real contra el índice único de
 * Postgres). Ver TECH_DEBT_CHECKLIST.md §1-bis y
 * openspec/changes/fix-idempotent-sale-quote-retry/.
 *
 * NOTA: se llama al repositorio directo (createCompleted), no a CreateSaleUseCase —
 * el use case ya hace su propio check-then-insert (replay secuencial, cubierto por
 * otros tests); este test ejercita específicamente la ventana de carrera que ese
 * check no cubre, forzando el INSERT real a chocar con el constraint único.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaFolioRepository } from "@/modules/folios/infrastructure/repositories/PrismaFolioRepository";
import { PrismaPaymentMethodRepository } from "@/modules/payment-methods/infrastructure/repositories/PrismaPaymentMethodRepository";
import { PrismaSaleRepository } from "@/modules/pos/infrastructure/repositories/PrismaSaleRepository";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import type { CreateSaleData } from "@/modules/pos/application/ports/SaleRepository";

const P = "POSIDEMP_";

async function cleanup() {
  await prisma.sale.deleteMany({ where: { folio: { code: { startsWith: P } } } });
  await prisma.branchInventory.deleteMany({ where: { branch: { code: { startsWith: P } } } });
  await prisma.inventoryMovement.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.productPrice.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.product.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: P } } });
  await prisma.folio.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.paymentMethod.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.branch.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.department.deleteMany({ where: { code: { startsWith: P } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

jest.setTimeout(60_000);

describe("PrismaSaleRepository.createCompleted — idempotencia bajo conflicto de clientRequestId (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const folioRepo = new PrismaFolioRepository(prisma);
  const pmRepo = new PrismaPaymentMethodRepository(prisma);
  const saleRepo = new PrismaSaleRepository(prisma);

  let branchId: string;
  let cashierId: string;
  let folioId: string;
  let pmId: string;

  beforeAll(async () => {
    await cleanup();

    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal Idempotencia" });
    branchId = branch.id;

    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio Idempotencia", prefix: "IDP", currentNumber: 0, scope: "POS" });
    folioId = folio.id;

    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Idempotencia" });
    pmId = pm.id;

    const cashier = await prisma.user.create({
      data: { email: `${P}cashier@test.com`, passwordHash: "test-hash", name: "Cajero Idempotencia" },
    });
    cashierId = cashier.id;
  });

  /** Crea producto + precio + fila de branch_inventory dedicados, aislados por caso de prueba. */
  async function setUpProduct(code: string, initialQty: number) {
    const dept = await deptRepo.create({ code: `${P}${code}_DEPT`, name: `Dept ${code}` });
    const product = await new CreateProductUseCase(productRepo, deptRepo).execute({
      code: `${P}${code}`,
      name: `Producto ${code}`,
      unit: "u",
      departmentId: dept.id,
      ivaRate: 0.16,
    });
    const price = await new CreateProductPriceUseCase(productRepo, priceRepo).execute(product.id, {
      branchId,
      name: "Lista",
      price: 100,
      isDefault: true,
    });
    await prisma.branchInventory.create({ data: { branchId, productId: product.id, quantity: initialQty } });
    return { productId: product.id, priceId: price.id, productCode: `${P}${code}` };
  }

  function buildSaleData(
    clientRequestId: string,
    productId: string,
    priceId: string,
    productCode: string,
    quantity: number
  ): CreateSaleData {
    const total = 100 * quantity;
    return {
      branchId,
      customerId: null,
      cashierId,
      paymentMethodId: pmId,
      folioId,
      notes: null,
      clientRequestId,
      paidAmount: total,
      paymentStatus: "paid",
      subtotal: total,
      taxTotal: 0,
      total,
      items: [
        {
          productId,
          productPriceId: priceId,
          dosificationId: null,
          numPartsSnapshot: null,
          productCodeSnapshot: productCode,
          productNameSnapshot: "Producto",
          priceNameSnapshot: "Lista",
          quantity,
          unitPrice: 100,
          discountPct: null,
          discountAmount: 0,
          ivaRate: null,
          iepsRate: null,
          lineSubtotal: total,
          lineTax: 0,
          lineTotal: total,
        },
      ],
    };
  }

  it("llamada secuencial repetida con el mismo clientRequestId devuelve la misma venta sin lanzar, sin doble decremento", async () => {
    const { productId, priceId, productCode } = await setUpProduct("SEQ", 100);
    const clientRequestId = randomUUID();

    const first = await saleRepo.createCompleted(buildSaleData(clientRequestId, productId, priceId, productCode, 5));
    // Segunda llamada: NO pasa por el check-then-insert del use case (se llama al repo
    // directo), así que intenta un INSERT real y choca con el constraint único.
    const second = await saleRepo.createCompleted(buildSaleData(clientRequestId, productId, priceId, productCode, 5));

    expect(second.sale.id).toBe(first.sale.id);
    expect(second.sale.folioNumber).toBe(first.sale.folioNumber);

    const rows = await prisma.sale.findMany({ where: { clientRequestId } });
    expect(rows).toHaveLength(1);

    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(95); // 100 - 5, nunca 100 - 10
  });

  it("dos llamadas concurrentes (Promise.all) con el mismo clientRequestId resuelven a la misma venta, sin doble decremento", async () => {
    const { productId, priceId, productCode } = await setUpProduct("PAR", 100);
    const clientRequestId = randomUUID();

    const [a, b] = await Promise.all([
      saleRepo.createCompleted(buildSaleData(clientRequestId, productId, priceId, productCode, 3)),
      saleRepo.createCompleted(buildSaleData(clientRequestId, productId, priceId, productCode, 3)),
    ]);

    expect(a.sale.id).toBe(b.sale.id);

    const rows = await prisma.sale.findMany({ where: { clientRequestId } });
    expect(rows).toHaveLength(1);

    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(97); // 100 - 3, nunca 100 - 6 — la transacción perdedora hizo rollback completo
  });
});
