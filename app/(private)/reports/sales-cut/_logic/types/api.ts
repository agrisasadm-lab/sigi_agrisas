export interface SalesCutBreakdownRowDto {
  key: string;
  label: string;
  ticketCount: number;
  subtotal: string;
  taxTotal: string;
  total: string;
  quantitySold?: string;
}

export interface SaleListRowDto {
  saleId: string;
  folioCode: string;
  customerName: string | null;
  total: string;
  paymentMethodName: string;
}

export interface SalesCutReportDto {
  generatedAt: string;
  generatedBy: { userId: string; email: string };
  filters: {
    branchId: string | null;
    cashierId: string | null;
    paymentMethodId: string | null;
    from: string;
    to: string;
  };
  totals: {
    grossSales: string;
    ticketCount: number;
    subtotal: string;
    taxTotal: string;
    ivaTotal: string;
    iepsTotal: string;
  };
  cancelled: { count: number; total: string };
  cash: {
    grossSales: string;
    paymentsReceived: string;
    returnsRefunded: string;
    expensesTotal: string;
    netCash: string;
  };
  byPaymentMethod: SalesCutBreakdownRowDto[];
  byDay: SalesCutBreakdownRowDto[];
  byCashier: SalesCutBreakdownRowDto[];
  byBranch: SalesCutBreakdownRowDto[];
  byDepartment: SalesCutBreakdownRowDto[];
  byProduct: SalesCutBreakdownRowDto[];
  salesList: SaleListRowDto[];
}
