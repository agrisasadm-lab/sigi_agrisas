import { updateCustomer } from "../../../../../../../app/(private)/catalogs/customers/_logic/services/updateCustomer";
import {
  CustomerNotFoundError,
  CustomerRfcAlreadyInUseError,
} from "../../../../../../../app/(private)/catalogs/customers/_logic/errors";

const baseDto = {
  id: "1",
  code: "CLI_001",
  name: "Cliente ACME",
  rfc: "SAC120101A12",
  legalName: "ACME S.A.",
  taxRegime: "601",
  cfdiUse: null,
  taxZipCode: null,
  email: null,
  phone: null,
  address: null,
  contactName: null,
  notes: null,
  creditLimit: null,
  currentBalance: 0,
  creditDays: 60,
  isActive: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
};

describe("updateCustomer", () => {
  it("returns Customer on 200 success", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => baseDto,
    } as Response);

    const result = await updateCustomer(
      { id: "1", body: { legalName: "ACME S.A.", taxRegime: "601" } },
      mockFetch,
    );

    expect(result.legalName).toBe("ACME S.A.");
    expect(result.taxRegime).toBe("601");
  });

  it("sends only creditDays when that is the only field in the diff", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => baseDto,
    } as Response);

    await updateCustomer({ id: "1", body: { creditDays: 60 } }, mockFetch);

    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody).toEqual({ creditDays: 60 });
  });

  it("normalizes rfc to uppercase when present", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => baseDto,
    } as Response);

    await updateCustomer({ id: "1", body: { rfc: "sac120101a12" } }, mockFetch);

    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.rfc).toBe("SAC120101A12");
  });

  it("sends branchIds when present in the diff", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => baseDto,
    } as Response);

    await updateCustomer({ id: "1", body: { branchIds: ["b1", "b2"] } }, mockFetch);

    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody).toEqual({ branchIds: ["b1", "b2"] });
  });

  it("throws CustomerNotFoundError on 404", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Customer not found" }),
    } as Response);

    await expect(
      updateCustomer({ id: "missing", body: { name: "x" } }, mockFetch),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it("throws CustomerRfcAlreadyInUseError on 409", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Customer RFC already in use: XYZ010101000" }),
    } as Response);

    await expect(
      updateCustomer({ id: "1", body: { rfc: "XYZ010101000" } }, mockFetch),
    ).rejects.toBeInstanceOf(CustomerRfcAlreadyInUseError);
  });
});
