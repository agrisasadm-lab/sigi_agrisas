export class ExpenseNotFoundError extends Error {
  constructor() {
    super("Expense not found");
    this.name = "ExpenseNotFoundError";
  }
}

export class ExpenseInvalidAmountError extends Error {
  constructor() {
    super("Expense amount must be greater than zero");
    this.name = "ExpenseInvalidAmountError";
  }
}

export class ExpensePhotoInvalidFormatError extends Error {
  constructor() {
    super("Invalid image format");
    this.name = "ExpensePhotoInvalidFormatError";
  }
}

export class ExpensePhotoTooLargeError extends Error {
  constructor() {
    super("Image too large");
    this.name = "ExpensePhotoTooLargeError";
  }
}

export class ReportTooLargeError extends Error {
  constructor() {
    super("El conjunto de datos supera 10,000 registros. Aplica más filtros.");
    this.name = "ReportTooLargeError";
  }
}
