export interface CartLine {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  productPriceId?: string;
  dosificationId?: string;
  priceName: string;
  unitPrice: number;
  ivaRate: number;
  iepsRate: number;
  quantity: number;
  discountType: "pct" | "amount";
  discountPct: number;
  discountAmount: number;
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTotal: number;
}

export interface CartTotals {
  subtotal: number;
  ivaTotal: number;
  iepsTotal: number;
  taxTotal: number;
  total: number;
}

export interface CartState {
  lines: CartLine[];
  totals: CartTotals;
}

export interface SaleDraft {
  branchId: string;
  customerId?: string;
  folioId: string;
  paymentMethodId: string;
  notes?: string;
  lines: CartLine[];
}

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
  rfc: string;
  currentBalance: number;
}

export interface HqState {
  hq: { id: string; code: string; name: string } | null;
  isLoading: boolean;
}
