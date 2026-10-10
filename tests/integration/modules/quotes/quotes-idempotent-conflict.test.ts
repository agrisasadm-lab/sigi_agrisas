/**
 * Integration test: idempotencia real de PrismaQuoteRepository.createWithItems bajo
 * conflicto de client_request_id — secuencial y concurrente (Promise.all real contra
 * el índice único de Postgres). El INSERT de `quotes` es crudo (`$executeRaw`), así
 * que el conflicto se manifiesta como Prisma `P2010`/`meta.code==="23505"`, no `P2002`
 * — ver TECH_DEBT_CHECKLIST.md §1-bis y
 * openspec/changes/fix-idempotent-sale-quote-retry/.
 *
 * NOTA: se llama al repositorio directo (createWithItems), no a CreateQuoteUseCase —
 * el use case ya hace su propio check-then-insert (replay secuencial, cubierto por
 * otros tests); este test ejercita la ventana de carrera que ese check no cubre.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaFolioRepository } from "@/modules/folios/infrastructure/repositories/PrismaFolioRepository";
import { PrismaQuoteRepository } from "@/modules/quotes/infrastructure/repositories/PrismaQuoteRepository";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import type { CreateQuoteData } from "@/modules/quotes/application/ports/QuoteRepository";

const P = "QUOTEIDEMP_";

async function cleanup() {
  await prisma.quoteItem.deleteMany({ where: { quote: { folio: { code: { startsWith: P } } } } });
  await prisma.quote.deleteMany({ where: { folio: { code: { startsWith: P } } } });
  await prisma.productPrice.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.product.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: P } } });
  await prisma.folio.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.branch.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.department.deleteMany({ where: { code: { startsWith: P } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

jest.setTimeout(60_000);

describe("PrismaQuoteRepository.createWithItems — idempotencia bajo conflicto de clientRequestId (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const folioRepo = new PrismaFolioRepository(prisma);
  const quoteRepo = new PrismaQuoteRepository(prisma);

  let branchId: string;
  let creatorId: string;
  let folioId: string;
  let productId: string;
  let priceId: string;
  const productCode = `${P}PROD1`;

  beforeAll(async () => {
    await cleanup();

    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal Idempotencia Cotizaciones" });
    branchId = branch.id;

    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio Idempotencia Cotizaciones", prefix: "QIDP", currentNumber: 0, scope: "POS" });
    folioId = folio.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Idempotencia Cotizaciones" });
    const product = await new CreateProductUseCase(productRepo, deptRepo).execute({
      code: productCode,
      name: "Producto Idempotencia Cotizaciones",
      unit: "u",
      departmentId: dept.id,
      ivaRate: 0.16,
    });
    productId = product.id;

    const price = await new CreateProductPriceUseCase(productRepo, priceRepo).execute(productId, {
      branchId,
      name: "Lista",
      price: 100,
      isDefault: true,
    });
    priceId = price.id;

    const creator = await prisma.user.create({
      data: { email: `${P}creator@test.com`, passwordHash: "test-hash", name: "Creador Idempotencia" },
    });
    creatorId = creator.id;
  });

  function buildQuoteData(clientRequestId: string, quantity: number): CreateQuoteData {
    const total = 100 * quantity;
    return {
      branchId,
      customerId: null,
      folioId,
      creatorId,
      notes: null,
      expiresAt: null,
      clientRequestId,
      subtotal: total,
      taxTotal: 0,
      total,
      items: [
        {
          productId,
          productPriceId: priceId,
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

  it("llamada secuencial repetida con el mismo clientRequestId devuelve la misma cotización sin lanzar (P2010/23505 absorbido)", async () => {
    const clientRequestId = randomUUID();

    const first = await quoteRepo.createWithItems(buildQuoteData(clientRequestId, 2));
    // Segunda llamada: NO pasa por el check-then-insert del use case (se llama al repo
    // directo), así que intenta el INSERT crudo real y choca con el constraint único.
    const second = await quoteRepo.createWithItems(buildQuoteData(clientRequestId, 2));

    expect(second.quote.id).toBe(first.quote.id);
    expect(second.quote.folioNumber).toBe(first.quote.folioNumber);

    const rows = await prisma.quote.findMany({ where: { clientRequestId } });
    expect(rows).toHaveLength(1);

    const items = await prisma.quoteItem.findMany({ where: { quoteId: first.quote.id } });
    expect(items).toHaveLength(1); // nunca 2 — sin filas duplicadas en quote_items
  });

  it("dos llamadas concurrentes (Promise.all) con el mismo clientRequestId resuelven a la misma cotización", async () => {
    const clientRequestId = randomUUID();

    const [a, b] = await Promise.all([
      quoteRepo.createWithItems(buildQuoteData(clientRequestId, 1)),
      quoteRepo.createWithItems(buildQuoteData(clientRequestId, 1)),
    ]);

    expect(a.quote.id).toBe(b.quote.id);

    const rows = await prisma.quote.findMany({ where: { clientRequestId } });
    expect(rows).toHaveLength(1);

    const items = await prisma.quoteItem.findMany({ where: { quoteId: a.quote.id } });
    expect(items).toHaveLength(1);
  });
});
