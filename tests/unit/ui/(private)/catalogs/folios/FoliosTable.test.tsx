import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FoliosTable } from "../../../../../../app/(private)/catalogs/folios/_blocks/FoliosTable";
import type { Folio } from "../../../../../../app/(private)/catalogs/folios/_logic/types/domain";

const ACTIVE_ITEM: Folio = {
  id: "f1",
  code: "FACT_A",
  name: "Factura A",
  prefix: "FA",
  scope: "OPERATIONS",
  currentNumber: 100,
  isActive: true,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"), branchCurrentNumber: null, nextFolioCode: null,
};

const INACTIVE_ITEM: Folio = {
  id: "f2",
  code: "REM_B",
  name: "Remisión B",
  prefix: null,
  scope: "OPERATIONS",
  currentNumber: 0,
  isActive: false,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"), branchCurrentNumber: null, nextFolioCode: null,
};

describe("FoliosTable", () => {
  it("renderiza filas con los datos de los items", () => {
    render(
      <FoliosTable
        items={[ACTIVE_ITEM, INACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
        onAudit={jest.fn()}
      />
    );
    expect(screen.getByText("FACT_A")).toBeInTheDocument();
    expect(screen.getByText("Factura A")).toBeInTheDocument();
    expect(screen.getByText("REM_B")).toBeInTheDocument();
    expect(screen.getByText("Remisión B")).toBeInTheDocument();
  });

  it("muestra prefix y currentNumber correctamente", () => {
    render(
      <FoliosTable
        items={[ACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
        onAudit={jest.fn()}
      />
    );
    expect(screen.getByText("FA")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("columna Acciones siempre se renderiza (botón Auditar visible para todos)", () => {
    render(
      <FoliosTable
        items={[ACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
        onAudit={jest.fn()}
      />
    );
    expect(screen.getByText("Acciones")).toBeInTheDocument();
    expect(screen.getByTitle("Auditar secuencia")).toBeInTheDocument();
  });

  it("botones Editar/Desactivar visibles cuando canWrite=true", () => {
    render(
      <FoliosTable
        items={[ACTIVE_ITEM]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
        onAudit={jest.fn()}
      />
    );
    expect(screen.getByTitle("Editar")).toBeInTheDocument();
    expect(screen.getByTitle("Desactivar")).toBeInTheDocument();
  });

  it("muestra badge Activo para item activo", () => {
    render(
      <FoliosTable
        items={[ACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
        onAudit={jest.fn()}
      />
    );
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("muestra badge Inactivo para item inactivo", () => {
    render(
      <FoliosTable
        items={[INACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
        onAudit={jest.fn()}
      />
    );
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("botón Desactivar en item activo con canWrite llama onSoftDelete", async () => {
    const onSoftDelete = jest.fn();
    render(
      <FoliosTable
        items={[ACTIVE_ITEM]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={onSoftDelete}
        onReactivate={jest.fn()}
        onAudit={jest.fn()}
      />
    );
    await userEvent.setup().click(screen.getByTitle("Desactivar"));
    expect(onSoftDelete).toHaveBeenCalledWith("f1");
  });

  it("botón Reactivar en item inactivo con canWrite llama onReactivate", async () => {
    const onReactivate = jest.fn();
    render(
      <FoliosTable
        items={[INACTIVE_ITEM]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={onReactivate}
        onAudit={jest.fn()}
      />
    );
    await userEvent.setup().click(screen.getByTitle("Reactivar"));
    expect(onReactivate).toHaveBeenCalledWith("f2");
  });

  it("botón Auditar llama onAudit con el id del folio", async () => {
    const onAudit = jest.fn();
    render(
      <FoliosTable
        items={[ACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
        onAudit={onAudit}
      />
    );
    await userEvent.setup().click(screen.getByTitle("Auditar secuencia"));
    expect(onAudit).toHaveBeenCalledWith("f1");
  });

  it("skeleton visible cuando isLoading=true", () => {
    const { container } = render(
      <FoliosTable
        items={[]}
        canWrite={true}
        isLoading={true}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
        onAudit={jest.fn()}
      />
    );
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
