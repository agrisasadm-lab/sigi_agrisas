import { SendSaleTicketEmailUseCase } from "@/modules/pos/application/use-cases/SendSaleTicketEmailUseCase";
import { Sale } from "@/modules/pos/domain/entities/Sale";
import { SaleItem } from "@/modules/pos/domain/entities/SaleItem";
import { SaleNotFoundError } from "@/modules/pos/domain/errors/SaleNotFoundError";
import { SaleNoEmailError } from "@/modules/pos/domain/errors/SaleNoEmailError";
import { SaleEmailSendFailedError } from "@/modules/pos/domain/errors/SaleEmailSendFailedError";
import type { SaleRepository, SaleSummary } from "@/modules/pos/application/ports/SaleRepository";
import type { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import type { MailerPort } from "@/shared/application/ports/MailerPort";

const SALE_ID = "sale-1";
const CUSTOMER_ID = "customer-1";

function makeSummary(overrides: { customerId?: string | null } = {}): SaleSummary {
  const now = new Date();
  const item = SaleItem.create({
    id: "item-1",
    saleId: SALE_ID,
    productId: "p1",
    productPriceId: "pp1",
    dosificationId: null,
    numPartsSnapshot: null,
    productCodeSnapshot: "P1",
    productNameSnapshot: "Producto 1",
    priceNameSnapshot: "Menudeo",
    quantity: 1,
    unitPrice: 100,
    discountPct: null,
    ivaRate: 0.16,
    iepsRate: null,
    lineSubtotal: 86.2069,
    lineTax: 13.7931,
    lineTotal: 100,
  });
  const sale = Sale.create({
    id: SALE_ID,
    folioId: "f1",
    folioNumber: 1,
    folioCode: "TK-1",
    branchId: "b1",
    customerId: overrides.customerId !== undefined ? overrides.customerId : CUSTOMER_ID,
    cashierId: "u1",
    paymentMethodId: "pm1",
    quoteId: null,
    status: "completed",
    paidAmount: 100,
    paymentStatus: "paid",
    subtotal: 86.2069,
    taxTotal: 13.7931,
    total: 100,
    notes: null,
    completedAt: now,
    cancelledAt: null,
    cancellationReason: null,
    editedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [item],
  });
  return {
    sale,
    joined: {
      branchName: "Matriz",
      customerName: "Cliente",
      customerRfc: "ACM010101AAA",
      customerAddress: null,
      customerCreditDays: null,
      cashierName: "Cajero",
      paymentMethodCode: "EFECTIVO",
      paymentMethodName: "Efectivo",
      paymentMethodIsCredit: false,
    },
  };
}

function makeSaleRepo(summary: SaleSummary | null): SaleRepository {
  return {
    findAll: jest.fn(),
    findByClientRequestId: jest.fn(),
    findByIdWithItems: jest.fn().mockResolvedValue(summary),
    createCompleted: jest.fn(),
    createCompletedFromQuote: jest.fn(),
    cancel: jest.fn(),
    replaceItemsAndRecalculate: jest.fn(),
    markReturnedTotal: jest.fn(),
  };
}

function makeLookups(email: string | null): PosLookupService {
  return {
    getProduct: jest.fn(),
    getProductPrice: jest.fn(),
    getDosificationForSale: jest.fn(),
    getCustomer: jest.fn().mockResolvedValue({ id: CUSTOMER_ID, isActive: true, creditLimit: null, currentBalance: 0, email }),
    getBranch: jest.fn(),
    getFolio: jest.fn(),
    getPaymentMethod: jest.fn(),
    getDosificationSurchargePct: jest.fn().mockResolvedValue(5),
    isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
  };
}

describe("SendSaleTicketEmailUseCase", () => {
  it("sends to customer.email when no override is given", async () => {
    const repo = makeSaleRepo(makeSummary());
    const lookups = makeLookups("cliente@ejemplo.com");
    const mailer: MailerPort = { send: jest.fn().mockResolvedValue(undefined) };
    const uc = new SendSaleTicketEmailUseCase(repo, lookups, mailer);

    const result = await uc.execute(SALE_ID);

    expect(result).toEqual({ sentTo: "cliente@ejemplo.com" });
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: "cliente@ejemplo.com" }));
  });

  it("sends to the override email instead of customer.email", async () => {
    const repo = makeSaleRepo(makeSummary());
    const lookups = makeLookups("cliente@ejemplo.com");
    const mailer: MailerPort = { send: jest.fn().mockResolvedValue(undefined) };
    const uc = new SendSaleTicketEmailUseCase(repo, lookups, mailer);

    const result = await uc.execute(SALE_ID, "otra@direccion.com");

    expect(result).toEqual({ sentTo: "otra@direccion.com" });
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: "otra@direccion.com" }));
  });

  it("throws SaleNoEmailError when the sale has no customer (público general) and no override given", async () => {
    const repo = makeSaleRepo(makeSummary({ customerId: null }));
    const lookups = makeLookups(null);
    const mailer: MailerPort = { send: jest.fn() };
    const uc = new SendSaleTicketEmailUseCase(repo, lookups, mailer);

    await expect(uc.execute(SALE_ID)).rejects.toThrow(SaleNoEmailError);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it("throws SaleNoEmailError when the customer exists but has no email and no override given", async () => {
    const repo = makeSaleRepo(makeSummary());
    const lookups = makeLookups(null);
    const mailer: MailerPort = { send: jest.fn() };
    const uc = new SendSaleTicketEmailUseCase(repo, lookups, mailer);

    await expect(uc.execute(SALE_ID)).rejects.toThrow(SaleNoEmailError);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it("throws SaleNotFoundError when the sale does not exist", async () => {
    const repo = makeSaleRepo(null);
    const lookups = makeLookups("cliente@ejemplo.com");
    const mailer: MailerPort = { send: jest.fn() };
    const uc = new SendSaleTicketEmailUseCase(repo, lookups, mailer);

    await expect(uc.execute(SALE_ID)).rejects.toThrow(SaleNotFoundError);
  });

  it("throws SaleEmailSendFailedError when the mailer rejects", async () => {
    const repo = makeSaleRepo(makeSummary());
    const lookups = makeLookups("cliente@ejemplo.com");
    const mailer: MailerPort = { send: jest.fn().mockRejectedValue(new Error("SMTP down")) };
    const uc = new SendSaleTicketEmailUseCase(repo, lookups, mailer);

    await expect(uc.execute(SALE_ID)).rejects.toThrow(SaleEmailSendFailedError);
  });
});
