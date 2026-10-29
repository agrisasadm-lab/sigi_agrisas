import { searchProducts } from "../../../../../../app/(private)/payments/_logic/services/searchProducts";
import { NetworkError } from "../../../../../../app/_lib/authFetch";

function mockFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function makeProductBody(overrides: Record<string, unknown> = {}) {
  return { id: "prod-1", code: "PROD001", name: "Producto de prueba", ...overrides };
}

describe("searchProducts (payments)", () => {
  it("devuelve la lista de productos en éxito 200", async () => {
    const body = { items: [makeProductBody()], total: 1 };
    const fetch = mockFetch(200, body);
    const result = await searchProducts({}, fetch as never);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("prod-1");
    expect(result.items[0].code).toBe("PROD001");
  });

  it("mapea respuesta no-ok a NetworkError", async () => {
    const fetch = mockFetch(500, { error: "Internal Server Error" });
    await expect(searchProducts({}, fetch as never)).rejects.toBeInstanceOf(NetworkError);
  });

  it("lanza NetworkError en fallo de red", async () => {
    const fetch = jest.fn().mockRejectedValue(new Error("network failure"));
    await expect(searchProducts({}, fetch as never)).rejects.toBeInstanceOf(NetworkError);
  });

  it("relanza AbortError sin envolver en NetworkError", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetch = jest.fn().mockRejectedValue(abortError);
    await expect(searchProducts({}, fetch as never)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("incluye search en la URL cuando se pasa", async () => {
    const fetch = mockFetch(200, { items: [], total: 0 });
    await searchProducts({ search: "flor" }, fetch as never);
    expect((fetch as jest.Mock).mock.calls[0][0] as string).toContain("search=flor");
  });

  it("no incluye search en la URL cuando es cadena vacía", async () => {
    const fetch = mockFetch(200, { items: [], total: 0 });
    await searchProducts({ search: "   " }, fetch as never);
    expect((fetch as jest.Mock).mock.calls[0][0] as string).not.toContain("search=");
  });

  it("siempre incluye includeInactive=false en la URL", async () => {
    const fetch = mockFetch(200, { items: [], total: 0 });
    await searchProducts({}, fetch as never);
    expect((fetch as jest.Mock).mock.calls[0][0] as string).toContain("includeInactive=false");
  });

  it("no agrega branchId al query string cuando no se pasa", async () => {
    const fetch = mockFetch(200, { items: [], total: 0 });
    await searchProducts({ search: "flor" }, fetch as never);
    expect((fetch as jest.Mock).mock.calls[0][0] as string).not.toContain("branchId=");
  });

  it("agrega branchId al query string cuando se pasa", async () => {
    const fetch = mockFetch(200, { items: [makeProductBody()], total: 1 });
    const result = await searchProducts({ search: "flor", branchId: "branch-1" }, fetch as never);
    expect((fetch as jest.Mock).mock.calls[0][0] as string).toContain("branchId=branch-1");
    expect(result.items).toHaveLength(1);
  });
});
