import { PrismaClient } from "@prisma/client";

export interface MissingPricePair {
  branchId: string;
  productId: string;
}

/**
 * Detecta pares `(branch_inventory)` activos sin ninguna fila en `product_prices`
 * para esa misma sucursal. Cada `ProductPrice` pertenece a exactamente una
 * sucursal (sin herencia desde otra) — un par sin fila deja ese producto
 * imposible de cobrar en esa sucursal. Ver `openspec/changes/fix-missing-branch-prices`.
 */
export async function findBranchInventoryPairsMissingPrice(
  prisma: PrismaClient
): Promise<MissingPricePair[]> {
  return prisma.$queryRaw<MissingPricePair[]>`
    SELECT bi.branch_id AS "branchId", bi.product_id AS "productId"
    FROM branch_inventory bi
    JOIN branches b ON b.id = bi.branch_id AND b.is_active = true
    JOIN products p ON p.id = bi.product_id AND p.is_active = true
    LEFT JOIN product_prices pp ON pp.product_id = bi.product_id AND pp.branch_id = bi.branch_id
    WHERE pp.id IS NULL
  `;
}
