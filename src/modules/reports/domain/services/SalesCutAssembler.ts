import { Decimal } from "decimal.js";
import { BreakdownRow, ProductBreakdownRow, SalesCutAggregates, SaleListRow } from "../value-objects/SalesCutFilters";

export interface AssembledSalesCut {
  totals: {
    grossSales: number;
    ticketCount: number;
    subtotal: number;
    taxTotal: number;
    ivaTotal: number;
    iepsTotal: number;
  };
  cancelled: { count: number; total: number };
  cash: {
    grossSales: number;
    paymentsReceived: number;
    returnsRefunded: number;
    expensesTotal: number;
    netCash: number;
  };
  byPaymentMethod: BreakdownRow[];
  byDay: BreakdownRow[];
  byCashier: BreakdownRow[];
  byBranch: BreakdownRow[];
  byDepartment: BreakdownRow[];
  byProduct: ProductBreakdownRow[];
  salesList: SaleListRow[];
}

/**
 * Servicio de dominio puro (sin I/O). Ensambla el corte a partir de los
 * agregados crudos: calcula `netCash = grossSales + paymentsReceived −
 * returnsRefunded − expensesTotal` y ordena los desgloses. Redondeo banker's a 4 decimales
 * (decimal.js), consistente con los `*TotalsCalculator`.
 */
export class SalesCutAssembler {
  private static round(n: number): number {
    return new Decimal(n).toDecimalPlaces(4).toNumber();
  }

  private static sortByTotalDesc<T extends BreakdownRow>(rows: T[]): T[] {
    return [...rows].sort((a, b) => b.total - a.total);
  }

  private static sortByDayAsc(rows: BreakdownRow[]): BreakdownRow[] {
    // `key` es la fecha ISO (YYYY-MM-DD) del día.
    return [...rows].sort((a, b) => a.key.localeCompare(b.key));
  }

  static assemble(agg: SalesCutAggregates): AssembledSalesCut {
    const grossSales = new Decimal(agg.active.grossSales);
    const paymentsReceived = new Decimal(agg.paymentsReceived.total);
    const returnsRefunded = new Decimal(agg.returnsRefunded.total);
    const expensesTotal = new Decimal(agg.expenses.total);
    const netCash = grossSales.plus(paymentsReceived).minus(returnsRefunded).minus(expensesTotal);

    return {
      totals: {
        grossSales: this.round(agg.active.grossSales),
        ticketCount: agg.active.ticketCount,
        subtotal: this.round(agg.active.subtotal),
        taxTotal: this.round(agg.active.taxTotal),
        ivaTotal: this.round(agg.taxSplit.ivaTotal),
        iepsTotal: this.round(agg.taxSplit.iepsTotal),
      },
      cancelled: {
        count: agg.cancelled.count,
        total: this.round(agg.cancelled.total),
      },
      cash: {
        grossSales: this.round(agg.active.grossSales),
        paymentsReceived: this.round(agg.paymentsReceived.total),
        returnsRefunded: this.round(agg.returnsRefunded.total),
        expensesTotal: this.round(agg.expenses.total),
        netCash: netCash.toDecimalPlaces(4).toNumber(),
      },
      byPaymentMethod: this.sortByTotalDesc(agg.byPaymentMethod),
      byDay: this.sortByDayAsc(agg.byDay),
      byCashier: this.sortByTotalDesc(agg.byCashier),
      byBranch: this.sortByTotalDesc(agg.byBranch),
      byDepartment: this.sortByTotalDesc(agg.byDepartment),
      byProduct: this.sortByTotalDesc(agg.byProduct),
      salesList: [...agg.salesList].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    };
  }
}
