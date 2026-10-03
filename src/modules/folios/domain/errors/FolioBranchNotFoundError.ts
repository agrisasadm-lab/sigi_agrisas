export class FolioBranchNotFoundError extends Error {
  constructor(branchId: string) {
    super(`Branch not found: ${branchId}`);
    this.name = "FolioBranchNotFoundError";
  }
}
