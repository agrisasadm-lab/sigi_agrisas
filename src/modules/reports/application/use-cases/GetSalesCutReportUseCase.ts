import { formatMoney as money } from "@/shared/domain/services/formatMoney";
import { SalesCutRepository } from "../ports/SalesCutRepository";
import { SalesCutAssembler } from "../../domain/services/SalesCutAssembler";
import { BreakdownRow, ProductBreakdownRow, SaleListRow } from "../../domain/value-objects/SalesCutFilters";
import {
  SalesCutReportResponseDto,
  SalesCutBreakdownRowDto,
  SalesCutProductBreakdownRowDto,
  SaleListRowDto,
} from "../dto/SalesCutReportResponseDto";

export interface GetSalesCutReportRequest {
  branchId: string | null;
  cashierId: string | null;
  paymentMethodId: string | null;
  from: Date;
  to: Date;
  generatedBy: { userId: string; email: string };
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}


function rowDto(r: BreakdownRow): SalesCutBreakdownRowDto {
  return {
    key: r.key,
    label: r.label,
    ticketCount: r.ticketCount,
    subtotal: money(r.subtotal),
    taxTotal: money(r.taxTotal),
    total: money(r.total),
  };
}

function productRowDto(r: ProductBreakdownRow): SalesCutProductBreakdownRowDto {
  return { ...rowDto(r), quantitySold: money(r.quantitySold) };
}

function saleListRowDto(r: SaleListRow): SaleListRowDto {
  return {
    saleId: r.saleId,
    folioCode: r.folioCode,
    customerName: r.customerName,
    total: money(r.total),
    paymentMethodName: r.paymentMethodName,
  };
}

export class GetSalesCutReportUseCase {
  constructor(private readonly repo: SalesCutRepository) {}

  async execute(req: GetSalesCutReportRequest): Promise<SalesCutReportResponseDto> {
    const agg = await this.repo.getAggregates({
      branchId: req.branchId,
      cashierId: req.cashierId,
      paymentMethodId: req.paymentMethodId,
      from: req.from,
      to: req.to,
    });

    const cut = SalesCutAssembler.assemble(agg);

    return {
      generatedAt: new Date().toISOString(),
      generatedBy: req.generatedBy,
      filters: {
        branchId: req.branchId,
        cashierId: req.cashierId,
        paymentMethodId: req.paymentMethodId,
        from: toDateStr(req.from),
        to: toDateStr(req.to),
      },
      totals: {
        grossSales: money(cut.totals.grossSales),
        ticketCount: cut.totals.ticketCount,
        subtotal: money(cut.totals.subtotal),
        taxTotal: money(cut.totals.taxTotal),
        ivaTotal: money(cut.totals.ivaTotal),
        iepsTotal: money(cut.totals.iepsTotal),
      },
      cancelled: {
        count: cut.cancelled.count,
        total: money(cut.cancelled.total),
      },
      cash: {
        grossSales: money(cut.cash.grossSales),
        paymentsReceived: money(cut.cash.paymentsReceived),
        returnsRefunded: money(cut.cash.returnsRefunded),
        expensesTotal: money(cut.cash.expensesTotal),
        netCash: money(cut.cash.netCash),
      },
      byPaymentMethod: cut.byPaymentMethod.map(rowDto),
      byDay: cut.byDay.map(rowDto),
      byCashier: cut.byCashier.map(rowDto),
      byBranch: cut.byBranch.map(rowDto),
      byDepartment: cut.byDepartment.map(rowDto),
      byProduct: cut.byProduct.map(productRowDto),
      salesList: cut.salesList.map(saleListRowDto),
    };
  }
}
