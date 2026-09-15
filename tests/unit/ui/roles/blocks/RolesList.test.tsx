import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RolesList } from "../../../../../app/(private)/roles/_blocks/RolesList";

const roles = [
  { id: "1", name: "admin", description: "Admin role", createdAt: "", updatedAt: "" },
  { id: "2", name: "viewer", description: null, createdAt: "", updatedAt: "" },
];

describe("RolesList", () => {
  it("shows skeletons when isLoading is true", () => {
    const { container } = render(
      <RolesList roles={[]} selectedRoleId={null} onSelect={jest.fn()} isLoading />
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows EmptyState when roles array is empty", () => {
    render(<RolesList roles={[]} selectedRoleId={null} onSelect={jest.fn()} isLoading={false} />);
    expect(screen.getByText("Sin roles")).toBeInTheDocument();
  });

  it("calls onSelect with role.id when clicking a role", () => {
    const onSelect = jest.fn();
    render(<RolesList roles={roles} selectedRoleId={null} onSelect={onSelect} isLoading={false} />);
    fireEvent.click(screen.getByText("Administrador"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("applies active class to the selected role item", () => {
    render(
      <RolesList roles={roles} selectedRoleId="1" onSelect={jest.fn()} isLoading={false} />
    );
    const adminButton = screen.getByText("Administrador").closest("button");
    expect(adminButton?.className).toContain("bg-primary-container");
  });

  it("humanizes a custom snake_case role name", () => {
    const customRoles = [
      { id: "3", name: "supervisor_almacen", description: null, createdAt: "", updatedAt: "" },
    ];
    render(<RolesList roles={customRoles} selectedRoleId={null} onSelect={jest.fn()} isLoading={false} />);
    expect(screen.getByText("Supervisor Almacen")).toBeInTheDocument();
  });
});
