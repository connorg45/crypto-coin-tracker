import { SentimentDataSchema } from "../../shared/contracts";
import { edgeCache } from "../_lib/cache";
import { handleCached } from "../_lib/handler";
import { loadSentiment } from "../_lib/upstream";
import type { Env } from "../_lib/types";

export const onRequestGet: PagesFunction<Env> = async (context) =>
  handleCached({
    request: context.request,
    env: context.env,
    waitUntil: context.waitUntil,
    cache: edgeCache(),
    cacheKey: "sentiment/365d",
    freshSeconds: 60,
    maxStaleSeconds: 72 * 60 * 60,
    schema: SentimentDataSchema,
    load: () => loadSentiment(),
  });
