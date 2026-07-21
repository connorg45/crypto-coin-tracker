import {
  ChartPointSchema,
  ChartRangeSchema,
  CoinIdSchema,
} from "../../../../shared/contracts";
import { z } from "zod";
import { edgeCache } from "../../../_lib/cache";
import { handleCached, invalidRequest } from "../../../_lib/handler";
import { loadChart } from "../../../_lib/upstream";
import type { Env } from "../../../_lib/types";

const daysByRange = { "7d": "7", "30d": "30", "1y": "365" } as const;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const parsedId = CoinIdSchema.safeParse(context.params.id);
  const parsedRange = ChartRangeSchema.safeParse(
    new URL(context.request.url).searchParams.get("range"),
  );
  if (!parsedId.success)
    return invalidRequest("Coin ID must be a lowercase provider slug.");
  if (!parsedRange.success)
    return invalidRequest("Chart range must be 7d, 30d, or 1y.");
  const coinId = parsedId.data;
  const range = parsedRange.data;
  return handleCached({
    request: context.request,
    env: context.env,
    waitUntil: context.waitUntil,
    cache: edgeCache(),
    cacheKey: `coins/${coinId}/chart/${range}`,
    freshSeconds: 15 * 60,
    maxStaleSeconds: 24 * 60 * 60,
    schema: z.array(ChartPointSchema).max(2_000),
    load: () => loadChart(context.env, coinId, daysByRange[range]),
  });
};
