import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../../../../../../app/_hooks/useCurrentUser", () => ({ useCurrentUser: jest.fn() }));
jest.mock("../../../../../../app/(private)/catalogs/folios/_logic/hooks/useFolios", () => ({ useFolios: jest.fn() }));
jest.mock("../../../../../../app/(private)/catalogs/folios/_logic/hooks/useFolioMutations", () => ({ useFolioMutations: jest.fn() }));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import * as useFoliosModule from "../../../../../../app/(private)/catalogs/folios/_logic/hooks/useFolios";
import * as useFolioMutationsModule from "../../../../../../app/(private)/catalogs/folios/_logic/hooks/useFolioMutations";
import { FoliosPage } from "../../../../../../app/(private)/catalogs/folios/_blocks/FoliosPage";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn();
  HTMLDialogElement.prototype.close = jest.fn();
});

const mockCan = jest.fn();

const defaultMutations = {
  isSaving: false,
  mutationError: null,
  clearError: jest.fn(),
  createOne: jest.fn(),
  updateOne: jest.fn(),
  softDeleteOne: jest.fn(),
  reactivateOne: jest.fn(),
};

const defaultFolios = {
  items: [],
  total: 0,
  isLoading: false,
  error: null,
  refresh: jest.fn(),
};

describe("FoliosPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCurrentUser as jest.Mock).mockReturnValue({
      userId: "admin-id",
      email: "admin@test.com",
      roles: ["admin"],
      isLoading: false,
      can: mockCan,
      refresh: jest.fn(),
    });
    jest.spyOn(useFoliosModule, "useFolios").mockReturnValue(defaultFolios);
    jest.spyOn(useFolioMutationsModule, "useFolioMutations").mockReturnValue(defaultMutations);
  });

  it("muestra skeletons cuando canRead='loading'", () => {
    mockCan.mockReturnValue("loading");
    const { container } = render(<FoliosPage />);
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
  });

  it("muestra Sin acceso cuando canRead=false", () => {
    mockCan.mockReturnValue(false);
    render(<FoliosPage />);
    expect(screen.getByText("Sin acceso a este catálogo")).toBeInTheDocument();
  });

  it("muestra el contenido cuando canRead=true y no hay items", () => {
    mockCan.mockReturnValue(true);
    render(<FoliosPage />);
    expect(screen.getByText("Folios")).toBeInTheDocument();
  });

  it("muestra tabla cuando canRead=true y hay items", () => {
    mockCan.mockReturnValue(true);
    jest.spyOn(useFoliosModule, "useFolios").mockReturnValue({
      items: [
        {
          id: "f1",
          code: "FACT_A",
          name: "Factura A",
          prefix: "FA",
          scope: "OPERATIONS",
          currentNumber: 100,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(), branchCurrentNumber: null, nextFolioCode: null,
        },
      ],
      total: 1,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    render(<FoliosPage />);
    expect(screen.getByText("Factura A")).toBeInTheDocument();
  });

  it("botón Nuevo NO visible cuando canWrite=false", () => {
    mockCan.mockImplementation((p: string) => p === "folios:read" ? true : false);
    render(<FoliosPage />);
    expect(screen.queryByRole("button", { name: /nuevo/i })).not.toBeInTheDocument();
  });

  it("botón Nuevo VISIBLE cuando canWrite=true", () => {
    mockCan.mockReturnValue(true);
    render(<FoliosPage />);
    expect(screen.getByRole("button", { name: /nuevo/i })).toBeInTheDocument();
  });

  it("botón Nuevo abre el modal", async () => {
    mockCan.mockReturnValue(true);
    const clearError = jest.fn();
    jest.spyOn(useFolioMutationsModule, "useFolioMutations").mockReturnValue({
      ...defaultMutations,
      clearError,
    });
    render(<FoliosPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /nuevo/i }));
    expect(clearError).toHaveBeenCalled();
  });
});
