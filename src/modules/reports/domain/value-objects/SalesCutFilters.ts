/** Filtros del corte de ventas. `from`/`to` ya resueltos (preset "hoy" en el controller). */
export interface SalesCutFilters {
  branchId: string | null;
  cashierId: string | null;
  paymentMethodId: string | null;
  from: Date;
  to: Date;
}

/** Totales de ventas activas (completed + edited) del periodo. */
export interface ActiveTotals {
  grossSales: number;
  ticketCount: number;
  subtotal: number;
  taxTotal: number;
}

/** Ventas canceladas del periodo (reportadas aparte, no suman al neto). */
export interface CancelledTotals {
  count: number;
  total: number;
}

/** Split IVA/IEPS global, agregado desde `sale_items` de ventas activas. */
export interface TaxSplit {
  ivaTotal: number;
  iepsTotal: number;
}

/** Fila de un desglose (por método/cajero/sucursal/día/departamento). */
export interface BreakdownRow {
  key: string;
  label: string;
  ticketCount: number;
  subtotal: number;
  taxTotal: number;
  total: number;
}

/** Fila del desglose por producto: incluye piezas vendidas. */
export interface ProductBreakdownRow extends BreakdownRow {
  quantitySold: number;
}

/** Agregado de abonos cobrados (customer_payments completed) del periodo. */
export interface PaymentsAgg {
  count: number;
  total: number;
}

/** Agregado de devoluciones (returns completed) del periodo. */
export interface ReturnsAgg {
  count: number;
  total: number;
}

/** Agregado de gastos activos (expenses isActive) de la sucursal en el periodo. */
export interface ExpensesAgg {
  count: number;
  total: number;
}

/** Fila del detalle ticket-por-ticket (una fila por venta activa del periodo/filtros). `createdAt` solo se usa para ordenar, no se expone en el DTO. */
export interface SaleListRow {
  saleId: string;
  folioCode: string;
  customerName: string | null;
  total: number;
  paymentMethodName: string;
  createdAt: Date;
}

/** Bolsa de agregados crudos que devuelve el repositorio. */
export interface SalesCutAggregates {
  active: ActiveTotals;
  cancelled: CancelledTotals;
  taxSplit: TaxSplit;
  byPaymentMethod: BreakdownRow[];
  byDay: BreakdownRow[];
  byCashier: BreakdownRow[];
  byBranch: BreakdownRow[];
  byDepartment: BreakdownRow[];
  byProduct: ProductBreakdownRow[];
  paymentsReceived: PaymentsAgg;
  returnsRefunded: ReturnsAgg;
  expenses: ExpensesAgg;
  salesList: SaleListRow[];
}
