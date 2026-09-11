export class AccxError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(status: number, message = "ACCX request was rejected.") {
    super(message);
    this.name = "AccxError";
    this.status = status;
    this.retryable = status === 0 || status === 408 || status === 429 || status >= 500;
  }
}