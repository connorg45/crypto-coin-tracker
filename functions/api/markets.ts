import { MarketCoinSchema } from "../../shared/contracts";
import { z } from "zod";
import { edgeCache } from "../_lib/cache";
import { handleCached } from "../_lib/handler";
import { loadMarkets } from "../_lib/upstream";
import type { Env } from "../_lib/types";

export const onRequestGet: PagesFunction<Env> = async (context) =>
  handleCached({
    request: context.request,
    env: context.env,
    waitUntil: context.waitUntil,
    cache: edgeCache(),
    cacheKey: "markets/top-50/usd",
    freshSeconds: 60,
    maxStaleSeconds: 24 * 60 * 60,
    schema: z.array(MarketCoinSchema).max(50),
    load: () => loadMarkets(context.env),
  });
