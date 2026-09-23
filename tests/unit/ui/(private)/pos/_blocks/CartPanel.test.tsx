/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/(private)/pos/_logic/hooks/useCustomerSearch", () => ({
  useCustomerSearch: jest.fn(() => ({ items: [], isLoading: false })),
}));
jest.mock("../../../../../../app/_hooks/useDebounce", () => ({
  useDebounce: (v: unknown) => v,
}));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { CartPanel } from "../../../../../../app/(private)/pos/_blocks/CartPanel";
import type { CartLine, CartTotals } from "../../../../../../app/(private)/pos/_logic/types/domain";
import type { FolioOption, PaymentMethodOption } from "../../../../../../app/(private)/pos/_logic/types/api";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
mockUseCurrentUser.mockReturnValue({
  userId: "u1",
  email: "op@test.com",
  roles: ["operator"],
  branchId: "b1",
  isLoading: false,
  can: () => true,
  refresh: jest.fn(),
});

const folios: FolioOption[] = [{ id: "f1", code: "PRINC", name: "Principal", prefix: "A", currentNumber: 100, isActive: true, branchCurrentNumber: null, nextFolioCode: null }];
const paymentMethods: PaymentMethodOption[] = [{ id: "pm1", code: "EFE", name: "Efectivo", isActive: true }];

const zeroTotals: CartTotals = { subtotal: 0, ivaTotal: 0, iepsTotal: 0, taxTotal: 0, total: 0 };

const baseLine: CartLine = {
  id: "line-1",
  productId: "prod-1",
  productCode: "P001",
  productName: "Maíz",
  productPriceId: "price-1",
  priceName: "Menudeo",
  unitPrice: 100,
  ivaRate: 0.16,
  iepsRate: 0,
  quantity: 1,
  discountPct: 0,
  lineSubtotal: 100,
  lineIva: 16,
  lineIeps: 0,
  lineTotal: 116,
};

const baseProps = {
  lines: [] as CartLine[],
  totals: zeroTotals,
  folios,
  paymentMethods,
  selectedBranchId: "b1",
  selectedFolioId: "",
  selectedPaymentMethodId: "",
  selectedCustomerId: "",
  notes: "",
  isLoadingOptions: false,
  isSubmitting: false,
  canCreate: true as boolean | "loading",
  isOnline: true,
  offlineEnabled: false,
  ownerBranchId: null as string | null,
  onFolioChange: jest.fn(),
  onPaymentMethodChange: jest.fn(),
  onCustomerChange: jest.fn(),
  onNotesChange: jest.fn(),
  onOpenQuickAdd: jest.fn(),
  onUpdateQuantity: jest.fn(),
  onUpdateDiscount: jest.fn(),
  onChangeTier: jest.fn(),
  onRemoveLine: jest.fn(),
  onSubmit: jest.fn(),
};

describe("CartPanel — modo quote", () => {
  const quoteProps = {
    ...baseProps,
    mode: "quote" as const,
    lines: [baseLine],
    selectedFolioId: "f1",
    selectedPaymentMethodId: "",
    canCreate: true as boolean | "loading",
  };

  it('CTA dice "Crear cotización" en modo quote', () => {
    render(<CartPanel {...quoteProps} />);
    expect(screen.getByRole("button", { name: /Crear cotización/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Finalizar venta/i })).not.toBeInTheDocument();
  });

  it("oculta el selector de método de pago en modo quote", () => {
    render(<CartPanel {...quoteProps} />);
    expect(screen.queryByText(/Método de pago/i)).not.toBeInTheDocument();
  });

  it("muestra el campo Vencimiento en modo quote", () => {
    render(<CartPanel {...quoteProps} expiresAt="2026-12-31" onExpiresAtChange={jest.fn()} />);
    expect(screen.getByDisplayValue("2026-12-31")).toBeInTheDocument();
  });

  it("botón habilitado en modo quote con folio e items sin necesitar método de pago", () => {
    render(<CartPanel {...quoteProps} />);
    expect(screen.getByRole("button", { name: /Crear cotización/i })).not.toBeDisabled();
  });

  it("botón deshabilitado en modo quote sin folio", () => {
    render(<CartPanel {...quoteProps} selectedFolioId="" />);
    expect(screen.getByRole("button", { name: /Crear cotización/i })).toBeDisabled();
  });

  it("botón deshabilitado en modo quote con carrito vacío", () => {
    render(<CartPanel {...quoteProps} lines={[]} />);
    expect(screen.getByRole("button", { name: /Crear cotización/i })).toBeDisabled();
  });
});

describe("CartPanel — botón Finalizar venta", () => {
  it("está deshabilitado cuando no hay folio seleccionado", () => {
    render(<CartPanel {...baseProps} lines={[baseLine]} selectedPaymentMethodId="pm1" selectedFolioId="" />);
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).toBeDisabled();
  });

  it("está deshabilitado cuando no hay método de pago seleccionado", () => {
    render(<CartPanel {...baseProps} lines={[baseLine]} selectedFolioId="f1" selectedPaymentMethodId="" />);
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).toBeDisabled();
  });

  it("está deshabilitado cuando el carrito está vacío", () => {
    render(<CartPanel {...baseProps} lines={[]} selectedFolioId="f1" selectedPaymentMethodId="pm1" />);
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).toBeDisabled();
  });

  it("está deshabilitado cuando canCreate=false", () => {
    render(<CartPanel {...baseProps} lines={[baseLine]} selectedFolioId="f1" selectedPaymentMethodId="pm1" canCreate={false} />);
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).toBeDisabled();
  });

  it("está habilitado cuando hay folio, método de pago e items", () => {
    render(<CartPanel {...baseProps} lines={[baseLine]} selectedFolioId="f1" selectedPaymentMethodId="pm1" canCreate={true} />);
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).not.toBeDisabled();
  });

  it("está deshabilitado cuando isSubmitting=true", () => {
    render(<CartPanel {...baseProps} lines={[baseLine]} selectedFolioId="f1" selectedPaymentMethodId="pm1" isSubmitting={true} />);
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).toBeDisabled();
  });

  it("está deshabilitado offline sin sucursal de trabajo fijada (offlineEnabled=false)", () => {
    render(
      <CartPanel
        {...baseProps}
        lines={[baseLine]}
        selectedFolioId="f1"
        selectedPaymentMethodId="pm1"
        isOnline={false}
        offlineEnabled={false}
        ownerBranchId={null}
      />
    );
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).toBeDisabled();
  });

  it("está habilitado offline cuando offlineEnabled=true y ownerBranchId coincide con la sucursal", () => {
    render(
      <CartPanel
        {...baseProps}
        lines={[baseLine]}
        selectedFolioId="f1"
        selectedPaymentMethodId="pm1"
        selectedBranchId="b1"
        isOnline={false}
        offlineEnabled={true}
        ownerBranchId="b1"
      />
    );
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).not.toBeDisabled();
  });

  it("muestra el conteo de artículos en el carrito", () => {
    render(<CartPanel {...baseProps} lines={[baseLine, { ...baseLine, id: "line-2" }]} selectedFolioId="f1" selectedPaymentMethodId="pm1" />);
    expect(screen.getByText(/2 artículos/i)).toBeInTheDocument();
  });

  it("está deshabilitado cuando no hay sucursal seleccionada (admin bypass sin elegir sucursal)", () => {
    render(<CartPanel {...baseProps} lines={[baseLine]} selectedFolioId="f1" selectedPaymentMethodId="pm1" selectedBranchId="" />);
    expect(screen.getByRole("button", { name: /Finalizar venta/i })).toBeDisabled();
  });
});
