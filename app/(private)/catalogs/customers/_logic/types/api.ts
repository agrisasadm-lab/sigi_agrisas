export interface CustomerDto {
  id: string;
  code: string;
  name: string;
  rfc: string | null;
  legalName: string | null;
  taxRegime: string | null;
  cfdiUse: string | null;
  taxZipCode: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contactName: string | null;
  notes: string | null;
  creditLimit: number | null;
  currentBalance: number;
  initialBalance: number;
  creditDays: number;
  isActive: boolean;
  addressStreet: string | null;
  addressExteriorNumber: string | null;
  addressInteriorNumber: string | null;
  addressNeighborhood: string | null;
  addressMunicipality: string | null;
  addressState: string | null;
  addressCountry: string | null;
  addressZipCode: string | null;
  branchIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListCustomersResponse {
  items: CustomerDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListCustomersParams {
  page: number;
  pageSize: number;
  includeInactive?: boolean;
  search?: string;
  branchId?: string;
}

export interface CreateCustomerBody {
  code: string;
  name: string;
  /** Obligatorio con bypass (branches:access_all); ignorado sin él — el backend fuerza la sucursal propia. */
  branchIds?: string[];
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
}

export interface UpdateCustomerBody {
  name?: string;
  /** Sólo aplica con bypass — reemplaza el set completo. Un operador sin bypass no puede tocarlo. */
  branchIds?: string[];
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
}
