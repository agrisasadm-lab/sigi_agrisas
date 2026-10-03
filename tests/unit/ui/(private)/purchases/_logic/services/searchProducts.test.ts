import { searchProducts } from "../../../../../../../app/(private)/purchases/_logic/services/searchProducts";
import { NetworkError } from "../../../../../../../app/_lib/authFetch";

function mockFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function makeProductBody(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-1",
    code: "PROD001",
    name: "Producto de prueba",
    unit: "PZA",
    ivaRate: 0.16,
    iepsRate: null,
    isActive: true,
    ...overrides,
  };
}

describe("searchProducts (purchases)", () => {
  it("no agrega branchId al query string cuando no se pasa", async () => {
    const fetch = mockFetch(200, { items: [], total: 0 });
    await searchProducts({ search: "AMK" }, fetch as never);

    const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("branchId=");
  });

  it("agrega branchId al query string cuando se pasa", async () => {
    const fetch = mockFetch(200, { items: [makeProductBody()], total: 1 });
    const result = await searchProducts({ search: "AMK", branchId: "branch-zarioz" }, fetch as never);

    const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("branchId=branch-zarioz");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("prod-1");
  });

  it("lanza NetworkError si la respuesta no es ok", async () => {
    const fetch = mockFetch(500, {});
    await expect(searchProducts({ search: "AMK", branchId: "b1" }, fetch as never)).rejects.toBeInstanceOf(NetworkError);
  });

  it("devuelve items vacíos cuando ningún producto de la sucursal coincide con la búsqueda", async () => {
    const fetch = mockFetch(200, { items: [], total: 0 });
    const result = await searchProducts({ search: "NOMATCH", branchId: "branch-zarioz" }, fetch as never);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
