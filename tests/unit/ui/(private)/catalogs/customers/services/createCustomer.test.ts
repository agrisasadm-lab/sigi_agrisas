import { createCustomer } from "../../../../../../../app/(private)/catalogs/customers/_logic/services/createCustomer";
import { NetworkError } from "../../../../../../../app/_lib/authFetch";
import {
  CustomerCodeAlreadyInUseError,
  CustomerRfcAlreadyInUseError,
} from "../../../../../../../app/(private)/catalogs/customers/_logic/errors";

const baseDto = {
  id: "1",
  code: "CLI_001",
  name: "Cliente ACME",
  rfc: "SAC120101A12",
  legalName: null,
  taxRegime: null,
  cfdiUse: null,
  taxZipCode: null,
  email: null,
  phone: null,
  address: null,
  contactName: null,
  notes: null,
  creditLimit: null,
  currentBalance: 0,
  creditDays: 30,
  isActive: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("createCustomer", () => {
  it("returns Customer on 201 success", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => baseDto,
    } as Response);

    const result = await createCustomer(
      { body: { code: "CLI_001", name: "Cliente ACME", rfc: "SAC120101A12" } },
      mockFetch,
    );

    expect(result.id).toBe("1");
    expect(result.code).toBe("CLI_001");
    expect(result.creditDays).toBe(30);
  });

  it("normalizes code and rfc to uppercase before sending", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => baseDto,
    } as Response);

    await createCustomer(
      { body: { code: " cli_001 ", name: "Cliente ACME", rfc: " sac120101a12 " } },
      mockFetch,
    );

    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.code).toBe("CLI_001");
    expect(sentBody.rfc).toBe("SAC120101A12");
  });

  it("omits creditDays from body when not provided, leaving backend default", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => baseDto,
    } as Response);

    await createCustomer(
      { body: { code: "CLI_001", name: "Cliente ACME", rfc: "SAC120101A12" } },
      mockFetch,
    );

    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.creditDays).toBeUndefined();
  });

  it("includes branchIds in body when provided", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => baseDto,
    } as Response);

    await createCustomer(
      { body: { code: "CLI_001", name: "Cliente ACME", rfc: "SAC120101A12", branchIds: ["b1", "b2"] } },
      mockFetch,
    );

    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.branchIds).toEqual(["b1", "b2"]);
  });

  it("throws CustomerCodeAlreadyInUseError on 409 with 'code already in use'", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Customer code already in use: CLI_001" }),
    } as Response);

    await expect(
      createCustomer(
        { body: { code: "CLI_001", name: "Acme", rfc: "SAC120101A12" } },
        mockFetch,
      ),
    ).rejects.toBeInstanceOf(CustomerCodeAlreadyInUseError);
  });

  it("throws CustomerRfcAlreadyInUseError on 409 with 'RFC already in use'", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Customer RFC already in use: SAC120101A12" }),
    } as Response);

    await expect(
      createCustomer(
        { body: { code: "CLI_001", name: "Acme", rfc: "SAC120101A12" } },
        mockFetch,
      ),
    ).rejects.toBeInstanceOf(CustomerRfcAlreadyInUseError);
  });

  it("throws NetworkError on 400", async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad request" }),
    } as Response);

    await expect(
      createCustomer(
        { body: { code: "CLI_001", name: "Acme", rfc: "SAC120101A12" } },
        mockFetch,
      ),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
