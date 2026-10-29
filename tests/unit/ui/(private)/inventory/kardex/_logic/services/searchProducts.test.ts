import { searchProducts } from "../../../../../../../../app/(private)/inventory/kardex/_logic/services/searchProducts";
import { NetworkError } from "../../../../../../../../app/_lib/authFetch";

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
    code: "NKS",
    name: "Producto de prueba",
    ...overrides,
  };
}

describe("searchProducts (kardex)", () => {
  it("no agrega branchId al query string cuando no se pasa (catálogo completo, caso 'Todos' intencional)", async () => {
    const fetch = mockFetch(200, { items: [], total: 0 });
    await searchProducts({ search: "NKS" }, fetch as never);

    const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("branchId=");
  });

  it("agrega branchId al query string cuando se pasa", async () => {
    const fetch = mockFetch(200, { items: [makeProductBody()], total: 1 });
    const result = await searchProducts({ search: "NKS", branchId: "branch-1" }, fetch as never);

    const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("branchId=branch-1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("prod-1");
  });

  it("lanza NetworkError si la respuesta no es ok", async () => {
    const fetch = mockFetch(500, {});
    await expect(searchProducts({ search: "NKS", branchId: "b1" }, fetch as never)).rejects.toBeInstanceOf(
      NetworkError
    );
  });
});
