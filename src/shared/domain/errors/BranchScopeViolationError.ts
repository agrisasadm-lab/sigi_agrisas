export class BranchScopeViolationError extends Error {
  constructor() {
    super("Branch scope violation");
    this.name = "BranchScopeViolationError";
  }
}
