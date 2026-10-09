import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentMethodsTable } from "../../../../../../app/(private)/catalogs/payment-methods/_blocks/PaymentMethodsTable";
import type { PaymentMethod } from "../../../../../../app/(private)/catalogs/payment-methods/_logic/types/domain";

const ACTIVE_ITEM: PaymentMethod = {
  id: "pm1",
  code: "CASH",
  name: "Efectivo",
  description: "Pago en efectivo",
  isActive: true,
  isCredit: false,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"),
};

const INACTIVE_ITEM: PaymentMethod = {
  id: "pm2",
  code: "CHECK",
  name: "Cheque",
  description: null,
  isActive: false,
  isCredit: false,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"),
};

describe("PaymentMethodsTable", () => {
  it("renderiza filas con los datos de los items", () => {
    render(
      <PaymentMethodsTable
        items={[ACTIVE_ITEM, INACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />
    );
    expect(screen.getByText("CASH")).toBeInTheDocument();
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
    expect(screen.getByText("CHECK")).toBeInTheDocument();
    expect(screen.getByText("Cheque")).toBeInTheDocument();
  });

  it("columna Acciones NO se renderiza si canWrite=false", () => {
    render(
      <PaymentMethodsTable
        items={[ACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />
    );
    expect(screen.queryByText("Acciones")).not.toBeInTheDocument();
  });

  it("columna Acciones se renderiza si canWrite=true", () => {
    render(
      <PaymentMethodsTable
        items={[ACTIVE_ITEM]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />
    );
    expect(screen.getByText("Acciones")).toBeInTheDocument();
  });

  it("muestra badge Activo para item activo", () => {
    render(
      <PaymentMethodsTable
        items={[ACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />
    );
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("muestra badge Inactivo para item inactivo", () => {
    render(
      <PaymentMethodsTable
        items={[INACTIVE_ITEM]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />
    );
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("botón Desactivar en item activo con canWrite llama onSoftDelete", async () => {
    const onSoftDelete = jest.fn();
    render(
      <PaymentMethodsTable
        items={[ACTIVE_ITEM]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={onSoftDelete}
        onReactivate={jest.fn()}
      />
    );
    await userEvent.setup().click(screen.getByTitle("Desactivar"));
    expect(onSoftDelete).toHaveBeenCalledWith("pm1");
  });

  it("botón Reactivar en item inactivo con canWrite llama onReactivate", async () => {
    const onReactivate = jest.fn();
    render(
      <PaymentMethodsTable
        items={[INACTIVE_ITEM]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={onReactivate}
      />
    );
    await userEvent.setup().click(screen.getByTitle("Reactivar"));
    expect(onReactivate).toHaveBeenCalledWith("pm2");
  });

  it("skeleton visible cuando isLoading=true", () => {
    const { container } = render(
      <PaymentMethodsTable
        items={[]}
        canWrite={true}
        isLoading={true}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />
    );
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
