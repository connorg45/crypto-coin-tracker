import type { ApiErrorCode } from "../../shared/contracts";

export class ServiceError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly status: number;
  readonly upstreamStatus: number | null;

  constructor(
    code: ApiErrorCode,
    message: string,
    retryable: boolean,
    status: number,
    upstreamStatus: number | null = null,
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.upstreamStatus = upstreamStatus;
  }
}

export function asServiceError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  return new ServiceError(
    "UPSTREAM_UNAVAILABLE",
    "Market data is temporarily unavailable. Please retry shortly.",
    true,
    502,
  );
}
