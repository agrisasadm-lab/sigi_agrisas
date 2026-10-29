import { Prisma, PrismaClient } from "@prisma/client";
import { SalesCutRepository } from "../../application/ports/SalesCutRepository";
import {
  SalesCutFilters,
  SalesCutAggregates,
  BreakdownRow,
  ProductBreakdownRow,
} from "../../domain/value-objects/SalesCutFilters";

const ACTIVE_STATUSES = ["completed", "edited"];

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export class PrismaSalesCutRepository implements SalesCutRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAggregates(filters: SalesCutFilters): Promise<SalesCutAggregates> {
    const to = endOfDay(filters.to);
    const from = filters.from;
    const branchWhere = filters.branchId ? { branchId: filters.branchId } : {};
    const cashierWhere = filters.cashierId ? { cashierId: filters.cashierId } : {};
    const pmWhere = filters.paymentMethodId ? { paymentMethodId: filters.paymentMethodId } : {};

    const activeWhere: Prisma.SaleWhereInput = {
      status: { in: ACTIVE_STATUSES },
      createdAt: { gte: from, lte: to },
      ...branchWhere,
      ...cashierWhere,
      ...pmWhere,
    };
    const cancelledWhere: Prisma.SaleWhereInput = {
      status: "cancelled",
      createdAt: { gte: from, lte: to },
      ...branchWhere,
      ...cashierWhere,
      ...pmWhere,
    };

    // Condiciones SQL para los queries raw (byDay, taxSplit).
    const salesConds = (prefix: string) => {
      const conds: Prisma.Sql[] = [
        Prisma.sql`${Prisma.raw(prefix)}status IN ('completed','edited')`,
        Prisma.sql`${Prisma.raw(prefix)}created_at >= ${from}`,
        Prisma.sql`${Prisma.raw(prefix)}created_at <= ${to}`,
      ];
      if (filters.branchId) conds.push(Prisma.sql`${Prisma.raw(prefix)}branch_id = ${filters.branchId}`);
      if (filters.cashierId) conds.push(Prisma.sql`${Prisma.raw(prefix)}cashier_id = ${Prisma.sql`${filters.cashierId}::uuid`}`);
      if (filters.paymentMethodId) conds.push(Prisma.sql`${Prisma.raw(prefix)}payment_method_id = ${filters.paymentMethodId}`);
      return Prisma.join(conds, " AND ");
    };

    const [
      activeAgg,
      cancelledAgg,
      pmGroup,
      cashierGroup,
      branchGroup,
      dayRows,
      taxRows,
      departmentRows,
      productRows,
      paymentsAgg,
      returnsAgg,
      expensesAgg,
      salesListRows,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: activeWhere,
        _sum: { total: true, subtotal: true, taxTotal: true },
        _count: { _all: true },
      }),
      this.prisma.sale.aggregate({
        where: cancelledWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.sale.groupBy({
        by: ["paymentMethodId"],
        where: activeWhere,
        _sum: { total: true, subtotal: true, taxTotal: true },
        _count: { _all: true },
      }),
      this.prisma.sale.groupBy({
        by: ["cashierId"],
        where: activeWhere,
        _sum: { total: true, subtotal: true, taxTotal: true },
        _count: { _all: true },
      }),
      this.prisma.sale.groupBy({
        by: ["branchId"],
        where: activeWhere,
        _sum: { total: true, subtotal: true, taxTotal: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<
        Array<{ day: string; ticket_count: number; subtotal: string; tax_total: string; total: string }>
      >`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS ticket_count,
               COALESCE(SUM(subtotal), 0) AS subtotal,
               COALESCE(SUM(tax_total), 0) AS tax_total,
               COALESCE(SUM(total), 0) AS total
        FROM sales
        WHERE ${salesConds("")}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ iva: string; ieps: string }>>`
        SELECT COALESCE(SUM(si.line_subtotal * COALESCE(si.iva_rate, 0)), 0) AS iva,
               COALESCE(SUM(si.line_subtotal * COALESCE(si.ieps_rate, 0)), 0) AS ieps
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE ${salesConds("s.")}
      `,
      this.prisma.$queryRaw<
        Array<{
          department_id: string;
          department_name: string;
          ticket_count: number;
          subtotal: string;
          tax_total: string;
          total: string;
        }>
      >`
        SELECT p.department_id AS department_id,
               d.name AS department_name,
               COUNT(DISTINCT si.sale_id)::int AS ticket_count,
               COALESCE(SUM(si.line_subtotal), 0) AS subtotal,
               COALESCE(SUM(si.line_tax), 0) AS tax_total,
               COALESCE(SUM(si.line_total), 0) AS total
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        JOIN departments d ON d.id = p.department_id
        WHERE ${salesConds("s.")}
        GROUP BY p.department_id, d.name
      `,
      this.prisma.$queryRaw<
        Array<{
          product_id: string;
          product_code: string;
          product_name: string;
          ticket_count: number;
          quantity_sold: string;
          subtotal: string;
          tax_total: string;
          total: string;
        }>
      >`
        SELECT si.product_id AS product_id,
               p.code AS product_code,
               p.name AS product_name,
               COUNT(DISTINCT si.sale_id)::int AS ticket_count,
               COALESCE(SUM(si.quantity), 0) AS quantity_sold,
               COALESCE(SUM(si.line_subtotal), 0) AS subtotal,
               COALESCE(SUM(si.line_tax), 0) AS tax_total,
               COALESCE(SUM(si.line_total), 0) AS total
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE ${salesConds("s.")}
        GROUP BY si.product_id, p.code, p.name
      `,
      this.prisma.customerPayment.aggregate({
        where: {
          status: "completed",
          createdAt: { gte: from, lte: to },
          ...branchWhere,
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.return.aggregate({
        where: {
          status: "completed",
          returnedAt: { gte: from, lte: to },
          ...branchWhere,
        },
        _sum: { refundTotal: true },
        _count: { _all: true },
      }),
      // Gastos: sólo sucursal + fechas (no tienen cajero ni método de pago).
      // `expenseDate` es DATE, `from`/`to` a medianoche UTC bastan.
      this.prisma.expense.aggregate({
        where: {
          isActive: true,
          expenseDate: { gte: from, lte: filters.to },
          ...branchWhere,
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.sale.findMany({
        where: activeWhere,
        select: {
          id: true,
          folioCode: true,
          total: true,
          createdAt: true,
          customer: { select: { name: true } },
          paymentMethod: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Resolver nombres de los desgloses.
    const pmIds = pmGroup.map((g) => g.paymentMethodId);
    const cashierIds = cashierGroup.map((g) => g.cashierId);
    const branchIds = branchGroup.map((g) => g.branchId);

    const [pmNames, cashierNames, branchNames] = await Promise.all([
      pmIds.length
        ? this.prisma.paymentMethod.findMany({ where: { id: { in: pmIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      cashierIds.length
        ? this.prisma.user.findMany({ where: { id: { in: cashierIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      branchIds.length
        ? this.prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);

    const nameMap = (rows: Array<{ id: string; name: string | null }>) =>
      new Map(rows.map((r) => [r.id, r.name ?? r.id]));
    const pmMap = nameMap(pmNames);
    const cashierMap = nameMap(cashierNames);
    const branchMap = nameMap(branchNames);

    const toRow = (
      key: string,
      label: string,
      sum: { total: Prisma.Decimal | null; subtotal: Prisma.Decimal | null; taxTotal: Prisma.Decimal | null },
      count: number
    ): BreakdownRow => ({
      key,
      label,
      ticketCount: count,
      subtotal: Number(sum.subtotal ?? 0),
      taxTotal: Number(sum.taxTotal ?? 0),
      total: Number(sum.total ?? 0),
    });

    return {
      active: {
        grossSales: Number(activeAgg._sum.total ?? 0),
        ticketCount: activeAgg._count._all,
        subtotal: Number(activeAgg._sum.subtotal ?? 0),
        taxTotal: Number(activeAgg._sum.taxTotal ?? 0),
      },
      cancelled: {
        count: cancelledAgg._count._all,
        total: Number(cancelledAgg._sum.total ?? 0),
      },
      taxSplit: {
        ivaTotal: Number(taxRows[0]?.iva ?? 0),
        iepsTotal: Number(taxRows[0]?.ieps ?? 0),
      },
      byPaymentMethod: pmGroup.map((g) =>
        toRow(g.paymentMethodId, pmMap.get(g.paymentMethodId) ?? g.paymentMethodId, g._sum, g._count._all)
      ),
      byDay: dayRows.map((d) => ({
        key: d.day,
        label: d.day,
        ticketCount: Number(d.ticket_count),
        subtotal: Number(d.subtotal),
        taxTotal: Number(d.tax_total),
        total: Number(d.total),
      })),
      byCashier: cashierGroup.map((g) =>
        toRow(g.cashierId, cashierMap.get(g.cashierId) ?? g.cashierId, g._sum, g._count._all)
      ),
      byBranch: branchGroup.map((g) =>
        toRow(g.branchId, branchMap.get(g.branchId) ?? g.branchId, g._sum, g._count._all)
      ),
      byDepartment: departmentRows.map((d) => ({
        key: d.department_id,
        label: d.department_name,
        ticketCount: Number(d.ticket_count),
        subtotal: Number(d.subtotal),
        taxTotal: Number(d.tax_total),
        total: Number(d.total),
      })),
      byProduct: productRows.map(
        (p): ProductBreakdownRow => ({
          key: p.product_id,
          label: `${p.product_name} (${p.product_code})`,
          ticketCount: Number(p.ticket_count),
          quantitySold: Number(p.quantity_sold),
          subtotal: Number(p.subtotal),
          taxTotal: Number(p.tax_total),
          total: Number(p.total),
        })
      ),
      paymentsReceived: {
        count: paymentsAgg._count._all,
        total: Number(paymentsAgg._sum.amount ?? 0),
      },
      returnsRefunded: {
        count: returnsAgg._count._all,
        total: Number(returnsAgg._sum.refundTotal ?? 0),
      },
      expenses: {
        count: expensesAgg._count._all,
        total: Number(expensesAgg._sum.amount ?? 0),
      },
      salesList: salesListRows.map((r) => ({
        saleId: r.id,
        folioCode: r.folioCode,
        customerName: r.customer?.name ?? null,
        total: Number(r.total),
        paymentMethodName: r.paymentMethod.name,
        createdAt: r.createdAt,
      })),
    };
  }
}
