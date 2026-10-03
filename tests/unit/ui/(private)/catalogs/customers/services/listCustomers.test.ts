import { listCustomers } from "../../../../../../../app/(private)/catalogs/customers/_logic/services/listCustomers";
import { UnauthenticatedError, ForbiddenError, NetworkError } from "../../../../../../../app/_lib/authFetch";

const baseDto = {
  id: "1",
  code: "CLI_001",
  name: "Cliente ACME",
  rfc: "SAC120101A12",
  legalName: "Cliente ACME S.A. de C.V.",
  taxRegime: "601",
  cfdiUse: "G03",
  taxZipCode: "06600",
  email: "contacto@acme.com",
  phone: "555-1234",
  address: "Av. Reforma 123",
  contactName: "Juan Pérez",
  notes: null,
  creditLimit: 50000,
  currentBalance: 1000,
  creditDays: 30,
  isActive: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("listCustomers", () => {
  it("returns items with Date instances and creditDays on success 200", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [baseDto], total: 1, page: 1, pageSize: 20 }),
    } as Response);

    const result = await listCustomers({ page: 1, pageSize: 20 }, mockFetch);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].createdAt).toBeInstanceOf(Date);
    expect(result.items[0].updatedAt).toBeInstanceOf(Date);
    expect(result.items[0].creditDays).toBe(30);
    expect(result.items[0].creditLimit).toBe(50000);
    expect(result.items[0].currentBalance).toBe(1000);
  });

  it("includes includeInactive=true in URL when set", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
    } as Response);

    await listCustomers({ page: 1, pageSize: 20, includeInactive: true }, mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("includeInactive=true");
  });

  it("includes search in URL when 2+ chars", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
    } as Response);

    await listCustomers({ page: 1, pageSize: 20, search: "acme" }, mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("search=acme");
  });

  it("includes branchId in URL when set", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
    } as Response);

    await listCustomers({ page: 1, pageSize: 20, branchId: "b1" }, mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("branchId=b1");
  });

  it("omits branchId from URL when not set", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
    } as Response);

    await listCustomers({ page: 1, pageSize: 20 }, mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("branchId=");
  });

  it("maps branchIds from the DTO", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ ...baseDto, branchIds: ["b1", "b2"] }],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    } as Response);

    const result = await listCustomers({ page: 1, pageSize: 20 }, mockFetch);
    expect(result.items[0].branchIds).toEqual(["b1", "b2"]);
  });

  it("omits search when single character", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
    } as Response);

    await listCustomers({ page: 1, pageSize: 20, search: "a" }, mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("search=");
  });

  it("throws UnauthenticatedError on 401", async () => {
    const mockFetch = jest.fn().mockRejectedValueOnce(new UnauthenticatedError());

    await expect(listCustomers({ page: 1, pageSize: 20 }, mockFetch)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("throws ForbiddenError on 403", async () => {
    const mockFetch = jest.fn().mockRejectedValueOnce(new ForbiddenError("customers:read"));

    await expect(listCustomers({ page: 1, pageSize: 20 }, mockFetch)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NetworkError on network failure", async () => {
    const mockFetch = jest.fn().mockRejectedValueOnce(new NetworkError());

    await expect(listCustomers({ page: 1, pageSize: 20 }, mockFetch)).rejects.toBeInstanceOf(NetworkError);
  });

  it("handles nullable optional fields in response", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ ...baseDto, legalName: null, taxRegime: null, cfdiUse: null, creditLimit: null }],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    } as Response);

    const result = await listCustomers({ page: 1, pageSize: 20 }, mockFetch);
    expect(result.items[0].legalName).toBeNull();
    expect(result.items[0].taxRegime).toBeNull();
    expect(result.items[0].creditLimit).toBeNull();
  });
});
