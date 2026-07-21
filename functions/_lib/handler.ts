import type { ApiError, ApiEnvelope } from "../../shared/contracts";
import type { z } from "zod";
import { asServiceError } from "./errors";
import { resolveCached } from "./cache";
import type { Env, UpstreamResult } from "./types";

type HandlerContext<T> = {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  cache: Pick<Cache, "match" | "put">;
  cacheKey: string;
  freshSeconds: number;
  maxStaleSeconds: number;
  schema: z.ZodType<T>;
  load: () => Promise<UpstreamResult<T>>;
};

function jsonResponse(
  body: unknown,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export async function handleCached<T>(
  context: HandlerContext<T>,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const outcome = await resolveCached({
      cache: context.cache,
      key: context.cacheKey,
      freshSeconds: context.freshSeconds,
      maxStaleSeconds: context.maxStaleSeconds,
      schema: context.schema,
      load: context.load,
      waitUntil: context.waitUntil,
    });
    const body: ApiEnvelope<T> = {
      data: outcome.data,
      meta: {
        freshness: outcome.freshness,
        source: outcome.source,
        fetchedAt: outcome.fetchedAt,
        ageSeconds: outcome.ageSeconds,
        requestId,
      },
    };
    console.log(
      JSON.stringify({
        event: "api_request",
        requestId,
        route: new URL(context.request.url).pathname,
        outcome: "success",
        cacheStatus: outcome.cacheStatus,
        ageSeconds: outcome.ageSeconds,
        durationMs: Date.now() - startedAt,
        attempts: outcome.attempts,
      }),
    );
    return jsonResponse(body, 200, {
      "X-LCT-Cache": outcome.cacheStatus,
      "X-Request-ID": requestId,
      "Server-Timing": `total;dur=${Date.now() - startedAt}, upstream;dur=${outcome.durationMs}`,
    });
  } catch (error) {
    const serviceError = asServiceError(error);
    const body: ApiError = {
      error: {
        code: serviceError.code,
        message: serviceError.message,
        retryable: serviceError.retryable,
        requestId,
      },
    };
    console.log(
      JSON.stringify({
        event: "api_request",
        requestId,
        route: new URL(context.request.url).pathname,
        outcome: "error",
        code: serviceError.code,
        upstreamStatus: serviceError.upstreamStatus,
        durationMs: Date.now() - startedAt,
      }),
    );
    return jsonResponse(body, serviceError.status, {
      "X-LCT-Cache": "MISS",
      "X-Request-ID": requestId,
      "Server-Timing": `total;dur=${Date.now() - startedAt}`,
    });
  }
}

export function invalidRequest(message: string): Response {
  const requestId = crypto.randomUUID();
  const body: ApiError = {
    error: { code: "INVALID_REQUEST", message, retryable: false, requestId },
  };
  return jsonResponse(body, 400, {
    "X-LCT-Cache": "MISS",
    "X-Request-ID": requestId,
  });
}
