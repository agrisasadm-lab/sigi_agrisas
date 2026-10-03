export interface CustomerProps {
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
  createdAt: Date;
  updatedAt: Date;
}

export class Customer {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly rfc: string | null;
  readonly legalName: string | null;
  readonly taxRegime: string | null;
  readonly cfdiUse: string | null;
  readonly taxZipCode: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly contactName: string | null;
  readonly notes: string | null;
  readonly creditLimit: number | null;
  readonly currentBalance: number;
  readonly initialBalance: number;
  readonly creditDays: number;
  readonly isActive: boolean;
  readonly addressStreet: string | null;
  readonly addressExteriorNumber: string | null;
  readonly addressInteriorNumber: string | null;
  readonly addressNeighborhood: string | null;
  readonly addressMunicipality: string | null;
  readonly addressState: string | null;
  readonly addressCountry: string | null;
  readonly addressZipCode: string | null;
  readonly branchIds: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: CustomerProps) {
    this.id = props.id;
    this.code = props.code;
    this.name = props.name;
    this.rfc = props.rfc;
    this.legalName = props.legalName;
    this.taxRegime = props.taxRegime;
    this.cfdiUse = props.cfdiUse;
    this.taxZipCode = props.taxZipCode;
    this.email = props.email;
    this.phone = props.phone;
    this.address = props.address;
    this.contactName = props.contactName;
    this.notes = props.notes;
    this.creditLimit = props.creditLimit;
    this.currentBalance = props.currentBalance;
    this.initialBalance = props.initialBalance;
    this.creditDays = props.creditDays;
    this.isActive = props.isActive;
    this.addressStreet = props.addressStreet;
    this.addressExteriorNumber = props.addressExteriorNumber;
    this.addressInteriorNumber = props.addressInteriorNumber;
    this.addressNeighborhood = props.addressNeighborhood;
    this.addressMunicipality = props.addressMunicipality;
    this.addressState = props.addressState;
    this.addressCountry = props.addressCountry;
    this.addressZipCode = props.addressZipCode;
    this.branchIds = props.branchIds;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CustomerProps): Customer {
    return new Customer(props);
  }
}
