import { NextRequest } from "next/server";
import { ProductPricesController } from "@/modules/products/infrastructure/http/ProductPricesController";
import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { ListProductPricesUseCase, } from "@/modules/products/application/use-cases/ListProductPricesUseCase";
import { CreateProductPriceUseCase, BranchActiveLookup } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { UpdateProductPriceUseCase } from "@/modules/products/application/use-cases/UpdateProductPriceUseCase";
import { DeleteProductPriceUseCase } from "@/modules/products/application/use-cases/DeleteProductPriceUseCase";

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const ZARIOZ = "22222222-2222-2222-2222-222222222222";
const UNKNOWN_BRANCH = "33333333-3333-3333-3333-333333333333";

class FakeBranchLookup implements BranchActiveLookup {
  async findById(id: string) {
    if (id === ZARIOZ) return { isActive: true };
    return null;
  }
}

async function buildController() {
  const productRepo = new InMemoryProductRepository();
  const priceRepo = new InMemoryProductPriceRepository();
  const branchLookup = new FakeBranchLookup();
  const controller = new ProductPricesController(
    new ListProductPricesUseCase(productRepo, priceRepo, branchLookup),
    new CreateProductPriceUseCase(productRepo, priceRepo, branchLookup),
    new UpdateProductPriceUseCase(priceRepo),
    new DeleteProductPriceUseCase(priceRepo)
  );
  const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: "44444444-4444-4444-4444-444444444444" });
  return { controller, productId: product.id, priceRepo };
}

function makeGetReq(url: string) {
  return new NextRequest(url);
}

function makePostReq(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/v1/admin/products/x/prices", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("ProductPricesController — precio por sucursal", () => {
  it("GET sin branchId retorna 400", async () => {
    const { controller, productId } = await buildController();
    const res = await controller.list(makeGetReq(`http://localhost/api/v1/admin/products/${productId}/prices`), productId);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("branchId is required");
  });

  it("GET con branchId de formato inválido retorna 400", async () => {
    const { controller, productId } = await buildController();
    const res = await controller.list(
      makeGetReq(`http://localhost/api/v1/admin/products/${productId}/prices?branchId=not-a-uuid`),
      productId
    );
    expect(res.status).toBe(400);
  });

  it("GET con branchId de sucursal inexistente retorna 404 Branch not found", async () => {
    const { controller, productId } = await buildController();
    const res = await controller.list(
      makeGetReq(`http://localhost/api/v1/admin/products/${productId}/prices?branchId=${UNKNOWN_BRANCH}`),
      productId
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Branch not found");
  });

  it("POST con branchId inválido (no UUID) retorna 400 antes de tocar enforceBranchScope", async () => {
    const { controller, productId } = await buildController();
    const res = await controller.create(makePostReq({ name: "Precio Publico", price: 100, branchId: "not-a-uuid" }), productId);
    expect(res.status).toBe(400);
  });

  it("POST con branchId válido pero sin x-user-id retorna 401 (enforceBranchScope está siendo aplicado)", async () => {
    const { controller, productId } = await buildController();
    const res = await controller.create(
      makePostReq({ name: "Precio Publico", price: 699.35, branchId: ZARIOZ }),
      productId
    );
    expect(res.status).toBe(401);
  });

  it("POST sin branchId retorna 400: no existe precio sin sucursal", async () => {
    const { controller, productId } = await buildController();
    const res = await controller.create(makePostReq({ name: "Precio Publico", price: 100 }), productId);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("branchId is required");
  });
});
