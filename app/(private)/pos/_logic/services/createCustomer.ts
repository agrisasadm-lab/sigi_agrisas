import { authFetch, NetworkError } from "../../../../_lib/authFetch";
import type { CustomerDto } from "../types/api";
import { CustomerCodeAlreadyInUseError, CustomerRfcAlreadyInUseError } from "../errors";

export interface CreateCustomerBody {
  code: string;
  name: string;
  rfc?: string;
  legalName?: string;
  taxRegime?: string;
  cfdiUse?: string;
  taxZipCode?: string;
  email?: string;
  phone?: string;
  branchIds?: string[];
}

export async function createCustomer(
  body: CreateCustomerBody,
  fetchImpl = authFetch,
): Promise<CustomerDto> {
  let res: Response;
  try {
    res = await fetchImpl("/api/v1/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  if (res.status === 409) {
    const errBody = await res.json().catch(() => ({ error: "" })) as { error?: string; field?: string };
    const message = (errBody.error ?? "").toLowerCase();
    if (message.includes("rfc")) throw new CustomerRfcAlreadyInUseError();
    throw new CustomerCodeAlreadyInUseError();
  }

  if (!res.ok) throw new NetworkError();

  const dto = await res.json() as Record<string, unknown>;
  return {
    id: dto.id as string,
    code: dto.code as string,
    name: dto.name as string,
    rfc: dto.rfc as string,
    legalName: dto.legalName as string | null | undefined,
    taxRegime: dto.taxRegime as string | null | undefined,
    cfdiUse: dto.cfdiUse as string | null | undefined,
    taxZipCode: dto.taxZipCode as string | null | undefined,
    email: dto.email as string | null | undefined,
    phone: dto.phone as string | null | undefined,
    creditLimit: dto.creditLimit as number | null | undefined,
    currentBalance: (dto.currentBalance as number) ?? 0,
    isActive: dto.isActive as boolean,
  };
}
