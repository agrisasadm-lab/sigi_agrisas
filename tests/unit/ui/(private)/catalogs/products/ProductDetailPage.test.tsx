import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}));

jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/_hooks/useDepartmentsOptions");
jest.mock("../../../../../../app/(private)/catalogs/products/_logic/services/products", () => ({
  getProduct: jest.fn(),
}));
jest.mock("../../../../../../app/(private)/catalogs/products/_blocks/ProductGeneralTab", () => ({
  ProductGeneralTab: () => <div data-testid="tab-general" />,
}));
jest.mock("../../../../../../app/(private)/catalogs/products/_blocks/ProductPricesTab", () => ({
  ProductPricesTab: () => <div data-testid="tab-prices" />,
}));
jest.mock("../../../../../../app/(private)/catalogs/products/_blocks/ProductDosificationsTab", () => ({
  ProductDosificationsTab: () => <div data-testid="tab-dosifications" />,
}));

import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useDepartmentsOptions } from "../../../../../../app/_hooks/useDepartmentsOptions";
import { getProduct } from "../../../../../../app/(private)/catalogs/products/_logic/services/products";
import { ProductDetailPage } from "../../../../../../app/(private)/catalogs/products/_blocks/ProductDetailPage";

const mockUseSearchParams = useSearchParams as jest.Mock;
const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseDepartmentsOptions = useDepartmentsOptions as jest.MockedFunction<typeof useDepartmentsOptions>;
const mockGetProduct = getProduct as jest.Mock;

const NOW = new Date("2026-01-01");

const baseProduct = {
  id: "p1",
  code: "PROD1",
  name: "Producto Uno",
  unit: "kg",
  unitDescription: null,
  satProductCode: null,
  departmentId: "d1",
  departmentName: "Depto",
  taxRateId: null,
  taxRateCode: null,
  providerId: null,
  providerName: null,
  ivaRate: null,
  iepsRate: null,
  imageUrl: null,
  manufactureDate: null,
  acquisitionPrice: null,
  isTaxable: false,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
};

function mockSearchParams(tab: string | null) {
  mockUseSearchParams.mockReturnValue({
    get: (key: string) => (key === "tab" ? tab : null),
  });
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
  mockUseDepartmentsOptions.mockReturnValue({ options: [], isLoading: false });
  mockGetProduct.mockResolvedValue(baseProduct);
});

describe("ProductDetailPage — deep-link a tab vía query param", () => {
  it("con ?tab=prices, la tab Precios está activa al montar", async () => {
    mockSearchParams("prices");
    render(<ProductDetailPage productId="p1" />);

    await waitFor(() => expect(screen.getByTestId("tab-prices")).toBeInTheDocument());
    expect(screen.queryByTestId("tab-general")).not.toBeInTheDocument();
  });

  it("sin tab en la URL, la tab General está activa al montar", async () => {
    mockSearchParams(null);
    render(<ProductDetailPage productId="p1" />);

    await waitFor(() => expect(screen.getByTestId("tab-general")).toBeInTheDocument());
    expect(screen.queryByTestId("tab-prices")).not.toBeInTheDocument();
  });

  it("con ?tab=algo_invalido, la tab General está activa al montar", async () => {
    mockSearchParams("algo_invalido");
    render(<ProductDetailPage productId="p1" />);

    await waitFor(() => expect(screen.getByTestId("tab-general")).toBeInTheDocument());
    expect(screen.queryByTestId("tab-prices")).not.toBeInTheDocument();
  });

  it("con ?tab=dosifications, la tab Dosificaciones está activa al montar", async () => {
    mockSearchParams("dosifications");
    render(<ProductDetailPage productId="p1" />);

    await waitFor(() => expect(screen.getByTestId("tab-dosifications")).toBeInTheDocument());
    expect(screen.queryByTestId("tab-general")).not.toBeInTheDocument();
  });
});
