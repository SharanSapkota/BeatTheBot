export class AppError extends Error {
  readonly code: string;
  readonly http_status: number;

  constructor(code: string, http_status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.http_status = http_status;
  }
}
