import { SalesCutRepository } from "../../application/ports/SalesCutRepository";
import {
  SalesCutFilters,
  SalesCutAggregates,
  BreakdownRow,
  ProductBreakdownRow,
} from "../../domain/value-objects/SalesCutFilters";

export interface InMemCutSaleItem {
  productId: string;
  productCode: string;
  productName: string;
  departmentId: string;
  departmentName: string;
  quantity: number;
  subtotal: number;
  taxTotal: number;
  total: number;
}

export interface InMemCutSale {
  id: string;
  status: string; // completed | edited | cancelled
  total: number;
  subtotal: number;
  taxTotal: number;
  iva: number;
  ieps: number;
  branchId: string;
  branchName: string;
  cashierId: string;
  cashierName: string;
  paymentMethodId: string;
  paymentMethodName: string;
  createdAt: Date;
  folioCode?: string;
  customerName?: string | null;
  items?: InMemCutSaleItem[];
}

export interface InMemCutPayment {
  amount: number;
  status: string; // completed | cancelled
  branchId: string;
  createdAt: Date;
}

export interface InMemCutReturn {
  refundTotal: number;
  status: string; // completed | cancelled
  branchId: string;
  returnedAt: Date;
}

export interface InMemCutExpense {
  amount: number;
  isActive: boolean;
  branchId: string;
  expenseDate: Date;
}

const ACTIVE = ["completed", "edited"];

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export class InMemorySalesCutRepository implements SalesCutRepository {
  constructor(
    private readonly sales: InMemCutSale[],
    private readonly payments: InMemCutPayment[] = [],
    private readonly returns: InMemCutReturn[] = [],
    private readonly expenses: InMemCutExpense[] = []
  ) {}

  async getAggregates(f: SalesCutFilters): Promise<SalesCutAggregates> {
    const to = endOfDay(f.to);
    const inPeriod = (d: Date) => d >= f.from && d <= to;
    const matchesSale = (s: InMemCutSale) =>
      inPeriod(s.createdAt) &&
      (!f.branchId || s.branchId === f.branchId) &&
      (!f.cashierId || s.cashierId === f.cashierId) &&
      (!f.paymentMethodId || s.paymentMethodId === f.paymentMethodId);

    const active = this.sales.filter((s) => matchesSale(s) && ACTIVE.includes(s.status));
    const cancelled = this.sales.filter((s) => matchesSale(s) && s.status === "cancelled");

    const sum = (arr: InMemCutSale[], pick: (s: InMemCutSale) => number) =>
      arr.reduce((acc, s) => acc + pick(s), 0);

    const group = (
      keyOf: (s: InMemCutSale) => string,
      labelOf: (s: InMemCutSale) => string
    ): BreakdownRow[] => {
      const map = new Map<string, BreakdownRow>();
      for (const s of active) {
        const key = keyOf(s);
        const row = map.get(key) ?? {
          key,
          label: labelOf(s),
          ticketCount: 0,
          subtotal: 0,
          taxTotal: 0,
          total: 0,
        };
        row.ticketCount += 1;
        row.subtotal += s.subtotal;
        row.taxTotal += s.taxTotal;
        row.total += s.total;
        map.set(key, row);
      }
      return [...map.values()];
    };

    const dayKey = (s: InMemCutSale) => s.createdAt.toISOString().split("T")[0];

    interface Accum {
      label: string;
      saleIds: Set<string>;
      quantitySold: number;
      subtotal: number;
      taxTotal: number;
      total: number;
    }
    const departmentAcc = new Map<string, Accum>();
    const productAcc = new Map<string, Accum>();
    const bump = (map: Map<string, Accum>, key: string, label: string, saleId: string, item: InMemCutSaleItem) => {
      const acc = map.get(key) ?? { label, saleIds: new Set<string>(), quantitySold: 0, subtotal: 0, taxTotal: 0, total: 0 };
      acc.saleIds.add(saleId);
      acc.quantitySold += item.quantity;
      acc.subtotal += item.subtotal;
      acc.taxTotal += item.taxTotal;
      acc.total += item.total;
      map.set(key, acc);
    };
    for (const s of active) {
      for (const item of s.items ?? []) {
        bump(departmentAcc, item.departmentId, item.departmentName, s.id, item);
        bump(productAcc, item.productId, `${item.productName} (${item.productCode})`, s.id, item);
      }
    }
    const toBreakdownRow = (key: string, acc: Accum): BreakdownRow => ({
      key,
      label: acc.label,
      ticketCount: acc.saleIds.size,
      subtotal: acc.subtotal,
      taxTotal: acc.taxTotal,
      total: acc.total,
    });
    const toProductRow = (key: string, acc: Accum): ProductBreakdownRow => ({
      ...toBreakdownRow(key, acc),
      quantitySold: acc.quantitySold,
    });

    const payments = this.payments.filter(
      (p) => inPeriod(p.createdAt) && p.status === "completed" && (!f.branchId || p.branchId === f.branchId)
    );
    const returns = this.returns.filter(
      (r) => inPeriod(r.returnedAt) && r.status === "completed" && (!f.branchId || r.branchId === f.branchId)
    );

    // Gastos: sólo sucursal + fechas (sin cajero/método de pago).
    const expenses = this.expenses.filter(
      (e) => e.isActive && inPeriod(e.expenseDate) && (!f.branchId || e.branchId === f.branchId)
    );

    return {
      active: {
        grossSales: sum(active, (s) => s.total),
        ticketCount: active.length,
        subtotal: sum(active, (s) => s.subtotal),
        taxTotal: sum(active, (s) => s.taxTotal),
      },
      cancelled: {
        count: cancelled.length,
        total: sum(cancelled, (s) => s.total),
      },
      taxSplit: {
        ivaTotal: sum(active, (s) => s.iva),
        iepsTotal: sum(active, (s) => s.ieps),
      },
      byPaymentMethod: group((s) => s.paymentMethodId, (s) => s.paymentMethodName),
      byDay: group(dayKey, dayKey),
      byCashier: group((s) => s.cashierId, (s) => s.cashierName),
      byBranch: group((s) => s.branchId, (s) => s.branchName),
      byDepartment: [...departmentAcc.entries()].map(([key, acc]) => toBreakdownRow(key, acc)),
      byProduct: [...productAcc.entries()].map(([key, acc]) => toProductRow(key, acc)),
      paymentsReceived: {
        count: payments.length,
        total: payments.reduce((a, p) => a + p.amount, 0),
      },
      returnsRefunded: {
        count: returns.length,
        total: returns.reduce((a, r) => a + r.refundTotal, 0),
      },
      expenses: {
        count: expenses.length,
        total: expenses.reduce((a, e) => a + e.amount, 0),
      },
      salesList: [...active]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((s) => ({
          saleId: s.id,
          folioCode: s.folioCode ?? s.id,
          customerName: s.customerName ?? null,
          total: s.total,
          paymentMethodName: s.paymentMethodName,
          createdAt: s.createdAt,
        })),
    };
  }
}
