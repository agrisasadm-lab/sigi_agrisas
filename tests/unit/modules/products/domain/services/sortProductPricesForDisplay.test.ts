import { ProductPrice } from "@/modules/products/domain/entities/ProductPrice";
import { sortProductPricesForDisplay } from "@/modules/products/domain/services/sortProductPricesForDisplay";

function makePrice(name: string, isDefault: boolean): ProductPrice {
  return ProductPrice.create({
    id: name,
    productId: "p1",
    branchId: "b1",
    name,
    price: 100,
    minQuantity: 1,
    discountPct: null,
    isDefault,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("sortProductPricesForDisplay", () => {
  it("orders Publico, Subdis 10%, Distri 15%, Precio 4 for the real catalog names", () => {
    const precio4 = makePrice("Precio 4", false);
    const distri = makePrice("Precio Distri 15%", false);
    const publico = makePrice("Precio Publico", true);
    const subdis = makePrice("Precio Subdis 10%", false);

    const result = sortProductPricesForDisplay([precio4, distri, publico, subdis]);

    expect(result.map((p) => p.name)).toEqual([
      "Precio Publico",
      "Precio Subdis 10%",
      "Precio Distri 15%",
      "Precio 4",
    ]);
  });

  it("puts unrecognized names last, sorted alphabetically", () => {
    const general = makePrice("General", false);
    const precio4 = makePrice("Precio 4", false);
    const subdis = makePrice("Precio Subdis 10%", false);

    const result = sortProductPricesForDisplay([general, precio4, subdis]);

    expect(result.map((p) => p.name)).toEqual(["Precio Subdis 10%", "General", "Precio 4"]);
  });

  it("does not break when no price is marked as default", () => {
    const subdis = makePrice("Precio Subdis 10%", false);
    const distri = makePrice("Precio Distri 15%", false);

    const result = sortProductPricesForDisplay([distri, subdis]);

    expect(result.map((p) => p.name)).toEqual(["Precio Subdis 10%", "Precio Distri 15%"]);
  });

  it("breaks ties within the same rank by name ASC", () => {
    const zeta = makePrice("Zeta", false);
    const alpha = makePrice("Alpha", false);

    const result = sortProductPricesForDisplay([zeta, alpha]);

    expect(result.map((p) => p.name)).toEqual(["Alpha", "Zeta"]);
  });
});
