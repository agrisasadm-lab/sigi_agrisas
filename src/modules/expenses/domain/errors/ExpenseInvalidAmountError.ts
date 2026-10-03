export class ExpenseInvalidAmountError extends Error {
  constructor() {
    super("Expense amount must be greater than zero");
    this.name = "ExpenseInvalidAmountError";
  }
}
