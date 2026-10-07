import path from "node:path";
import { existsSync } from "node:fs";
import * as dotenv from "dotenv";

const ENV_LOCAL = path.resolve(__dirname, "..", "..", ".env.local");
const ENV_FILE = path.resolve(__dirname, "..", "..", ".env");
if (existsSync(ENV_LOCAL)) {
  dotenv.config({ path: ENV_LOCAL });
} else if (existsSync(ENV_FILE)) {
  dotenv.config({ path: ENV_FILE });
}

import { PrismaClient } from "@prisma/client";
import { seedInventoryTiendas, printTiendasSeedReport, type PrismaLike } from "./lib/inventoryTiendasSeedLogic";
import { AGRISAS_REFRESH_DATA, TIENDAS_INVENTORY_DATA, TLAXIACO_RAW_DATA } from "./data/inventario-tiendas-v3";

// Conexión directa (sin pooler PgBouncer) — mismo patrón que `prisma/seed.ts`: esta
// corrida hace ~4 000 round-trips secuenciales sin transacción, carga larga para la
// que el pooler en modo transacción es problemático. Fallback a DATABASE_URL si
// DIRECT_URL no está definida, sin fallar al arrancar.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

/**
 * Adapter sobre PrismaClient real: sólo convierte `ProductPrice.price`
 * (Decimal en DB) a `number` en la lectura — es el único punto del lib
 * donde se compara un precio leído, resto de los métodos pasan tal cual.
 */
const prismaLike: PrismaLike = {
  branch: {
    findUnique: (args) => prisma.branch.findUnique(args as never) as never,
    upsert: (args) => prisma.branch.upsert(args as never) as never,
  },
  department: {
    upsert: (args) => prisma.department.upsert(args as never) as never,
  },
  product: {
    findUnique: (args) => prisma.product.findUnique(args as never) as never,
    findMany: (args) => prisma.product.findMany(args as never) as never,
    upsert: (args) => prisma.product.upsert(args as never) as never,
  },
  branchInventory: {
    upsert: (args) => prisma.branchInventory.upsert(args as never) as never,
    findMany: (args) => prisma.branchInventory.findMany(args as never) as never,
  },
  productPrice: {
    // Adapter sobre PrismaClient real: sólo convierte `price` (Decimal en DB) a `number`
    // en la lectura — `branchId` siempre es real (ninguna sucursal usa `null`).
    findFirst: async (args) => {
      const row = await prisma.productPrice.findFirst({ where: args.where as never, select: args.select as never });
      if (!row) return null;
      return { id: (row as { id: string }).id, price: Number((row as { price: unknown }).price) };
    },
    updateMany: (args) => prisma.productPrice.updateMany(args as never) as never,
    upsert: (args) => prisma.productPrice.upsert(args as never) as never,
  },
};

async function main(): Promise<void> {
  console.log(
    `[seed:inventory-tiendas] Datos embebidos: Agrisas=${AGRISAS_REFRESH_DATA.length}, Tiendas=${TIENDAS_INVENTORY_DATA.length}, Tlaxiaco=${TLAXIACO_RAW_DATA.length}`
  );

  const counters = await seedInventoryTiendas(prismaLike, {
    agrisas: AGRISAS_REFRESH_DATA,
    tiendas: TIENDAS_INVENTORY_DATA,
    tlaxiaco: TLAXIACO_RAW_DATA,
  });

  printTiendasSeedReport(counters);
}

main()
  .catch((err) => {
    console.error("[seed:inventory-tiendas] Error fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
