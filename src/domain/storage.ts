import { CoinIdSchema } from "@shared/contracts";
import { z } from "zod";

export const APP_STATE_KEY = "lct:state";
export const LEGACY_WATCHLIST_KEY = "watchListCoinIds";
export const NUMERIC_LEGACY_WATCHLIST_KEY = "watchListArr";
export const LEGACY_HOLDINGS_KEY = "portfolioHoldings";
export const MAX_HOLDING_AMOUNT = 1_000_000_000_000;
export const MAX_WATCHLIST_SIZE = 100;

export const AppStateV2Schema = z
  .object({
    version: z.literal(2),
    watchlist: z.array(CoinIdSchema).max(MAX_WATCHLIST_SIZE),
    holdings: z.record(
      CoinIdSchema,
      z.number().positive().max(MAX_HOLDING_AMOUNT),
    ),
  })
  .strict();

export type AppStateV2 = z.infer<typeof AppStateV2Schema>;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LoadStateResult = {
  state: AppStateV2;
  migrated: boolean;
  discardedNumericLegacy: boolean;
};

export const EMPTY_APP_STATE: AppStateV2 = {
  version: 2,
  watchlist: [],
  holdings: {},
};

function parseJson(value: string | null): unknown {
  if (value === null) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function sanitizeCoinId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return CoinIdSchema.safeParse(normalized).success ? normalized : null;
}

export function sanitizeWatchlist(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const unique = new Set<string>();
  for (const candidate of value) {
    const coinId = sanitizeCoinId(candidate);
    if (coinId) unique.add(coinId);
    if (unique.size === MAX_WATCHLIST_SIZE) break;
  }
  return [...unique];
}

export function sanitizeHoldings(value: unknown): Record<string, number> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return {};

  const holdings: Record<string, number> = {};
  for (const [candidateId, candidateAmount] of Object.entries(value)) {
    const coinId = sanitizeCoinId(candidateId);
    const amount =
      typeof candidateAmount === "number"
        ? candidateAmount
        : Number(candidateAmount);
    if (
      coinId &&
      Number.isFinite(amount) &&
      amount > 0 &&
      amount <= MAX_HOLDING_AMOUNT
    ) {
      holdings[coinId] = amount;
    }
  }
  return holdings;
}

export function sanitizeState(value: unknown): AppStateV2 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(EMPTY_APP_STATE);
  }
  const candidate = value as Record<string, unknown>;
  return {
    version: 2,
    watchlist: sanitizeWatchlist(candidate.watchlist),
    holdings: sanitizeHoldings(candidate.holdings),
  };
}

export function saveAppState(
  storage: StorageLike,
  state: AppStateV2,
): AppStateV2 {
  const sanitized = sanitizeState(state);
  storage.setItem(APP_STATE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export function loadAppState(storage: StorageLike): LoadStateResult {
  const currentRaw = storage.getItem(APP_STATE_KEY);
  if (currentRaw !== null) {
    const state = sanitizeState(parseJson(currentRaw));
    try {
      saveAppState(storage, state);
    } catch {
      // A full or disabled storage area must not prevent the app from loading.
    }
    return { state, migrated: false, discardedNumericLegacy: false };
  }

  const legacyWatchlistRaw = storage.getItem(LEGACY_WATCHLIST_KEY);
  const legacyHoldingsRaw = storage.getItem(LEGACY_HOLDINGS_KEY);
  const numericLegacyRaw = storage.getItem(NUMERIC_LEGACY_WATCHLIST_KEY);
  const hasLegacy =
    legacyWatchlistRaw !== null ||
    legacyHoldingsRaw !== null ||
    numericLegacyRaw !== null;
  const state: AppStateV2 = {
    version: 2,
    watchlist: sanitizeWatchlist(parseJson(legacyWatchlistRaw)),
    holdings: sanitizeHoldings(parseJson(legacyHoldingsRaw)),
  };

  if (hasLegacy) {
    try {
      saveAppState(storage, state);
      storage.removeItem(LEGACY_WATCHLIST_KEY);
      storage.removeItem(LEGACY_HOLDINGS_KEY);
      storage.removeItem(NUMERIC_LEGACY_WATCHLIST_KEY);
    } catch {
      // Keep the sanitized in-memory value when storage is unavailable.
    }
  }

  return {
    state,
    migrated: hasLegacy,
    discardedNumericLegacy: numericLegacyRaw !== null,
  };
}

export function updateWatchlist(
  state: AppStateV2,
  coinId: string,
  saved: boolean,
): AppStateV2 {
  const normalized = sanitizeCoinId(coinId);
  if (!normalized) return state;

  const watchlist = saved
    ? sanitizeWatchlist([...state.watchlist, normalized])
    : state.watchlist.filter((id) => id !== normalized);

  return { ...state, watchlist };
}

export function updateHolding(
  state: AppStateV2,
  coinId: string,
  amount: number | null,
): AppStateV2 {
  const normalized = sanitizeCoinId(coinId);
  if (!normalized) return state;

  const holdings = { ...state.holdings };
  if (
    amount === null ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > MAX_HOLDING_AMOUNT
  ) {
    delete holdings[normalized];
  } else {
    holdings[normalized] = amount;
  }
  return { ...state, holdings };
}
