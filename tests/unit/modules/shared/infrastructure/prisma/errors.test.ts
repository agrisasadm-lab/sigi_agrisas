import { isPrismaUniqueError, isPrismaNotFoundError } from "@/shared/infrastructure/prisma/errors";

describe("isPrismaUniqueError", () => {
  it("returns true for a P2002 error without a target filter", () => {
    expect(isPrismaUniqueError({ code: "P2002" })).toBe(true);
  });

  it("returns false for a non-P2002 error", () => {
    expect(isPrismaUniqueError({ code: "P2025" })).toBe(false);
  });

  it("returns false for non-object input", () => {
    expect(isPrismaUniqueError(null)).toBe(false);
    expect(isPrismaUniqueError("oops")).toBe(false);
  });

  it("matches when target is included in a string meta.target", () => {
    expect(isPrismaUniqueError({ code: "P2002", meta: { target: "customers_rfc_key" } }, "rfc")).toBe(true);
  });

  it("matches when target is included in an array meta.target", () => {
    expect(isPrismaUniqueError({ code: "P2002", meta: { target: ["rfc"] } }, "rfc")).toBe(true);
  });

  it("does not match when target is not present in meta.target", () => {
    expect(isPrismaUniqueError({ code: "P2002", meta: { target: ["code"] } }, "rfc")).toBe(false);
  });

  it("returns true for a raw-query P2010/23505 unique violation without a target filter", () => {
    expect(
      isPrismaUniqueError({
        code: "P2010",
        meta: { code: "23505", message: 'duplicate key value violates unique constraint "quotes_client_request_id_key"' },
      })
    ).toBe(true);
  });

  it("matches when target is included in meta.message for a P2010/23505 error", () => {
    expect(
      isPrismaUniqueError(
        {
          code: "P2010",
          meta: { code: "23505", message: 'duplicate key value violates unique constraint "quotes_client_request_id_key"' },
        },
        "client_request_id"
      )
    ).toBe(true);
  });

  it("does not match when target is not present in meta.message for a P2010/23505 error", () => {
    expect(
      isPrismaUniqueError(
        {
          code: "P2010",
          meta: { code: "23505", message: 'duplicate key value violates unique constraint "quotes_folio_code_key"' },
        },
        "client_request_id"
      )
    ).toBe(false);
  });

  it("does not match a P2010 error whose underlying db code is not 23505", () => {
    expect(
      isPrismaUniqueError({
        code: "P2010",
        meta: { code: "42601", message: "syntax error" },
      })
    ).toBe(false);
  });
});

describe("isPrismaNotFoundError", () => {
  it("returns true for a P2025 error", () => {
    expect(isPrismaNotFoundError({ code: "P2025" })).toBe(true);
  });

  it("returns false for a non-P2025 error", () => {
    expect(isPrismaNotFoundError({ code: "P2002" })).toBe(false);
  });
});
