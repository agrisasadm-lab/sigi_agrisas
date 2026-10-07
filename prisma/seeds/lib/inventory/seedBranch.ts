import { upsertInventory } from "./inventoryWriter";
import { writeBasePriceTiers, writeBranchPriceIfDivergent } from "./priceWriter";
import { resolveAndUpsertProduct } from "./productWriter";
import type { BranchSeedPlan, PrismaLike, SeedContext } from "./types";

/** Único motor de siembra: procesa `plan.rows` según los flags del plan, con aislamiento try/catch por fila. */
export async function seedBranch(prisma: PrismaLike, plan: BranchSeedPlan, ctx: SeedContext): Promise<void> {
  // Resolución perezosa: si el plan no trae filas para esta corrida (ej. una tienda
  // sin productos en el batch actual), no se crea/toca la sucursal — mismo criterio
  // que el motor original (branchCache sólo se poblaba al procesar la primera fila
  // real de esa sucursal).
  if (plan.rows.length === 0) return;

  const branchId = await ctx.resolveBranchId(plan.branchCode);
  const matrizBranchId = await ctx.resolveBranchId("MATRIZ");

  const nameMatchState =
    plan.productMatch === "name"
      ? { nameIndex: await ctx.getNameIndex(), syntheticCodeOwners: new Map<string, string>() }
      : undefined;

  const logEvery = plan.productMatch === "name" ? 25 : 50;

  for (const [i, row] of plan.rows.entries()) {
    if (i % logEvery === 0) {
      console.log(`[seed:inventory-tiendas] ${plan.branchCode} ${i}/${plan.rows.length}`);
    }
    try {
      const resolved = await resolveAndUpsertProduct(prisma, ctx, row, plan, nameMatchState);
      if (!resolved) continue;

      const quantity = plan.quantitySource === "row" ? row.quantity ?? 0 : 0;
      await upsertInventory(prisma, ctx.counters, branchId, resolved.id, quantity);

      if (plan.priceMode === "base-tiers") {
        await writeBasePriceTiers(prisma, resolved.id, matrizBranchId, row.prices);
      } else {
        const price = row.prices[0]?.value;
        if (!price || price <= 0) {
          ctx.counters.emptyPriceRows++;
        } else {
          await writeBranchPriceIfDivergent(prisma, ctx.counters, resolved.id, branchId, plan.branchCode, matrizBranchId, price);
        }
      }
    } catch (err) {
      ctx.counters.errors.push({ context: row.sourceRef, message: String(err) });
    }
  }
}
