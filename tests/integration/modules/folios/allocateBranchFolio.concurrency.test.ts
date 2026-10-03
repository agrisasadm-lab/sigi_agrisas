/**
 * Integration test: concurrencia real de `allocateBranchFolio` (workstream A —
 * add-folio-branch-scope, gap encontrado en /opsx:verify). El requirement
 * "Concurrent documents from the same branch never collide" de admin-folios
 * depende de que `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` sea el único
 * punto de serialización — dos transacciones concurrentes para la MISMA
 * sucursal nunca deben leer el mismo `current_number` antes de incrementar.
 * Los tests de `folio-branch-counters.test.ts` cubren secuencial/independencia
 * por sucursal, pero no concurrencia real; este archivo cierra ese hueco.
 */
import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { allocateBranchFolio } from "@/shared/infrastructure/folios/allocateBranchFolio";

const P = "FOLCC_";

async function cleanup() {
  await prisma.folioBranchCounter.deleteMany({ where: { branch: { code: { startsWith: P } } } });
  await prisma.branch.deleteMany({ where: { code: { startsWith: P } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

jest.setTimeout(30_000);

describe("allocateBranchFolio — concurrencia real (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);

  let branchId: string;
  let tkFolioId: string;

  beforeAll(async () => {
    await cleanup();
    branchId = (await branchRepo.create({ code: `${P}A`, name: "Sucursal concurrencia" })).id;
    // "TK" es el único código real branch-scoped disponible sin violar el unique
    // constraint de folios.code (ver nota equivalente en folio-branch-counters.test.ts).
    const realTk = await prisma.folio.findFirstOrThrow({ where: { code: "TK" } });
    tkFolioId = realTk.id;
  });

  it("dos allocations concurrentes para la misma sucursal nunca colisionan", async () => {
    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        prisma.$transaction((tx) => allocateBranchFolio(tx, tkFolioId, branchId))
      )
    );

    const numbers = results.map((r) => r.folioNumber).sort((a, b) => a - b);
    const codes = new Set(results.map((r) => r.folioCode));

    expect(numbers).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    expect(codes.size).toBe(N);

    const counter = await prisma.folioBranchCounter.findUnique({
      where: { folioId_branchId: { folioId: tkFolioId, branchId } },
    });
    expect(counter!.currentNumber).toBe(N);
  });
});
