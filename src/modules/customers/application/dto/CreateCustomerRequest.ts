export interface CreateCustomerRequest {
  code: string;
  name: string;
  rfc?: string | null;
  legalName?: string | null;
  taxRegime?: string | null;
  cfdiUse?: string | null;
  taxZipCode?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contactName?: string | null;
  notes?: string | null;
  creditLimit?: number | null;
  initialBalance?: number;
  creditDays?: number;
  isActive?: boolean;
  addressStreet?: string | null;
  addressExteriorNumber?: string | null;
  addressInteriorNumber?: string | null;
  addressNeighborhood?: string | null;
  addressMunicipality?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  addressZipCode?: string | null;
  branchIds: string[];
}
