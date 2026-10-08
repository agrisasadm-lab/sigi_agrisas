export interface SaleItem {
  id: string;
  productId: string;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  productPriceId: string;
  priceNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  discountAmount: number;
  ivaRate: number;
  iepsRate: number;
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTotal: number;
}

export interface SaleSummary {
  id: string;
  branchId: string;
  branchName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerRfc?: string | null;
  customerAddress?: string | null;
  customerCreditDays?: number | null;
  cashierId: string;
  cashierName?: string | null;
  folioId: string;
  folioCode: string;
  folioNumber: number;
  folioPrefix?: string | null;
  paymentMethodId: string;
  paymentMethodName?: string | null;
  status: "completed" | "cancelled" | "edited" | "returned_total";
  subtotal: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  paymentStatus: "paid" | "partial" | "pending";
  isCredit: boolean;
  createdAt: Date;
  updatedAt: Date;
  creditLimitExceeded?: boolean;
}

export interface SaleDetail extends SaleSummary {
  notes?: string | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  editedAt?: Date | null;
  items: SaleItem[];
  returnedQuantityBySaleItem: Record<string, number>;
}
