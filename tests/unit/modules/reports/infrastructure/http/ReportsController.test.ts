// @react-pdf/renderer is a server-only ESM lib; mock it for the node test env
jest.mock("@react-pdf/renderer", () => ({
  renderToBuffer: jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock")),
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (s: unknown) => s },
}));

jest.mock("@/modules/reports/infrastructure/pdf/InventoryStockReportPdf", () => ({
  InventoryStockReportPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/PaymentHistoryReportPdf", () => ({
  PaymentHistoryReportPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/AccountStatementPdf", () => ({
  AccountStatementSummaryPdf: () => null,
  AccountStatementLedgerPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/AnticipoReceiptPdf", () => ({
  AnticipoReceiptPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/SalesCutReportPdf", () => ({
  SalesCutReportPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/CashCutReportPdf", () => ({
  CashCutReportPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/DepartmentPriceListReportPdf", () => ({
  DepartmentPriceListReportPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/PurchasesReportPdf", () => ({
  PurchasesReportPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/ProviderPaymentsReportPdf", () => ({
  ProviderPaymentsReportPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/SalesByProductReportPdf", () => ({
  SalesByProductReportPdf: () => null,
}));

jest.mock("@/modules/reports/infrastructure/pdf/CollectionsReportPdf", () => ({
  CollectionsReportPdf: () => null,
}));

jest.mock("@/modules/rbac/infrastructure/di/container", () => ({
  rbacContainer: {
    authorizationService: {
      userCan: jest.fn().mockResolvedValue(false),
      listUserPermissions: jest.fn().mockResolvedValue([]),
      invalidate: jest.fn(),
      invalidateByRole: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

import { NextRequest } from "next/server";
import { Decimal } from "decimal.js";
import * as XLSX from "xlsx";
import { ReportsController } from "@/modules/reports/infrastructure/http/ReportsController";
import { GetInventoryStockReportUseCase } from "@/modules/reports/application/use-cases/GetInventoryStockReportUseCase";
import { GetPaymentHistoryReportUseCase } from "@/modules/reports/application/use-cases/GetPaymentHistoryReportUseCase";
import { InMemoryInventoryReportRepository } from "@/modules/reports/infrastructure/repositories/InMemoryInventoryReportRepository";
import { InMemoryPaymentReportRepository } from "@/modules/reports/infrastructure/repositories/InMemoryPaymentReportRepository";
import { RawStockRow } from "@/modules/reports/application/ports/InventoryReportRepository";
import { RawPaymentRow } from "@/modules/reports/application/ports/PaymentReportRepository";
import { GetAccountStatementsSummaryUseCase } from "@/modules/reports/application/use-cases/GetAccountStatementsSummaryUseCase";
import { GetAccountStatementLedgerUseCase } from "@/modules/reports/application/use-cases/GetAccountStatementLedgerUseCase";
import { GetAnticipoReceiptUseCase } from "@/modules/reports/application/use-cases/GetAnticipoReceiptUseCase";
import {
  InMemoryAccountStatementRepository,
  InMemoryStatementCustomer,
  InMemoryStatementMovement,
  InMemoryAnticipoReceipt,
} from "@/modules/reports/infrastructure/repositories/InMemoryAccountStatementRepository";
import { GetSalesCutReportUseCase } from "@/modules/reports/application/use-cases/GetSalesCutReportUseCase";
import {
  InMemorySalesCutRepository,
  InMemCutSale,
} from "@/modules/reports/infrastructure/repositories/InMemorySalesCutRepository";
import { GetCashCutReportUseCase } from "@/modules/reports/application/use-cases/GetCashCutReportUseCase";
import {
  InMemoryCashCutRepository,
  InMemCutPayment,
} from "@/modules/reports/infrastructure/repositories/InMemoryCashCutRepository";
import { GetDepartmentPriceListReportUseCase } from "@/modules/reports/application/use-cases/GetDepartmentPriceListReportUseCase";
import { InMemoryDepartmentPriceListRepository } from "@/modules/reports/infrastructure/repositories/InMemoryDepartmentPriceListRepository";
import { RawPriceListRow } from "@/modules/reports/application/ports/DepartmentPriceListRepository";
import { GetPurchasesReportUseCase } from "@/modules/reports/application/use-cases/GetPurchasesReportUseCase";
import { InMemoryPurchaseRepository } from "@/modules/purchases/infrastructure/repositories/InMemoryPurchaseRepository";
import { GetProviderPaymentsReportUseCase } from "@/modules/reports/application/use-cases/GetProviderPaymentsReportUseCase";
import { InMemoryProviderPaymentReportRepository, InMemProviderPayment } from "@/modules/reports/infrastructure/repositories/InMemoryProviderPaymentReportRepository";
import { GetSalesByProductReportUseCase } from "@/modules/reports/application/use-cases/GetSalesByProductReportUseCase";
import { InMemorySalesByProductRepository } from "@/modules/reports/infrastructure/repositories/InMemorySalesByProductRepository";
import { SalesByProductPage } from "@/modules/reports/domain/value-objects/SalesByProductFilters";
import { GetCollectionsReportUseCase } from "@/modules/reports/application/use-cases/GetCollectionsReportUseCase";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { GetTicketSettingsUseCase } from "@/modules/settings/application/use-cases/GetTicketSettingsUseCase";
import { InMemoryTicketSettingsRepository } from "@/modules/settings/infrastructure/repositories/InMemoryTicketSettingsRepository";

const BASE_URL = "http://localhost:3000/api/v1/admin/reports";
const BRANCH_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_BRANCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEPT_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function makeAuthz(overrides: { userCan?: (id: string, key: string) => Promise<boolean> } = {}): AuthorizationService {
  return {
    userCan: overrides.userCan ?? jest.fn().mockResolvedValue(true),
    listUserPermissions: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
    invalidateByRole: jest.fn().mockResolvedValue(undefined),
  };
}

function makeStockRow(): RawStockRow {
  return {
    branchId: BRANCH_ID, branchCode: "MAT", branchName: "Matriz", isHeadquarters: true,
    departmentId: DEPT_ID, departmentCode: "D1", departmentName: "Dept 1",
    productId: "prod-1", code: "P001", name: "Prod 1", unit: "PZA", unitDescription: null,
    quantity: new Decimal("10"), reservedQuantity: new Decimal("0"), reorderPoint: new Decimal("5"),
  };
}

function makePaymentRow(): RawPaymentRow {
  return {
    paymentId: "pay-1", folioNumber: "RECIBO-001", saleId: "sale-1", saleFolioNumber: "VNT-001",
    customerId: "cust-1", customerCode: "C001", customerName: "Cliente", branchId: BRANCH_ID, branchCode: "MAT",
    amount: new Decimal("500"), paymentDate: new Date("2026-06-01T10:00:00Z"), status: "completed",
    registeredBy: USER_ID, registeredByEmail: "op@test.com",
  };
}

function makePriceListRow(): RawPriceListRow {
  return {
    departmentId: DEPT_ID, departmentCode: "D1", departmentName: "Dept 1",
    productId: "prod-1", code: "P001", name: "Prod 1", unit: "PZA", unitDescription: null,
    stockQuantity: new Decimal("10.0000"),
    ivaRate: new Decimal("0.1600"), iepsRate: null, acquisitionPrice: null,
    priceId: "price-1", priceName: "Menudeo", price: new Decimal("100.0000"),
    minQuantity: 1, discountPct: new Decimal("0.00"), isDefault: true,
  };
}

function emptyAccountUseCases() {
  const repo = new InMemoryAccountStatementRepository([], []);
  return {
    summary: new GetAccountStatementsSummaryUseCase(repo),
    ledger: new GetAccountStatementLedgerUseCase(repo),
    anticipo: new GetAnticipoReceiptUseCase(repo),
  };
}

function emptySalesCutUseCase(sales: InMemCutSale[] = []) {
  return new GetSalesCutReportUseCase(new InMemorySalesCutRepository(sales));
}

function emptyCashCutUseCase(payments: InMemCutPayment[] = []) {
  return new GetCashCutReportUseCase(new InMemoryCashCutRepository(payments));
}

function emptyDepartmentPriceListUseCase(rows: RawPriceListRow[] = []) {
  return new GetDepartmentPriceListReportUseCase(new InMemoryDepartmentPriceListRepository(rows));
}

function emptyPurchasesUseCase() {
  return new GetPurchasesReportUseCase(new InMemoryPurchaseRepository());
}

function emptyProviderPaymentsUseCase(rows: InMemProviderPayment[] = []) {
  return new GetProviderPaymentsReportUseCase(new InMemoryProviderPaymentReportRepository(rows));
}

function emptySalesByProductUseCase() {
  return new GetSalesByProductReportUseCase(
    new InMemorySalesByProductRepository(() => ({
      totals: { ticketCount: 0, subtotal: 0, taxTotal: 0, total: 0 },
      rows: [],
      rowsTotal: 0,
    }))
  );
}

function emptyCollectionsUseCase() {
  return new GetCollectionsReportUseCase(new InMemoryCashCutRepository([]));
}

const NEW_REPORT_USE_CASES = () =>
  [emptyPurchasesUseCase(), emptyProviderPaymentsUseCase(), emptySalesByProductUseCase(), emptyCollectionsUseCase()] as const;

function makeStockController(rows: RawStockRow[] = [], authz?: AuthorizationService) {
  const repo = new InMemoryInventoryReportRepository(rows);
  const stockUC = new GetInventoryStockReportUseCase(repo);
  const payRepo = new InMemoryPaymentReportRepository([]);
  const payUC = new GetPaymentHistoryReportUseCase(payRepo);
  const acc = emptyAccountUseCases();
  return new ReportsController(stockUC, payUC, acc.summary, acc.ledger, acc.anticipo, emptySalesCutUseCase(), emptyCashCutUseCase(), emptyDepartmentPriceListUseCase(), ...NEW_REPORT_USE_CASES(), authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository()));
}

function makePaymentController(rows: RawPaymentRow[] = [], authz?: AuthorizationService) {
  const stockRepo = new InMemoryInventoryReportRepository([]);
  const stockUC = new GetInventoryStockReportUseCase(stockRepo);
  const payRepo = new InMemoryPaymentReportRepository(rows);
  const payUC = new GetPaymentHistoryReportUseCase(payRepo);
  const acc = emptyAccountUseCases();
  return new ReportsController(stockUC, payUC, acc.summary, acc.ledger, acc.anticipo, emptySalesCutUseCase(), emptyCashCutUseCase(), emptyDepartmentPriceListUseCase(), ...NEW_REPORT_USE_CASES(), authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository()));
}

function makeAccountController(
  customers: InMemoryStatementCustomer[] = [],
  movements: InMemoryStatementMovement[] = [],
  authz?: AuthorizationService,
  receipts: InMemoryAnticipoReceipt[] = []
) {
  const stockUC = new GetInventoryStockReportUseCase(new InMemoryInventoryReportRepository([]));
  const payUC = new GetPaymentHistoryReportUseCase(new InMemoryPaymentReportRepository([]));
  const repo = new InMemoryAccountStatementRepository(customers, movements, receipts);
  const summaryUC = new GetAccountStatementsSummaryUseCase(repo);
  const ledgerUC = new GetAccountStatementLedgerUseCase(repo);
  const anticipoUC = new GetAnticipoReceiptUseCase(repo);
  return new ReportsController(
    stockUC,
    payUC,
    summaryUC,
    ledgerUC,
    anticipoUC,
    emptySalesCutUseCase(),
    emptyCashCutUseCase(),
    emptyDepartmentPriceListUseCase(),
    ...NEW_REPORT_USE_CASES(),
    authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository())
  );
}

function makeSalesCutController(sales: InMemCutSale[] = [], authz?: AuthorizationService) {
  const stockUC = new GetInventoryStockReportUseCase(new InMemoryInventoryReportRepository([]));
  const payUC = new GetPaymentHistoryReportUseCase(new InMemoryPaymentReportRepository([]));
  const acc = emptyAccountUseCases();
  return new ReportsController(stockUC, payUC, acc.summary, acc.ledger, acc.anticipo, emptySalesCutUseCase(sales), emptyCashCutUseCase(), emptyDepartmentPriceListUseCase(), ...NEW_REPORT_USE_CASES(), authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository()));
}

function makeCashCutController(payments: InMemCutPayment[] = [], authz?: AuthorizationService) {
  const stockUC = new GetInventoryStockReportUseCase(new InMemoryInventoryReportRepository([]));
  const payUC = new GetPaymentHistoryReportUseCase(new InMemoryPaymentReportRepository([]));
  const acc = emptyAccountUseCases();
  return new ReportsController(stockUC, payUC, acc.summary, acc.ledger, acc.anticipo, emptySalesCutUseCase(), emptyCashCutUseCase(payments), emptyDepartmentPriceListUseCase(), ...NEW_REPORT_USE_CASES(), authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository()));
}

function makeDepartmentPriceListController(rows: RawPriceListRow[] = [], authz?: AuthorizationService) {
  const stockUC = new GetInventoryStockReportUseCase(new InMemoryInventoryReportRepository([]));
  const payUC = new GetPaymentHistoryReportUseCase(new InMemoryPaymentReportRepository([]));
  const acc = emptyAccountUseCases();
  return new ReportsController(stockUC, payUC, acc.summary, acc.ledger, acc.anticipo, emptySalesCutUseCase(), emptyCashCutUseCase(), emptyDepartmentPriceListUseCase(rows), ...NEW_REPORT_USE_CASES(), authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository()));
}

function makePurchasesController(repo?: InMemoryPurchaseRepository, authz?: AuthorizationService) {
  const stockUC = new GetInventoryStockReportUseCase(new InMemoryInventoryReportRepository([]));
  const payUC = new GetPaymentHistoryReportUseCase(new InMemoryPaymentReportRepository([]));
  const acc = emptyAccountUseCases();
  const purchasesUC = new GetPurchasesReportUseCase(repo ?? new InMemoryPurchaseRepository());
  return new ReportsController(
    stockUC, payUC, acc.summary, acc.ledger, acc.anticipo,
    emptySalesCutUseCase(), emptyCashCutUseCase(), emptyDepartmentPriceListUseCase(),
    purchasesUC, emptyProviderPaymentsUseCase(), emptySalesByProductUseCase(), emptyCollectionsUseCase(),
    authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository())
  );
}

function makeProviderPaymentsController(rows: InMemProviderPayment[] = [], authz?: AuthorizationService) {
  const stockUC = new GetInventoryStockReportUseCase(new InMemoryInventoryReportRepository([]));
  const payUC = new GetPaymentHistoryReportUseCase(new InMemoryPaymentReportRepository([]));
  const acc = emptyAccountUseCases();
  const providerPaymentsUC = new GetProviderPaymentsReportUseCase(new InMemoryProviderPaymentReportRepository(rows));
  return new ReportsController(
    stockUC, payUC, acc.summary, acc.ledger, acc.anticipo,
    emptySalesCutUseCase(), emptyCashCutUseCase(), emptyDepartmentPriceListUseCase(),
    emptyPurchasesUseCase(), providerPaymentsUC, emptySalesByProductUseCase(), emptyCollectionsUseCase(),
    authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository())
  );
}

function makeSalesByProductController(page?: SalesByProductPage, authz?: AuthorizationService) {
  const stockUC = new GetInventoryStockReportUseCase(new InMemoryInventoryReportRepository([]));
  const payUC = new GetPaymentHistoryReportUseCase(new InMemoryPaymentReportRepository([]));
  const acc = emptyAccountUseCases();
  const emptyPage: SalesByProductPage = {
    totals: { ticketCount: 0, subtotal: 0, taxTotal: 0, total: 0 },
    rows: [],
    rowsTotal: 0,
  };
  const salesByProductUC = new GetSalesByProductReportUseCase(
    new InMemorySalesByProductRepository(() => page ?? emptyPage)
  );
  return new ReportsController(
    stockUC, payUC, acc.summary, acc.ledger, acc.anticipo,
    emptySalesCutUseCase(), emptyCashCutUseCase(), emptyDepartmentPriceListUseCase(),
    emptyPurchasesUseCase(), emptyProviderPaymentsUseCase(), salesByProductUC, emptyCollectionsUseCase(),
    authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository())
  );
}

function makeCollectionsController(payments: InMemCutPayment[] = [], authz?: AuthorizationService) {
  const stockUC = new GetInventoryStockReportUseCase(new InMemoryInventoryReportRepository([]));
  const payUC = new GetPaymentHistoryReportUseCase(new InMemoryPaymentReportRepository([]));
  const acc = emptyAccountUseCases();
  const collectionsUC = new GetCollectionsReportUseCase(new InMemoryCashCutRepository(payments));
  return new ReportsController(
    stockUC, payUC, acc.summary, acc.ledger, acc.anticipo,
    emptySalesCutUseCase(), emptyCashCutUseCase(), emptyDepartmentPriceListUseCase(),
    emptyPurchasesUseCase(), emptyProviderPaymentsUseCase(), emptySalesByProductUseCase(), collectionsUC,
    authz ?? makeAuthz(), new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository())
  );
}

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

function authHeaders(branchId = BRANCH_ID) {
  return { "x-user-id": USER_ID, "x-user-email": "op@test.com", "x-user-branch-id": branchId };
}

// ─── Inventory Stock Report ────────────────────────────────────────────────

describe("ReportsController - getInventoryStockReport", () => {
  it("401 sin x-user-id", async () => {
    const ctrl = makeStockController([], makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getInventoryStockReport(req(`${BASE_URL}/inventory/stock`));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:inventory_read", async () => {
    const authz = makeAuthz({ userCan: jest.fn().mockResolvedValue(false) });
    const ctrl = makeStockController([], authz);
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock`, authHeaders())
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("reports:inventory_read");
  });

  it("400 con branchId UUID inválido", async () => {
    const ctrl = makeStockController();
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock?branchId=not-a-uuid`, authHeaders())
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid branchId" });
  });

  it("400 con departmentId UUID inválido", async () => {
    const ctrl = makeStockController();
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock?departmentId=bad`, authHeaders())
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid departmentId" });
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makeStockController();
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock?format=csv`, authHeaders())
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid format. Allowed: json, pdf, xlsx" });
  });

  it("400 con ?includeZeroStock=maybe", async () => {
    const ctrl = makeStockController();
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock?includeZeroStock=maybe`, authHeaders())
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid includeZeroStock" });
  });

  it("200 JSON con forma del DTO", async () => {
    const ctrl = makeStockController([makeStockRow()]);
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock`, authHeaders())
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("branches");
    expect(body).toHaveProperty("totals");
    expect(body).toHaveProperty("generatedAt");
    expect(body).toHaveProperty("generatedBy");
    expect(body).toHaveProperty("filters");
  });

  it("200 PDF con Content-Type y Content-Disposition correctos", async () => {
    const ctrl = makeStockController([makeStockRow()]);
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock?format=pdf`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="stock-\d{4}-\d{2}-\d{2}\.pdf"$/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("200 xlsx con Content-Type y Content-Disposition correctos", async () => {
    const ctrl = makeStockController([makeStockRow()]);
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock?format=xlsx`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="stock-\d{4}-\d{2}-\d{2}\.xlsx"$/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it("200 xlsx sin datos no lanza error", async () => {
    const ctrl = makeStockController([]);
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock?format=xlsx`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("403 branch scope cross-branch sin bypass", async () => {
    const authz = makeAuthz({
      userCan: jest.fn().mockImplementation(async (_id, key) => {
        if (key === "reports:inventory_read") return true;
        return false;
      }),
    });
    const ctrl = makeStockController([], authz);
    const res = await ctrl.getInventoryStockReport(
      req(`${BASE_URL}/inventory/stock?branchId=${OTHER_BRANCH}`, authHeaders(BRANCH_ID))
    );
    expect(res.status).toBe(403);
  });
});

// ─── Payment History Report ────────────────────────────────────────────────

describe("ReportsController - getPaymentHistoryReport", () => {
  it("401 sin x-user-id", async () => {
    const ctrl = makePaymentController([], makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getPaymentHistoryReport(req(`${BASE_URL}/payments/history`));
    expect(res.status).toBe(401);
  });

  it("403 sin payments:report_read", async () => {
    const authz = makeAuthz({ userCan: jest.fn().mockResolvedValue(false) });
    const ctrl = makePaymentController([], authz);
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history`, authHeaders())
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("payments:report_read");
  });

  it("400 con customerId UUID inválido", async () => {
    const ctrl = makePaymentController();
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history?customerId=bad`, authHeaders())
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid customerId" });
  });

  it("400 con startDate formato inválido", async () => {
    const ctrl = makePaymentController();
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history?startDate=01-06-2026`, authHeaders())
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid startDate" });
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makePaymentController();
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history?format=csv`, authHeaders())
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid format. Allowed: json, pdf, xlsx" });
  });

  it("200 JSON con forma del DTO", async () => {
    const ctrl = makePaymentController([makePaymentRow()]);
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history`, authHeaders())
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("payments");
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("generatedAt");
    expect(body).toHaveProperty("filters");
  });

  it("200 PDF con Content-Type y Content-Disposition correctos", async () => {
    const ctrl = makePaymentController([makePaymentRow()]);
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history?format=pdf`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="payments-\d{4}-\d{2}-\d{2}\.pdf"$/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("200 xlsx con Content-Type y Content-Disposition correctos", async () => {
    const ctrl = makePaymentController([makePaymentRow()]);
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history?format=xlsx`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="payments-\d{4}-\d{2}-\d{2}\.xlsx"$/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it("200 xlsx sin datos no lanza error", async () => {
    const ctrl = makePaymentController([]);
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history?format=xlsx`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("403 branch scope cross-branch sin bypass", async () => {
    const authz = makeAuthz({
      userCan: jest.fn().mockImplementation(async (_id, key) => {
        if (key === "payments:report_read") return true;
        return false;
      }),
    });
    const ctrl = makePaymentController([], authz);
    const res = await ctrl.getPaymentHistoryReport(
      req(`${BASE_URL}/payments/history?branchId=${OTHER_BRANCH}`, authHeaders(BRANCH_ID))
    );
    expect(res.status).toBe(403);
  });
});

// ─── Account Statements ────────────────────────────────────────────────────

const CUSTOMER_ID = "33333333-3333-3333-3333-333333333333";

function accCustomer(overrides: Partial<InMemoryStatementCustomer> = {}): InMemoryStatementCustomer {
  return {
    id: CUSTOMER_ID,
    code: "C001",
    name: "Cliente Uno",
    currentBalance: 500,
    creditLimit: 1000,
    ...overrides,
  };
}

function accSaleMovement(overrides: Partial<InMemoryStatementMovement> = {}): InMemoryStatementMovement {
  return {
    id: "sale-1",
    customerId: CUSTOMER_ID,
    kind: "sale",
    isCredit: true,
    status: "completed",
    amount: 500,
    date: new Date("2026-06-10T10:00:00Z"),
    folioCode: "TK",
    folioNumber: 1,
    branchId: BRANCH_ID,
    dueDate: null,
    reference: null,
    paymentMethodCode: "CR",
    paymentStatus: "pending",
    saleId: null,
    ...overrides,
  };
}

describe("ReportsController - getAccountStatementsSummary", () => {
  it("401 sin x-user-id", async () => {
    const ctrl = makeAccountController([], [], makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getAccountStatementsSummary(req(`${BASE_URL}/account-statements`));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:account_statements_read", async () => {
    const authz = makeAuthz({ userCan: jest.fn().mockResolvedValue(false) });
    const ctrl = makeAccountController([], [], authz);
    const res = await ctrl.getAccountStatementsSummary(
      req(`${BASE_URL}/account-statements`, authHeaders())
    );
    expect(res.status).toBe(403);
    expect((await res.json()).required).toBe("reports:account_statements_read");
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makeAccountController();
    const res = await ctrl.getAccountStatementsSummary(
      req(`${BASE_URL}/account-statements?format=csv`, authHeaders())
    );
    expect(res.status).toBe(400);
  });

  it("200 resumen con fila por cliente y availableCredit", async () => {
    const ctrl = makeAccountController([accCustomer()], [accSaleMovement()]);
    const res = await ctrl.getAccountStatementsSummary(
      req(`${BASE_URL}/account-statements`, authHeaders())
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].currentBalance).toBe("500.0000");
    expect(body.items[0].totalCharged).toBe("500.0000");
    expect(body.items[0].availableCredit).toBe("500.0000");
  });

  it("availableCredit null cuando creditLimit null", async () => {
    const ctrl = makeAccountController([accCustomer({ creditLimit: null })], []);
    const res = await ctrl.getAccountStatementsSummary(
      req(`${BASE_URL}/account-statements`, authHeaders())
    );
    const body = await res.json();
    expect(body.items[0].creditLimit).toBeNull();
    expect(body.items[0].availableCredit).toBeNull();
  });

  it("onlyWithBalance filtra clientes con saldo cero", async () => {
    const ctrl = makeAccountController(
      [accCustomer(), accCustomer({ id: "44444444-4444-4444-4444-444444444444", code: "C002", name: "Cero", currentBalance: 0 })],
      []
    );
    const res = await ctrl.getAccountStatementsSummary(
      req(`${BASE_URL}/account-statements?onlyWithBalance=true`, authHeaders())
    );
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].customerCode).toBe("C001");
  });

  it("403 branch scope cross-branch sin bypass", async () => {
    const authz = makeAuthz({
      userCan: jest.fn().mockImplementation(async (_id, key) => {
        if (key === "reports:account_statements_read") return true;
        return false;
      }),
    });
    const ctrl = makeAccountController([accCustomer()], [accSaleMovement()], authz);
    const res = await ctrl.getAccountStatementsSummary(
      req(`${BASE_URL}/account-statements?branchId=${OTHER_BRANCH}`, authHeaders(BRANCH_ID))
    );
    expect(res.status).toBe(403);
  });
});

describe("ReportsController - getAccountStatementLedger", () => {
  it("400 con customerId inválido", async () => {
    const ctrl = makeAccountController();
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/not-a-uuid`, authHeaders()),
      "not-a-uuid"
    );
    expect(res.status).toBe(400);
  });

  it("403 sin permiso", async () => {
    const authz = makeAuthz({ userCan: jest.fn().mockResolvedValue(false) });
    const ctrl = makeAccountController([], [], authz);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(403);
  });

  it("404 cliente inexistente", async () => {
    const ctrl = makeAccountController([], []);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(404);
  });

  it("200 desglose con saldo corrido", async () => {
    const movements: InMemoryStatementMovement[] = [
      accSaleMovement(),
      {
        id: "pay-1",
        customerId: CUSTOMER_ID,
        kind: "payment",
        isCredit: false,
        status: "completed",
        amount: 200,
        date: new Date("2026-06-15T10:00:00Z"),
        folioCode: "RB",
        folioNumber: 1,
        branchId: BRANCH_ID,
        dueDate: null,
        reference: "TRANSF 200",
        paymentMethodCode: "TR",
        paymentStatus: null,
        saleId: "sale-1",
      },
    ];
    const ctrl = makeAccountController([accCustomer()], movements);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.movements).toHaveLength(2);
    expect(body.movements[0].runningBalance).toBe("500.0000");
    expect(body.movements[1].runningBalance).toBe("300.0000");
    expect(body.closingBalance).toBe("300.0000");
  });

  it("200 groups agrupa la venta con su abono y calcula ticketBalance", async () => {
    const movements: InMemoryStatementMovement[] = [
      accSaleMovement(),
      {
        id: "pay-1",
        customerId: CUSTOMER_ID,
        kind: "payment",
        isCredit: false,
        status: "completed",
        amount: 200,
        date: new Date("2026-06-15T10:00:00Z"),
        folioCode: "RB",
        folioNumber: 1,
        branchId: BRANCH_ID,
        dueDate: null,
        reference: "TRANSF 200",
        paymentMethodCode: "TR",
        paymentStatus: null,
        saleId: "sale-1",
      },
    ];
    const ctrl = makeAccountController([accCustomer()], movements);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].sale.id).toBe("sale-1");
    expect(body.groups[0].payments).toHaveLength(1);
    expect(body.groups[0].payments[0].id).toBe("pay-1");
    expect(body.groups[0].ticketBalance).toBe("300.0000");
    // movements[] plano no cambia con la introducción de groups[]
    expect(body.movements).toHaveLength(2);
    expect(body.closingBalance).toBe("300.0000");
  });

  it("200 groups: abono con venta fuera del rango va al grupo sale:null", async () => {
    const movements: InMemoryStatementMovement[] = [
      accSaleMovement({ date: new Date("2026-05-01T10:00:00Z") }),
      {
        id: "pay-1",
        customerId: CUSTOMER_ID,
        kind: "payment",
        isCredit: false,
        status: "completed",
        amount: 200,
        date: new Date("2026-06-15T10:00:00Z"),
        folioCode: "RB",
        folioNumber: 1,
        branchId: BRANCH_ID,
        dueDate: null,
        reference: "TRANSF 200",
        paymentMethodCode: "TR",
        paymentStatus: null,
        saleId: "sale-1",
      },
    ];
    const ctrl = makeAccountController([accCustomer()], movements);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}?from=2026-06-01`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].sale).toBeNull();
    expect(body.groups[0].payments).toHaveLength(1);
    expect(body.groups[0].payments[0].id).toBe("pay-1");
  });

  it("200 xlsx agrupa venta + abono + saldo ticket en filas consecutivas", async () => {
    const movements: InMemoryStatementMovement[] = [
      accSaleMovement(),
      {
        id: "pay-1",
        customerId: CUSTOMER_ID,
        kind: "payment",
        isCredit: false,
        status: "completed",
        amount: 200,
        date: new Date("2026-06-15T10:00:00Z"),
        folioCode: "RB",
        folioNumber: 1,
        branchId: BRANCH_ID,
        dueDate: null,
        reference: "TRANSF 200",
        paymentMethodCode: "TR",
        paymentStatus: null,
        saleId: "sale-1",
      },
    ];
    const ctrl = makeAccountController([accCustomer()], movements);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}?format=xlsx`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(200);

    const buf = Buffer.from(await res.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    const saleRowIdx = aoa.findIndex((r) => r[2] === "TK");
    expect(saleRowIdx).toBeGreaterThan(0);
    expect(aoa[saleRowIdx + 1][2]).toBe("RB");
    expect(aoa[saleRowIdx + 2]).toEqual(["Saldo ticket", "300.0000"]);
  });

  it("400 con ?sort inválido", async () => {
    const ctrl = makeAccountController([accCustomer()], [accSaleMovement()]);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}?sort=clave`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(400);
  });

  it("400 con ?history inválido", async () => {
    const ctrl = makeAccountController([accCustomer()], [accSaleMovement()]);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}?history=maybe`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(400);
  });

  it("403 branch scope cross-branch sin bypass", async () => {
    const authz = makeAuthz({
      userCan: jest.fn().mockImplementation(async (_id, key) => {
        if (key === "reports:account_statements_read") return true;
        return false;
      }),
    });
    const ctrl = makeAccountController([accCustomer()], [accSaleMovement()], authz);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}?branchId=${OTHER_BRANCH}`, authHeaders(BRANCH_ID)),
      CUSTOMER_ID
    );
    expect(res.status).toBe(403);
  });

  it("409 ReportTooLarge cuando el desglose excede 10000 movimientos en PDF", async () => {
    const movements: InMemoryStatementMovement[] = Array.from({ length: 10001 }, (_, i) =>
      accSaleMovement({
        id: `sale-${i}`,
        amount: 1,
        date: new Date(Date.UTC(2026, 0, 1, 0, i)),
      })
    );
    const ctrl = makeAccountController([accCustomer()], movements);
    const res = await ctrl.getAccountStatementLedger(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}?format=pdf`, authHeaders()),
      CUSTOMER_ID
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ReportTooLarge", limit: 10000 });
  });
});

// ─── Anticipo Receipt ──────────────────────────────────────────────────────

const PAYMENT_ID = "55555555-5555-5555-5555-555555555555";

function accReceipt(over: Partial<InMemoryAnticipoReceipt> = {}): InMemoryAnticipoReceipt {
  return {
    paymentId: PAYMENT_ID,
    customerId: CUSTOMER_ID,
    branchId: BRANCH_ID,
    payment: {
      id: PAYMENT_ID,
      folioCode: "RB",
      folioNumber: 7,
      amount: 200,
      status: "completed",
      createdAt: new Date("2026-06-15T10:00:00Z"),
      reference: "TRANSF 200",
      paymentMethodCode: "TR",
      paymentMethodName: "Transferencia",
    },
    customer: { code: "C001", name: "Cliente Uno", address: "Calle 1" },
    sale: { folioCode: "TC", folioNumber: 11067 },
    ...over,
  };
}

describe("ReportsController - getAnticipoReceipt", () => {
  it("400 con customerId inválido", async () => {
    const ctrl = makeAccountController();
    const res = await ctrl.getAnticipoReceipt(
      req(`${BASE_URL}/account-statements/x/payments/${PAYMENT_ID}/receipt`, authHeaders()),
      "not-a-uuid",
      PAYMENT_ID
    );
    expect(res.status).toBe(400);
  });

  it("400 con paymentId inválido", async () => {
    const ctrl = makeAccountController();
    const res = await ctrl.getAnticipoReceipt(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}/payments/x/receipt`, authHeaders()),
      CUSTOMER_ID,
      "not-a-uuid"
    );
    expect(res.status).toBe(400);
  });

  it("403 sin permiso", async () => {
    const authz = makeAuthz({ userCan: jest.fn().mockResolvedValue(false) });
    const ctrl = makeAccountController([], [], authz, [accReceipt()]);
    const res = await ctrl.getAnticipoReceipt(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}/payments/${PAYMENT_ID}/receipt`, authHeaders()),
      CUSTOMER_ID,
      PAYMENT_ID
    );
    expect(res.status).toBe(403);
  });

  it("404 abono ajeno al cliente", async () => {
    const ctrl = makeAccountController([], [], undefined, [
      accReceipt({ customerId: "44444444-4444-4444-4444-444444444444" }),
    ]);
    const res = await ctrl.getAnticipoReceipt(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}/payments/${PAYMENT_ID}/receipt`, authHeaders()),
      CUSTOMER_ID,
      PAYMENT_ID
    );
    expect(res.status).toBe(404);
  });

  it("200 application/pdf con recibo", async () => {
    const ctrl = makeAccountController([], [], undefined, [accReceipt()]);
    const res = await ctrl.getAnticipoReceipt(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}/payments/${PAYMENT_ID}/receipt`, authHeaders()),
      CUSTOMER_ID,
      PAYMENT_ID
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("404 branch scope oculta recibo de otra sucursal sin bypass", async () => {
    const authz = makeAuthz({
      userCan: jest.fn().mockImplementation(async (_id, key) => {
        if (key === "reports:account_statements_read") return true;
        return false;
      }),
    });
    const ctrl = makeAccountController([], [], authz, [accReceipt({ branchId: OTHER_BRANCH })]);
    const res = await ctrl.getAnticipoReceipt(
      req(`${BASE_URL}/account-statements/${CUSTOMER_ID}/payments/${PAYMENT_ID}/receipt`, authHeaders(BRANCH_ID)),
      CUSTOMER_ID,
      PAYMENT_ID
    );
    expect(res.status).toBe(404);
  });
});

// ─── Sales Cut ─────────────────────────────────────────────────────────────

function cutSale(over: Partial<InMemCutSale> = {}): InMemCutSale {
  return {
    id: "sc-1",
    status: "completed",
    total: 116,
    subtotal: 100,
    taxTotal: 16,
    iva: 16,
    ieps: 0,
    branchId: BRANCH_ID,
    branchName: "Matriz",
    cashierId: USER_ID,
    cashierName: "Cajero",
    paymentMethodId: "77777777-7777-7777-7777-777777777777",
    paymentMethodName: "Efectivo",
    createdAt: new Date(`${new Date().toISOString().split("T")[0]}T10:00:00.000Z`),
    ...over,
  };
}

describe("ReportsController - getSalesCutReport", () => {
  it("401 sin x-user-id", async () => {
    const ctrl = makeSalesCutController([], makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getSalesCutReport(req(`${BASE_URL}/sales-cut`));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:sales_cut_read", async () => {
    const authz = makeAuthz({ userCan: jest.fn().mockResolvedValue(false) });
    const ctrl = makeSalesCutController([], authz);
    const res = await ctrl.getSalesCutReport(req(`${BASE_URL}/sales-cut`, authHeaders()));
    expect(res.status).toBe(403);
    expect((await res.json()).required).toBe("reports:sales_cut_read");
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makeSalesCutController();
    const res = await ctrl.getSalesCutReport(req(`${BASE_URL}/sales-cut?format=csv`, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("400 con from > to", async () => {
    const ctrl = makeSalesCutController();
    const res = await ctrl.getSalesCutReport(
      req(`${BASE_URL}/sales-cut?from=2026-07-10&to=2026-07-01`, authHeaders())
    );
    expect(res.status).toBe(400);
  });

  it("400 con cashierId inválido", async () => {
    const ctrl = makeSalesCutController();
    const res = await ctrl.getSalesCutReport(
      req(`${BASE_URL}/sales-cut?cashierId=bad`, authHeaders())
    );
    expect(res.status).toBe(400);
  });

  it("200 preset hoy con totales y desgloses", async () => {
    const ctrl = makeSalesCutController([cutSale(), cutSale({ id: "sc-2", status: "cancelled", total: 50 })]);
    const res = await ctrl.getSalesCutReport(req(`${BASE_URL}/sales-cut?preset=today`, authHeaders()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals.grossSales).toBe("116.0000");
    expect(body.totals.ticketCount).toBe(1);
    expect(body.cancelled.count).toBe(1);
    expect(body.cancelled.total).toBe("50.0000");
    expect(body.cash.expensesTotal).toBe("0.0000");
    expect(body.cash.netCash).toBe("116.0000");
    expect(body.byPaymentMethod).toHaveLength(1);
    expect(body.byPaymentMethod[0].label).toBe("Efectivo");
  });
});

// ─── Cash Cut ──────────────────────────────────────────────────────────────

function cutPayment(over: Partial<InMemCutPayment> = {}): InMemCutPayment {
  return {
    paymentId: "cp-1",
    saleId: "88888888-8888-8888-8888-888888888888",
    status: "completed",
    branchId: BRANCH_ID,
    customerId: "66666666-6666-6666-6666-666666666666",
    customerCode: "C001",
    customerName: "Cliente Uno",
    docto: "AB-000001",
    factura: "TC-000001",
    facturaDate: new Date("2026-06-01T00:00:00.000Z"),
    amount: 116,
    paymentMethodId: "77777777-7777-7777-7777-777777777777",
    paymentMethodCode: "EFECTIVO",
    paymentMethodName: "Efectivo",
    reference: "efectivo",
    collectedAt: new Date("2026-06-04T10:00:00.000Z"),
    saleTaxTotal: 16,
    saleSubtotal: 100,
    saleTotal: 116,
    ...over,
  };
}

describe("ReportsController - getCashCutReport", () => {
  it("401 sin x-user-id", async () => {
    const ctrl = makeCashCutController([], makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getCashCutReport(req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30`));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:cash_cut_read", async () => {
    const authz = makeAuthz({ userCan: jest.fn().mockResolvedValue(false) });
    const ctrl = makeCashCutController([], authz);
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30`, authHeaders())
    );
    expect(res.status).toBe(403);
    expect((await res.json()).required).toBe("reports:cash_cut_read");
  });

  it("400 sin from/to", async () => {
    const ctrl = makeCashCutController();
    const res = await ctrl.getCashCutReport(req(`${BASE_URL}/cash-cut`, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("400 con from > to", async () => {
    const ctrl = makeCashCutController();
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-07-10&to=2026-07-01`, authHeaders())
    );
    expect(res.status).toBe(400);
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makeCashCutController();
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30&format=csv`, authHeaders())
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid format. Allowed: json, pdf, xlsx" });
  });

  it("400 con customerId inválido", async () => {
    const ctrl = makeCashCutController();
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30&customerId=bad`, authHeaders())
    );
    expect(res.status).toBe(400);
  });

  it("200 JSON con filas, totales prorrateados y desglose por forma de pago", async () => {
    const ctrl = makeCashCutController([cutPayment()]);
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30`, authHeaders())
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].days).toBe(3);
    expect(body.rows[0].ivaAmount).toBe("16.0000");
    expect(body.rows[0].taxRatePct).toBe("0.1600");
    expect(body.totals.totalCollected).toBe("116.0000");
    expect(body.totals.totalIva).toBe("16.0000");
    expect(body.byPaymentMethod).toHaveLength(1);
    expect(body.byPaymentMethod[0].label).toBe("Efectivo");
  });

  it("periodo vacío devuelve ceros", async () => {
    const ctrl = makeCashCutController([]);
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30`, authHeaders())
    );
    const body = await res.json();
    expect(body.rows).toHaveLength(0);
    expect(body.totals.totalCollected).toBe("0.0000");
    expect(body.byPaymentMethod).toHaveLength(0);
  });

  it("200 PDF con Content-Type y Content-Disposition correctos", async () => {
    const ctrl = makeCashCutController([cutPayment()]);
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30&format=pdf`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="cash-cut-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf"$/);
  });

  it("200 xlsx con Content-Type y Content-Disposition correctos", async () => {
    const ctrl = makeCashCutController([cutPayment()]);
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30&format=xlsx`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="cash-cut-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx"$/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it("403 branch scope cross-branch sin bypass", async () => {
    const authz = makeAuthz({
      userCan: jest.fn().mockImplementation(async (_id, key) => {
        if (key === "reports:cash_cut_read") return true;
        return false;
      }),
    });
    const ctrl = makeCashCutController([], authz);
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30&branchId=${OTHER_BRANCH}`, authHeaders(BRANCH_ID))
    );
    expect(res.status).toBe(403);
  });

  it("abonos cancelados no cuentan", async () => {
    const ctrl = makeCashCutController([cutPayment({ status: "cancelled" })]);
    const res = await ctrl.getCashCutReport(
      req(`${BASE_URL}/cash-cut?from=2026-06-01&to=2026-06-30`, authHeaders())
    );
    const body = await res.json();
    expect(body.rows).toHaveLength(0);
  });
});

// ─── Department Price List Report ──────────────────────────────────────────

describe("ReportsController - getDepartmentPriceListReport", () => {
  const URL = `${BASE_URL}/inventory/by-department`;

  it("401 sin x-user-id", async () => {
    const ctrl = makeDepartmentPriceListController([], makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getDepartmentPriceListReport(req(URL));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:inventory_read", async () => {
    const authz = makeAuthz({ userCan: jest.fn().mockResolvedValue(false) });
    const ctrl = makeDepartmentPriceListController([], authz);
    const res = await ctrl.getDepartmentPriceListReport(req(URL, authHeaders()));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("reports:inventory_read");
  });

  it("400 con departmentId UUID inválido", async () => {
    const ctrl = makeDepartmentPriceListController();
    const res = await ctrl.getDepartmentPriceListReport(req(`${URL}?departmentId=bad`, authHeaders()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid departmentId" });
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makeDepartmentPriceListController();
    const res = await ctrl.getDepartmentPriceListReport(req(`${URL}?format=csv`, authHeaders()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid format. Allowed: json, pdf, xlsx" });
  });

  it("200 JSON con forma del DTO", async () => {
    const ctrl = makeDepartmentPriceListController([makePriceListRow()]);
    const res = await ctrl.getDepartmentPriceListReport(req(URL, authHeaders()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("departments");
    expect(body).toHaveProperty("totals");
    expect(body.departments[0].products[0].prices[0].name).toBe("Menudeo");
  });

  it("200 JSON filtra por departmentId", async () => {
    const ctrl = makeDepartmentPriceListController([makePriceListRow()]);
    const res = await ctrl.getDepartmentPriceListReport(
      req(`${URL}?departmentId=${DEPT_ID}`, authHeaders())
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filters.departmentId).toBe(DEPT_ID);
    expect(body.departments).toHaveLength(1);
  });

  it("200 PDF con Content-Type y Content-Disposition correctos", async () => {
    const ctrl = makeDepartmentPriceListController([makePriceListRow()]);
    const res = await ctrl.getDepartmentPriceListReport(req(`${URL}?format=pdf`, authHeaders()));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="inventory-by-department-\d{4}-\d{2}-\d{2}\.pdf"$/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("200 xlsx con Content-Type y Content-Disposition correctos", async () => {
    const ctrl = makeDepartmentPriceListController([makePriceListRow()]);
    const res = await ctrl.getDepartmentPriceListReport(req(`${URL}?format=xlsx`, authHeaders()));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="inventory-by-department-\d{4}-\d{2}-\d{2}\.xlsx"$/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it("200 xlsx pivotea precios como columnas (una fila por producto, no por precio)", async () => {
    const menudeo = makePriceListRow();
    const mayoreo: RawPriceListRow = {
      ...menudeo,
      priceId: "price-2",
      priceName: "Mayoreo",
      price: new Decimal("80.0000"),
      isDefault: false,
    };
    const otherProduct: RawPriceListRow = {
      ...menudeo,
      productId: "prod-2",
      code: "P002",
      name: "Prod 2",
      priceId: "price-3",
      priceName: "Menudeo",
      price: new Decimal("50.0000"),
    };
    const ctrl = makeDepartmentPriceListController([menudeo, mayoreo, otherProduct]);
    const res = await ctrl.getDepartmentPriceListReport(req(`${URL}?format=xlsx`, authHeaders()));
    expect(res.status).toBe(200);

    const buf = Buffer.from(await res.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    const headerRow = aoa[0] as string[];
    expect(headerRow).toEqual(["Departamento", "Código", "Producto", "Unidad", "Stock", "Costo Adq.", "Menudeo", "Mayoreo"]);

    const prod1Row = aoa.find((r) => r[1] === "P001") as unknown[];
    expect(prod1Row).toEqual(["Dept 1", "P001", "Prod 1", "PZA", "10.0000", "—", "$100.00", "$80.00"]);

    const prod2Row = aoa.find((r) => r[1] === "P002") as unknown[];
    expect(prod2Row).toEqual(["Dept 1", "P002", "Prod 2", "PZA", "10.0000", "—", "$50.00", "—"]);
  });

  it("200 incluye stockQuantity por producto y totalStock", async () => {
    const ctrl = makeDepartmentPriceListController([makePriceListRow()]);
    const res = await ctrl.getDepartmentPriceListReport(req(URL, authHeaders()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.departments[0].products[0].stockQuantity).toBe("10.0000");
    expect(body.departments[0].subtotal.totalStock).toBe("10.0000");
    expect(body.totals.totalStock).toBe("10.0000");
  });

  it("400 con branchId UUID inválido", async () => {
    const ctrl = makeDepartmentPriceListController();
    const res = await ctrl.getDepartmentPriceListReport(req(`${URL}?branchId=bad`, authHeaders()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid branchId" });
  });

  it("403 branch scope cross-branch sin bypass", async () => {
    const authz = makeAuthz({
      userCan: jest.fn().mockImplementation(async (_id, key) => {
        if (key === "reports:inventory_read") return true;
        return false;
      }),
    });
    const ctrl = makeDepartmentPriceListController([], authz);
    const res = await ctrl.getDepartmentPriceListReport(
      req(`${URL}?branchId=${OTHER_BRANCH}`, authHeaders(BRANCH_ID))
    );
    expect(res.status).toBe(403);
  });

  it("200 JSON propaga branchId en filters", async () => {
    const ctrl = makeDepartmentPriceListController([makePriceListRow()]);
    const res = await ctrl.getDepartmentPriceListReport(
      req(`${URL}?branchId=${BRANCH_ID}`, authHeaders())
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filters.branchId).toBe(BRANCH_ID);
  });
});

describe("ReportsController - getPurchasesReport", () => {
  const URL = `${BASE_URL}/purchases`;

  it("401 sin x-user-id", async () => {
    const ctrl = makePurchasesController();
    const res = await ctrl.getPurchasesReport(req(URL));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:purchases_read", async () => {
    const ctrl = makePurchasesController(undefined, makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getPurchasesReport(req(URL, authHeaders()));
    expect(res.status).toBe(403);
    expect((await res.json()).required).toBe("reports:purchases_read");
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makePurchasesController();
    const res = await ctrl.getPurchasesReport(req(`${URL}?format=csv`, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("400 con providerId UUID inválido", async () => {
    const ctrl = makePurchasesController();
    const res = await ctrl.getPurchasesReport(req(`${URL}?providerId=bad`, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("200 JSON sin compras → array vacío", async () => {
    const ctrl = makePurchasesController();
    const res = await ctrl.getPurchasesReport(req(URL, authHeaders()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.totals.count).toBe(0);
  });

  it("403 branch scope cross-branch sin bypass", async () => {
    const authz = makeAuthz({ userCan: async (_id, key) => key === "reports:purchases_read" });
    const ctrl = makePurchasesController(undefined, authz);
    const res = await ctrl.getPurchasesReport(req(`${URL}?branchId=${OTHER_BRANCH}`, authHeaders()));
    expect(res.status).toBe(403);
  });
});

describe("ReportsController - getProviderPaymentsReport", () => {
  const URL = `${BASE_URL}/purchases/provider-payments`;

  function payment(over: Partial<InMemProviderPayment> = {}): InMemProviderPayment {
    return {
      id: "pp-1",
      folioCode: "CP-000001",
      purchaseFolioCode: "COM-000001",
      providerName: "Proveedor Uno",
      branchName: "Matriz",
      amount: 500,
      status: "completed",
      paidAt: new Date("2026-06-10T00:00:00.000Z"),
      branchId: BRANCH_ID,
      providerId: "prov1",
      providerInitialBalance: null,
      providerCurrentBalance: null,
      ...over,
    };
  }

  it("401 sin x-user-id", async () => {
    const ctrl = makeProviderPaymentsController();
    const res = await ctrl.getProviderPaymentsReport(req(URL));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:purchases_read", async () => {
    const ctrl = makeProviderPaymentsController([], makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getProviderPaymentsReport(req(URL, authHeaders()));
    expect(res.status).toBe(403);
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makeProviderPaymentsController();
    const res = await ctrl.getProviderPaymentsReport(req(`${URL}?format=csv`, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("200 JSON con pagos a proveedores", async () => {
    const ctrl = makeProviderPaymentsController([payment()]);
    const res = await ctrl.getProviderPaymentsReport(req(URL, authHeaders()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].purchaseFolioCode).toBe("COM-000001");
    expect(body.totals.total).toBe("500.0000");
  });
});

describe("ReportsController - getSalesByProductReport", () => {
  const URL = `${BASE_URL}/sales-by-product`;

  it("401 sin x-user-id", async () => {
    const ctrl = makeSalesByProductController();
    const res = await ctrl.getSalesByProductReport(req(URL));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:sales_by_product_read", async () => {
    const ctrl = makeSalesByProductController(undefined, makeAuthz({ userCan: async () => false }));
    const res = await ctrl.getSalesByProductReport(req(URL, authHeaders()));
    expect(res.status).toBe(403);
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makeSalesByProductController();
    const res = await ctrl.getSalesByProductReport(req(`${URL}?format=csv`, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("400 con departmentId UUID inválido", async () => {
    const ctrl = makeSalesByProductController();
    const res = await ctrl.getSalesByProductReport(req(`${URL}?departmentId=bad`, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("200 JSON con totals y filas de detalle Departamento+Producto+Cliente", async () => {
    const ctrl = makeSalesByProductController({
      totals: { ticketCount: 1, subtotal: 100, taxTotal: 16, total: 116 },
      rows: [
        {
          departmentId: "d1", departmentName: "Agroquímicos",
          productId: "p1", productCode: "F1", productName: "Fertilizante",
          customerId: "c1", customerName: "Cliente Uno",
          quantity: 4, total: 116,
        },
      ],
      rowsTotal: 1,
    });
    const res = await ctrl.getSalesByProductReport(req(URL, authHeaders()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals.total).toBe("116.0000");
    expect(body.rows[0].productName).toBe("Fertilizante");
    expect(body.rowsTotal).toBe(1);
  });

  it("409 ReportTooLarge al exportar con más de 10000 combinaciones", async () => {
    const ctrl = makeSalesByProductController({
      totals: { ticketCount: 1, subtotal: 100, taxTotal: 16, total: 116 },
      rows: [],
      rowsTotal: 10001,
    });
    const res = await ctrl.getSalesByProductReport(req(`${URL}?format=pdf`, authHeaders()));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("ReportTooLarge");
    expect(body.limit).toBe(10000);
  });
});

describe("ReportsController - getCustomerCollectionsReport", () => {
  const URL = `${BASE_URL}/customer-collections`;

  function cutPayment(over: Partial<InMemCutPayment> = {}): InMemCutPayment {
    return {
      paymentId: "cp-1",
      saleId: "sale-1",
      status: "completed",
      branchId: BRANCH_ID,
      customerId: "66666666-6666-6666-6666-666666666666",
      customerCode: "C001",
      customerName: "Cliente Uno",
      docto: "AB-000001",
      factura: "TC-000001",
      facturaDate: new Date("2026-06-01T00:00:00.000Z"),
      amount: 116,
      paymentMethodId: "77777777-7777-7777-7777-777777777777",
      paymentMethodCode: "EFECTIVO",
      paymentMethodName: "Efectivo",
      reference: "efectivo",
      collectedAt: new Date("2026-06-04T10:00:00.000Z"),
      saleTaxTotal: 16,
      saleSubtotal: 100,
      saleTotal: 116,
      ...over,
    };
  }

  it("401 sin x-user-id", async () => {
    const ctrl = makeCollectionsController();
    const res = await ctrl.getCustomerCollectionsReport(req(`${URL}?from=2026-06-01&to=2026-06-30`));
    expect(res.status).toBe(401);
  });

  it("403 sin reports:customer_collections_read (aunque tenga reports:cash_cut_read)", async () => {
    const authz = makeAuthz({ userCan: async (_id, key) => key === "reports:cash_cut_read" });
    const ctrl = makeCollectionsController([], authz);
    const res = await ctrl.getCustomerCollectionsReport(
      req(`${URL}?from=2026-06-01&to=2026-06-30`, authHeaders())
    );
    expect(res.status).toBe(403);
  });

  it("400 sin from/to", async () => {
    const ctrl = makeCollectionsController();
    const res = await ctrl.getCustomerCollectionsReport(req(URL, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("400 con ?format=csv", async () => {
    const ctrl = makeCollectionsController();
    const res = await ctrl.getCustomerCollectionsReport(
      req(`${URL}?from=2026-06-01&to=2026-06-30&format=csv`, authHeaders())
    );
    expect(res.status).toBe(400);
  });

  it("200 JSON agrupa por cliente y por ticket", async () => {
    const ctrl = makeCollectionsController([
      cutPayment({ paymentId: "p1", saleId: "s1", amount: 50 }),
      cutPayment({ paymentId: "p2", saleId: "s1", amount: 66 }),
    ]);
    const res = await ctrl.getCustomerCollectionsReport(
      req(`${URL}?from=2026-06-01&to=2026-06-30`, authHeaders())
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(2);
    expect(body.byTicket).toHaveLength(1);
    expect(body.byTicket[0].total).toBe("116.0000");
  });
});
