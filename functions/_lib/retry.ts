import { ServiceError } from "./errors";

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export type RetryDependencies = {
  fetcher?: typeof fetch;
  now?: () => number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  deadlineMs?: number;
};

export type RetriedResponse = {
  response: Response;
  attempts: number;
  durationMs: number;
};

function retryAfterMilliseconds(response: Response): number | null {
  const raw = response.headers.get("Retry-After");
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 2
    ? seconds * 1000
    : null;
}

function responseError(response: Response): ServiceError {
  if (response.status === 404) {
    return new ServiceError(
      "NOT_FOUND",
      "The requested coin was not found.",
      false,
      404,
      response.status,
    );
  }
  if (response.status === 429) {
    return new ServiceError(
      "UPSTREAM_RATE_LIMITED",
      "The market-data provider is rate limiting requests. Please retry shortly.",
      true,
      429,
      response.status,
    );
  }
  return new ServiceError(
    "UPSTREAM_UNAVAILABLE",
    "The market-data provider is temporarily unavailable.",
    RETRYABLE_STATUSES.has(response.status),
    502,
    response.status,
  );
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  dependencies: RetryDependencies = {},
): Promise<RetriedResponse> {
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const sleep =
    dependencies.sleep ??
    ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const deadlineMs = dependencies.deadlineMs ?? 8_000;
  const start = now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const remaining = deadlineMs - (now() - start);
    if (remaining <= 0) {
      throw new ServiceError(
        "UPSTREAM_TIMEOUT",
        "The market-data provider timed out.",
        true,
        504,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await fetcher(url, {
        ...init,
        signal: controller.signal,
      });
      if (response.ok)
        return { response, attempts: attempt, durationMs: now() - start };

      lastError = responseError(response);
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === 3)
        throw lastError;

      const retryAfter = retryAfterMilliseconds(response);
      const ceiling = attempt === 1 ? 250 : 750;
      const delay = retryAfter ?? Math.floor(random() * (ceiling + 1));
      if (now() - start + delay >= deadlineMs) {
        throw new ServiceError(
          "UPSTREAM_TIMEOUT",
          "The market-data provider timed out.",
          true,
          504,
        );
      }
      await sleep(delay);
    } catch (error) {
      if (error instanceof ServiceError) {
        if (!error.retryable || attempt === 3) throw error;
        lastError = error;
      } else {
        lastError = error;
        if (attempt === 3) {
          const timedOut =
            error instanceof DOMException && error.name === "AbortError";
          throw new ServiceError(
            timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
            timedOut
              ? "The market-data provider timed out."
              : "The market-data provider could not be reached.",
            true,
            timedOut ? 504 : 502,
          );
        }
        const ceiling = attempt === 1 ? 250 : 750;
        await sleep(Math.floor(random() * (ceiling + 1)));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ServiceError(
        "UPSTREAM_UNAVAILABLE",
        "The market-data provider is unavailable.",
        true,
        502,
      );
}
