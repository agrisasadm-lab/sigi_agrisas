export class CustomerNotAvailableInBranchError extends Error {
  constructor() {
    super("Customer is not available in this branch");
    this.name = "CustomerNotAvailableInBranchError";
  }
}
