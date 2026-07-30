/**
 * Application errors raised by services and mapped by the centralized handler.
 *
 * `statusCode` and `code` match the shape `registerErrorHandler` already reads
 * off thrown errors, so replacing the ad-hoc
 * `Object.assign(new Error(m), { statusCode, code })` pattern with this class
 * changes nothing about the response body — it just makes the contract typed
 * and greppable instead of implicit.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 400 — the request is well-formed but not acceptable. */
export const badRequest = (code: string, message: string) =>
  new AppError(400, code, message);

/** 403 — authenticated, but not permitted. */
export const forbidden = (code: string, message: string) =>
  new AppError(403, code, message);

/**
 * 404 — also used to hide existence from callers who may not see a record,
 * which is why several services return it instead of 403.
 */
export const notFound = (code: string, message: string) =>
  new AppError(404, code, message);

/** 409 — conflicts with current state, such as a uniqueness violation. */
export const conflict = (code: string, message: string) =>
  new AppError(409, code, message);
