import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomersTable } from "../../../../../../app/(private)/catalogs/customers/_blocks/CustomersTable";
import type { Customer } from "../../../../../../app/(private)/catalogs/customers/_logic/types/domain";

const baseCustomer: Customer = {
  id: "c1",
  code: "CLI_001",
  name: "Cliente ACME",
  rfc: "SAC120101A12",
  legalName: "Cliente ACME S.A. de C.V.",
  taxRegime: "601",
  cfdiUse: "G03",
  taxZipCode: "06600",
  email: "contacto@acme.com",
  phone: "5555-1234",
  address: null,
  contactName: "Juan Pérez",
  notes: null,
  creditLimit: 50000,
  currentBalance: 1000,
  initialBalance: 0,
  creditDays: 30,
  isActive: true,
  addressStreet: null,
  addressExteriorNumber: null,
  addressInteriorNumber: null,
  addressNeighborhood: null,
  addressMunicipality: null,
  addressState: null,
  addressCountry: null,
  addressZipCode: null,
  branchIds: [],
  createdAt: new Date("2026-05-25"),
  updatedAt: new Date("2026-05-25"),
};

const inactiveCustomer: Customer = {
  ...baseCustomer,
  id: "c2",
  code: "CLI_002",
  name: "Cliente Beta",
  legalName: null,
  rfc: "INB200101A23",
  creditLimit: null,
  isActive: false,
};

describe("CustomersTable", () => {
  it("renders rows with code, name, rfc, creditDays", () => {
    render(
      <CustomersTable
        items={[baseCustomer]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText("CLI_001")).toBeInTheDocument();
    expect(screen.getByText("Cliente ACME")).toBeInTheDocument();
    expect(screen.getByText("SAC120101A12")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("renders legalName as subtitle when present", () => {
    render(
      <CustomersTable
        items={[baseCustomer]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText("Cliente ACME S.A. de C.V.")).toBeInTheDocument();
  });

  it("shows em-dash when creditLimit is null", () => {
    render(
      <CustomersTable
        items={[inactiveCustomer]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("formats creditLimit and currentBalance as currency", () => {
    render(
      <CustomersTable
        items={[baseCustomer]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText(/\$50,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$1,000\.00/)).toBeInTheDocument();
  });

  it("does NOT render Acciones column when canWrite is false", () => {
    render(
      <CustomersTable
        items={[baseCustomer]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.queryByText("Acciones")).not.toBeInTheDocument();
  });

  it("renders Acciones column when canWrite is true", () => {
    render(
      <CustomersTable
        items={[baseCustomer]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText("Acciones")).toBeInTheDocument();
  });

  it("renders Activo badge for active customer", () => {
    render(
      <CustomersTable
        items={[baseCustomer]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("renders Inactivo badge for inactive customer", () => {
    render(
      <CustomersTable
        items={[inactiveCustomer]}
        canWrite={false}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("shows Eliminar action on active row when canWrite", async () => {
    const onSoftDelete = jest.fn();
    render(
      <CustomersTable
        items={[baseCustomer]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={onSoftDelete}
        onReactivate={jest.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByTitle("Desactivar"));
    expect(onSoftDelete).toHaveBeenCalledWith("c1");
  });

  it("shows Reactivar action on inactive row when canWrite", async () => {
    const onReactivate = jest.fn();
    render(
      <CustomersTable
        items={[inactiveCustomer]}
        canWrite={true}
        onEdit={jest.fn()}
        onSoftDelete={jest.fn()}
        onReactivate={onReactivate}
      />,
    );
    await userEvent.setup().click(screen.getByTitle("Reactivar"));
    expect(onReactivate).toHaveBeenCalledWith("c2");
  });
});
