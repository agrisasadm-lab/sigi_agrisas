import type { PrismaLike, TiendasSeedCounters } from "./types";

const DEFAULT_PRICE_NAME = "Precio Publico";
const PRICE_TOLERANCE = 0.005;

/** Sincroniza todos los tiers de precio de Matriz (branchId propio, como cualquier otra sucursal) — desmarca el default previo primero. */
export async function writeBasePriceTiers(
  prisma: PrismaLike,
  productId: string,
  matrizBranchId: string,
  tiers: Array<{ tierName: string; value: number; isDefault?: boolean }>
): Promise<void> {
  await prisma.productPrice.updateMany({
    where: { productId, branchId: matrizBranchId, isDefault: true },
    data: { isDefault: false },
  });
  for (const tier of tiers) {
    await prisma.productPrice.upsert({
      where: { productId_branchId_name: { productId, branchId: matrizBranchId, name: tier.tierName } },
      create: { productId, branchId: matrizBranchId, name: tier.tierName, price: tier.value, isDefault: !!tier.isDefault, minQuantity: 1 },
      update: { price: tier.value, isDefault: !!tier.isDefault },
    });
  }
}

/** Precio branch-scoped condicional: no crea precio propio si coincide con el de Matriz dentro de tolerancia. */
export async function writeBranchPriceIfDivergent(
  prisma: PrismaLike,
  counters: TiendasSeedCounters,
  productId: string,
  branchId: string,
  branchCode: string,
  matrizBranchId: string,
  price: number
): Promise<void> {
  const matrizPrice = await prisma.productPrice.findFirst({
    where: { productId, branchId: matrizBranchId, name: DEFAULT_PRICE_NAME },
    select: { id: true, price: true },
  });
  if (matrizPrice && Math.abs(matrizPrice.price - price) < PRICE_TOLERANCE) return; // igual al de Matriz, no crea fila propia

  await prisma.productPrice.upsert({
    where: { productId_branchId_name: { productId, branchId, name: DEFAULT_PRICE_NAME } },
    create: { productId, branchId, name: DEFAULT_PRICE_NAME, price, isDefault: true, minQuantity: 1 },
    update: { price, isDefault: true },
  });
  counters.priceOverridesByBranch[branchCode] = (counters.priceOverridesByBranch[branchCode] ?? 0) + 1;
}
