import type { ErrorCode } from '../api/types.js';

export interface ErrorDetail {
  field?: string;
  issue?: string;
}

/** Domain error carrying an API error code; mapped to the API.md error format by app.onError. */
export class ApiException extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: 400 | 404 | 412 | 500 | 502 | 503,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
  }
}

export const validation = (message: string, field?: string) =>
  new ApiException('VALIDATION_ERROR', 400, message, field ? [{ field, issue: message }] : undefined);
export const notFound = (message = 'Not found') => new ApiException('NOT_FOUND', 404, message);
export const preconditionFailed = (message = 'This item was changed elsewhere. Reload it and try again.') =>
  new ApiException('PRECONDITION_FAILED', 412, message);
