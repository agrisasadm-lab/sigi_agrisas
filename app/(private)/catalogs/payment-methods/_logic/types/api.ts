export interface PaymentMethodDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isCredit: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListPaymentMethodsResponse {
  items: PaymentMethodDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePaymentMethodBody {
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  isCredit?: boolean;
}

export interface UpdatePaymentMethodBody {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}
