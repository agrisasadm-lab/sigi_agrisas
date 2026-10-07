export class ProviderNotFoundOrInactiveError extends Error {
  constructor() {
    super("Provider not found or inactive");
    this.name = "ProviderNotFoundOrInactiveError";
  }
}
