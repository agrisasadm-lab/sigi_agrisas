/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

jest.mock("../../../../../../app/_hooks/useFoliosOptions");
jest.mock("../../../../../../app/_hooks/usePaymentMethodsOptions");
jest.mock("../../../../../../app/(private)/payments/_logic/services/registerPayment");

import { useFoliosOptions } from "../../../../../../app/_hooks/useFoliosOptions";
import { usePaymentMethodsOptions } from "../../../../../../app/_hooks/usePaymentMethodsOptions";
import { registerPayment } from "../../../../../../app/(private)/payments/_logic/services/registerPayment";
import { RegisterPaymentModal } from "../../../../../../app/(private)/payments/_blocks/RegisterPaymentModal";
import { PaymentExceedsDueAmountError } from "../../../../../../app/(private)/payments/_logic/errors";

const mockUseFoliosOptions = useFoliosOptions as jest.MockedFunction<typeof useFoliosOptions>;
const mockUsePaymentMethodsOptions = usePaymentMethodsOptions as jest.MockedFunction<typeof usePaymentMethodsOptions>;
const mockRegisterPayment = registerPayment as jest.MockedFunction<typeof registerPayment>;

const FOLIO_RB = { id: "f-rb", code: "RB", name: "Recibo de Pago - Cobranza", prefix: "RB-", scope: "OPERATIONS" as const, currentNumber: 1, isActive: true, branchCurrentNumber: null, nextFolioCode: null };
const FOLIO_AB = { id: "f-ab", code: "AB", name: "Cobranza/Abono", prefix: "AB-", scope: "OPERATIONS" as const, currentNumber: 1, isActive: true, branchCurrentNumber: null, nextFolioCode: null };
const METHOD = { id: "pm1", code: "EFE", name: "Efectivo", isActive: true, isCredit: false };

function setup() {
  mockUseFoliosOptions.mockReturnValue({ options: [FOLIO_RB, FOLIO_AB], isLoading: false, refresh: jest.fn() });
  mockUsePaymentMethodsOptions.mockReturnValue({ options: [METHOD], isLoading: false, refresh: jest.fn() });
}

// jsdom doesn't implement showModal/close, so polyfill
Object.defineProperty(HTMLDialogElement.prototype, "showModal", { value: jest.fn(), writable: true });
Object.defineProperty(HTMLDialogElement.prototype, "close", { value: jest.fn(), writable: true });

describe("RegisterPaymentModal", () => {
  beforeEach(() => {
    setup();
    jest.clearAllMocks();
  });

  it("preselecciona folio RB cuando está disponible", () => {
    render(<RegisterPaymentModal saleId="s1" dueAmount={500} lineBalances={[]} onSuccess={jest.fn()} onClose={jest.fn()} />);
    const folioSelect = screen.getByLabelText(/Folio de recibo/i) as HTMLSelectElement;
    expect(folioSelect.value).toBe("f-rb");
  });

  it("muestra el saldo pendiente como hint", () => {
    render(<RegisterPaymentModal saleId="s1" dueAmount={300} lineBalances={[]} onSuccess={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(/\$300/)).toBeInTheDocument();
  });

  it("muestra error inline cuando amount es 0", async () => {
    render(<RegisterPaymentModal saleId="s1" dueAmount={500} lineBalances={[]} onSuccess={jest.fn()} onClose={jest.fn()} />);
    const amountInput = screen.getByLabelText(/Monto/i);
    fireEvent.change(amountInput, { target: { value: "0" } });
    fireEvent.submit(amountInput.closest("form")!);
    await waitFor(() => {
      expect(screen.getByText(/mayor a 0/i)).toBeInTheDocument();
    });
  });

  it("muestra error inline PaymentExceedsDueAmount en campo amount", async () => {
    mockRegisterPayment.mockRejectedValue(new PaymentExceedsDueAmountError("300.00"));
    render(<RegisterPaymentModal saleId="s1" dueAmount={300} lineBalances={[]} onSuccess={jest.fn()} onClose={jest.fn()} />);
    // Wait for effects to flush (folioId + paymentMethodId selects)
    await waitFor(() => {
      const sel = screen.getByLabelText(/Folio de recibo/i) as HTMLSelectElement;
      expect(sel.value).toBe("f-rb");
    });
    fireEvent.change(screen.getByLabelText(/Monto/i), { target: { value: "500" } });
    await act(async () => {
      fireEvent.submit(screen.getByLabelText(/Monto/i).closest("form")!);
    });
    await waitFor(() => {
      expect(screen.getByText(/saldo pendiente.*300/i)).toBeInTheDocument();
    });
  });

  it("llama onSuccess en respuesta exitosa", async () => {
    mockRegisterPayment.mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    render(<RegisterPaymentModal saleId="s1" dueAmount={500} lineBalances={[]} onSuccess={onSuccess} onClose={jest.fn()} />);
    const amountInput = screen.getByLabelText(/Monto/i);
    fireEvent.change(amountInput, { target: { value: "100" } });
    await act(async () => {
      fireEvent.submit(amountInput.closest("form")!);
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  const LINE_BALANCES = [
    { saleItemId: "line-a", productNameSnapshot: "Producto A", lineTotal: 100, paidAmount: 0, dueAmount: 100 },
    { saleItemId: "line-b", productNameSnapshot: "Producto B", lineTotal: 50, paidAmount: 50, dueAmount: 0 },
  ];

  it("no muestra el toggle 'Repartir por producto' cuando no hay lineBalances", () => {
    render(<RegisterPaymentModal saleId="s1" dueAmount={500} lineBalances={[]} onSuccess={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByText(/Repartir por producto/i)).not.toBeInTheDocument();
  });

  it("activar el toggle reemplaza el campo de monto único por inputs por línea, con la línea liquidada deshabilitada", () => {
    render(<RegisterPaymentModal saleId="s1" dueAmount={100} lineBalances={LINE_BALANCES} onSuccess={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByLabelText(/Repartir por producto/i));

    expect(screen.queryByLabelText(/^Monto$/i)).not.toBeInTheDocument();
    expect(screen.getByText("Producto A")).toBeInTheDocument();
    expect(screen.getByText("Producto B")).toBeInTheDocument();

    const inputs = screen.getAllByPlaceholderText("0.00");
    // Second line (Producto B) is fully paid (dueAmount=0) → disabled
    expect(inputs[1]).toBeDisabled();
    expect(inputs[0]).not.toBeDisabled();
  });

  it("envía items con montos independientes por línea en modo repartir", async () => {
    mockRegisterPayment.mockResolvedValue(undefined);
    render(<RegisterPaymentModal saleId="s1" dueAmount={100} lineBalances={LINE_BALANCES} onSuccess={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByLabelText(/Repartir por producto/i));

    const [lineAInput] = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(lineAInput, { target: { value: "60" } });

    await act(async () => {
      fireEvent.submit(lineAInput.closest("form")!);
    });

    await waitFor(() => {
      expect(mockRegisterPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 60,
          items: [{ saleItemId: "line-a", amount: 60 }],
        })
      );
    });
  });
});
