import { CoinDetailSchema, CoinIdSchema } from "../../../shared/contracts";
import { edgeCache } from "../../_lib/cache";
import { handleCached, invalidRequest } from "../../_lib/handler";
import { loadCoin } from "../../_lib/upstream";
import type { Env } from "../../_lib/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const parsedId = CoinIdSchema.safeParse(context.params.id);
  if (!parsedId.success)
    return invalidRequest("Coin ID must be a lowercase provider slug.");
  const coinId = parsedId.data;
  return handleCached({
    request: context.request,
    env: context.env,
    waitUntil: context.waitUntil,
    cache: edgeCache(),
    cacheKey: `coins/${coinId}/detail`,
    freshSeconds: 10 * 60,
    maxStaleSeconds: 24 * 60 * 60,
    schema: CoinDetailSchema,
    load: () => loadCoin(context.env, coinId),
  });
};
