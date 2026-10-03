import { formatBranchFolioCode } from "@/shared/domain/folios/formatBranchFolioCode";

describe("formatBranchFolioCode", () => {
  it("con prefix: <prefix><BRANCH_CODE>-<NNNNNN>", () => {
    expect(formatBranchFolioCode("TK-", "TK", "ZARIOZ", 1)).toBe("TK-ZARIOZ-000001");
  });

  it("con prefix distinto: <prefix><BRANCH_CODE>-<NNNNNN>", () => {
    expect(formatBranchFolioCode("CP-", "CP", "PRADERA", 42)).toBe("CP-PRADERA-000042");
  });

  it("sin prefix: <code>-<BRANCH_CODE>-<NNNNNN>", () => {
    expect(formatBranchFolioCode(null, "COT", "HUAJUAPAN", 7)).toBe("COT-HUAJUAPAN-000007");
  });

  it("acolcha a 6 dígitos", () => {
    expect(formatBranchFolioCode("TC-", "TC", "MATRIZ", 1)).toBe("TC-MATRIZ-000001");
    expect(formatBranchFolioCode("TC-", "TC", "MATRIZ", 999999)).toBe("TC-MATRIZ-999999");
  });

  it("no acolcha más allá de 6 dígitos cuando el número los excede", () => {
    expect(formatBranchFolioCode("TC-", "TC", "MATRIZ", 1000000)).toBe("TC-MATRIZ-1000000");
  });

  it("distintos branchCode producen códigos distintos para el mismo número", () => {
    const a = formatBranchFolioCode("TK-", "TK", "ZARIOZ", 1);
    const b = formatBranchFolioCode("TK-", "TK", "PRADERA", 1);
    expect(a).not.toBe(b);
  });
});
