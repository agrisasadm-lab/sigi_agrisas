export interface ListCustomersRequest {
  page: number;
  pageSize: number;
  includeInactive: boolean;
  search?: string;
  branchId?: string;
}
