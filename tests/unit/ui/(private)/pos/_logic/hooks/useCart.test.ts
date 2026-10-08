/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useCart } from "../../../../../../../app/(private)/pos/_logic/hooks/useCart";
import type { ProductDto, ProductPriceDto, DosificationOptionDto } from "../../../../../../../app/(private)/pos/_logic/types/api";

const product: ProductDto = {
  id: "prod-1",
  code: "P001",
  name: "Producto Uno",
  ivaRate: 0.16,
  iepsRate: 0,
  isActive: true,
  departmentId: "dep-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  stock: null,
};

const price: ProductPriceDto = {
  id: "price-1",
  productId: "prod-1",
  branchId: "b1",
  name: "Precio base",
  price: 100,
  minQuantity: 1,
  discountPct: 0,
  isDefault: true,
};

const price2: ProductPriceDto = {
  id: "price-2",
  productId: "prod-1",
  branchId: "b1",
  name: "Precio mayoreo",
  price: 80,
  minQuantity: 10,
  discountPct: 0,
  isDefault: false,
};

const dosification: DosificationOptionDto = {
  id: "dosif-1",
  productId: "prod-1",
  name: "1/4",
  numParts: 4,
  isActive: true,
  computedUnitPrice: 26.75,
  requiresDefaultPrice: false,
};

describe("useCart", () => {
  it("empieza vacío con totales en cero", () => {
    const { result } = renderHook(() => useCart());
    expect(result.current.lines).toHaveLength(0);
    expect(result.current.totals.total).toBe(0);
  });

  it("addLine agrega una línea y recalcula totales", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 2, 0));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(2);
    expect(result.current.lines[0].lineSubtotal).toBe(172.4138);
    expect(result.current.lines[0].lineIva).toBe(27.5862);
    expect(result.current.totals.total).toBe(200);
  });

  it("addLine con mismo producto+precio acumula cantidad", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 2, 0));
    act(() => result.current.addLine(product, price, 3, 0));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(5);
  });

  it("updateQuantity actualiza y recalcula", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 1, 0));
    const lineId = result.current.lines[0].id;
    act(() => result.current.updateQuantity(lineId, 5));
    expect(result.current.lines[0].quantity).toBe(5);
    expect(result.current.totals.subtotal).toBe(431.0345);
  });

  it("updateDiscountPct aplica descuento y recalcula", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 1, 0));
    const lineId = result.current.lines[0].id;
    act(() => result.current.updateDiscountPct(lineId, 10));
    expect(result.current.lines[0].discountPct).toBe(10);
    expect(result.current.lines[0].lineSubtotal).toBe(77.5862);
  });

  it("updateDiscountAmount aplica descuento por monto y recalcula", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 1, 0));
    const lineId = result.current.lines[0].id;
    act(() => result.current.updateDiscountAmount(lineId, 20));
    expect(result.current.lines[0].discountAmount).toBe(20);
    expect(result.current.lines[0].discountType).toBe("amount");
    expect(result.current.lines[0].lineTotal).toBe(80);
  });

  it("activar descuento por monto resetea el % de la misma línea a 0 (mutuamente excluyentes)", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 1, 0));
    const lineId = result.current.lines[0].id;
    act(() => result.current.updateDiscountPct(lineId, 10));
    expect(result.current.lines[0].discountPct).toBe(10);
    act(() => result.current.updateDiscountAmount(lineId, 20));
    expect(result.current.lines[0].discountAmount).toBe(20);
    expect(result.current.lines[0].discountPct).toBe(0);
    expect(result.current.lines[0].discountType).toBe("amount");
  });

  it("activar descuento por % resetea el monto de la misma línea a 0 (mutuamente excluyentes)", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 1, 0));
    const lineId = result.current.lines[0].id;
    act(() => result.current.updateDiscountAmount(lineId, 20));
    expect(result.current.lines[0].discountAmount).toBe(20);
    act(() => result.current.updateDiscountPct(lineId, 10));
    expect(result.current.lines[0].discountPct).toBe(10);
    expect(result.current.lines[0].discountAmount).toBe(0);
    expect(result.current.lines[0].discountType).toBe("pct");
  });

  it("updateDiscountAmount clampa a [0, 100]", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 1, 0));
    const lineId = result.current.lines[0].id;
    act(() => result.current.updateDiscountAmount(lineId, 150));
    expect(result.current.lines[0].discountAmount).toBe(100);
    act(() => result.current.updateDiscountAmount(lineId, -10));
    expect(result.current.lines[0].discountAmount).toBe(0);
  });

  it("removeLine elimina la línea del carrito", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 1, 0));
    const lineId = result.current.lines[0].id;
    act(() => result.current.removeLine(lineId));
    expect(result.current.lines).toHaveLength(0);
    expect(result.current.totals.total).toBe(0);
  });

  it("clear vacía el carrito", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 2, 0));
    act(() => result.current.clear());
    expect(result.current.lines).toHaveLength(0);
    expect(result.current.totals.total).toBe(0);
  });

  it("changeTier actualiza el precio de la línea sin perder productId", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLine(product, price, 5, 0));
    const lineId = result.current.lines[0].id;
    act(() => result.current.changeTier(lineId, price2));
    expect(result.current.lines[0].productPriceId).toBe("price-2");
    expect(result.current.lines[0].priceName).toBe("Precio mayoreo");
    expect(result.current.lines[0].unitPrice).toBe(80);
    expect(result.current.lines[0].productId).toBe("prod-1");
  });

  it("addLineFromDosification agrega una línea con dosificationId y unitPrice=computedUnitPrice", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLineFromDosification(product, dosification, 3));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].dosificationId).toBe("dosif-1");
    expect(result.current.lines[0].productPriceId).toBeUndefined();
    expect(result.current.lines[0].unitPrice).toBe(26.75);
    expect(result.current.lines[0].priceName).toBe("1/4");
    expect(result.current.lines[0].quantity).toBe(3);
  });

  it("addLineFromDosification con misma dosificación acumula cantidad", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addLineFromDosification(product, dosification, 2));
    act(() => result.current.addLineFromDosification(product, dosification, 1));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(3);
  });
});
