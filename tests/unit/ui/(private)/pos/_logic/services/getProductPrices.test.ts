import { getProductPrices } from "../../../../../../../app/(private)/pos/_logic/services/getProductPrices";
import { NetworkError } from "../../../../../../../app/_lib/authFetch";

function mockFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function makePrice(name: string, isDefault: boolean) {
  return { id: name, productId: "p1", branchId: "branch-1", name, price: 100, minQuantity: 1, discountPct: null, isDefault };
}

describe("getProductPrices", () => {
  it("preserva el orden que entrega la API, sin reordenar en cliente", async () => {
    const items = [
      makePrice("Precio Publico", true),
      makePrice("Precio Subdis 10%", false),
      makePrice("Precio Distri 15%", false),
      makePrice("Precio 4", false),
    ];
    const fetchImpl = mockFetch(200, { items });

    const result = await getProductPrices("p1", "branch-1", fetchImpl);

    expect(result.map((p) => p.name)).toEqual([
      "Precio Publico",
      "Precio Subdis 10%",
      "Precio Distri 15%",
      "Precio 4",
    ]);
  });

  it("throws NetworkError on non-ok response", async () => {
    const fetchImpl = mockFetch(500, {});
    await expect(getProductPrices("p1", "branch-1", fetchImpl)).rejects.toThrow(NetworkError);
  });

  it("dispatches ?branchId= when a branch is given", async () => {
    const fetchImpl = mockFetch(200, { items: [] });
    await getProductPrices("p1", "branch-1", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/admin/products/p1/prices?branchId=branch-1");
  });

  it("returns an empty list without calling fetch when branchId is missing", async () => {
    const fetchImpl = mockFetch(200, { items: [] });
    const result = await getProductPrices("p1", null, fetchImpl);
    expect(result).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
