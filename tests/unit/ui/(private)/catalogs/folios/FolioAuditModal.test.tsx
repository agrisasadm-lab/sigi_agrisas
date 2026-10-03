/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn();
  HTMLDialogElement.prototype.close = jest.fn();
});

jest.mock("../../../../../../app/(private)/catalogs/folios/_logic/services/listFolios", () => ({
  auditFolio: jest.fn(),
}));
jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/_hooks/useBypassBranchOptions");

import { auditFolio } from "../../../../../../app/(private)/catalogs/folios/_logic/services/listFolios";
import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useBypassBranchOptions } from "../../../../../../app/_hooks/useBypassBranchOptions";
import { FolioAuditModal } from "../../../../../../app/(private)/catalogs/folios/_blocks/FolioAuditModal";
import type { FolioAuditResult } from "../../../../../../app/(private)/catalogs/folios/_logic/types/domain";

const mockAuditFolio = auditFolio as jest.MockedFunction<typeof auditFolio>;
const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseBypassBranchOptions = useBypassBranchOptions as jest.MockedFunction<typeof useBypassBranchOptions>;

function makeResult(overrides: Partial<FolioAuditResult> = {}): FolioAuditResult {
  return {
    folioId: "f1",
    code: "TK",
    prefix: "TK-",
    currentNumber: 5,
    totalIssued: 5,
    withoutFolioNumber: 0,
    gaps: [],
    truncated: false,
    sequence: [],
    branchId: null,
    branchCode: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "admin@example.com",
    roles: ["admin"],
    branchId: null,
    isLoading: false,
    can: () => true,
    refresh: jest.fn(),
  });
  mockUseBypassBranchOptions.mockReturnValue({
    branches: [{ id: "b-zarioz", code: "ZARIOZ", name: "Zarioz", isHeadquarters: false }],
    selectedBranchId: "",
    setSelectedBranchId: jest.fn(),
  });
});

describe("FolioAuditModal — selector de sucursal por branch scope", () => {
  it("folio branch-scoped (TK) muestra el selector con 'Global (histórico)' y las sucursales", async () => {
    mockAuditFolio.mockResolvedValue(makeResult({ code: "TK" }));

    render(<FolioAuditModal folioId="f1" open={true} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/sucursal/i)).toBeInTheDocument());
    expect(screen.getByText(/global \(histórico\)/i)).toBeInTheDocument();
    expect(screen.getByText("Zarioz")).toBeInTheDocument();
  });

  it("folio no branch-scoped (RB) no muestra el selector", async () => {
    mockAuditFolio.mockResolvedValue(makeResult({ code: "RB" }));

    render(<FolioAuditModal folioId="f1" open={true} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(/documentos emitidos/i)).toBeInTheDocument());
    expect(screen.queryByLabelText(/sucursal/i)).not.toBeInTheDocument();
  });

  it("seleccionar una sucursal refetchea auditFolio con su branchId", async () => {
    mockAuditFolio.mockResolvedValue(makeResult({ code: "TK" }));

    render(<FolioAuditModal folioId="f1" open={true} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/sucursal/i)).toBeInTheDocument());
    expect(mockAuditFolio).toHaveBeenCalledWith("f1", null);

    mockAuditFolio.mockResolvedValue(makeResult({ code: "TK", branchId: "b-zarioz", branchCode: "ZARIOZ", currentNumber: 2 }));
    fireEvent.change(screen.getByLabelText(/sucursal/i), { target: { value: "b-zarioz" } });

    await waitFor(() => expect(mockAuditFolio).toHaveBeenLastCalledWith("f1", "b-zarioz"));
  });

  it("las filas de tipo 'purchase' se muestran como 'Compra'", async () => {
    mockAuditFolio.mockResolvedValue(
      makeResult({
        code: "CP",
        sequence: [{ number: 1, documentType: "purchase", documentId: "p1", status: "completed", issuedAt: "2026-01-01T00:00:00.000Z" }],
      })
    );

    render(<FolioAuditModal folioId="f1" open={true} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByText("Compra")).toBeInTheDocument());
  });
});
