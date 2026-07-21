import {
  APP_STATE_KEY,
  EMPTY_APP_STATE,
  LEGACY_HOLDINGS_KEY,
  LEGACY_WATCHLIST_KEY,
  MAX_HOLDING_AMOUNT,
  NUMERIC_LEGACY_WATCHLIST_KEY,
  loadAppState,
  sanitizeCoinId,
  sanitizeHoldings,
  sanitizeState,
  sanitizeWatchlist,
  saveAppState,
  updateHolding,
  updateWatchlist,
  type StorageLike,
} from "@/domain/storage";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("AppStateV2 storage", () => {
  it("normalizes and rejects invalid coin IDs", () => {
    expect(sanitizeCoinId(" Bitcoin ")).toBe("bitcoin");
    expect(sanitizeCoinId("../bitcoin")).toBeNull();
    expect(sanitizeCoinId(42)).toBeNull();
  });

  it("trims, deduplicates, validates, and bounds watchlists", () => {
    const input = [
      " Bitcoin ",
      "bitcoin",
      "",
      null,
      "ethereum",
      ...Array.from({ length: 110 }, (_, index) => `coin-${index}`),
    ];
    const result = sanitizeWatchlist(input);
    expect(result.slice(0, 2)).toEqual(["bitcoin", "ethereum"]);
    expect(result).toHaveLength(100);
    expect(sanitizeWatchlist("bitcoin")).toEqual([]);
  });

  it("accepts only finite, positive, bounded holdings", () => {
    expect(
      sanitizeHoldings({
        Bitcoin: "2.5",
        ethereum: 0,
        dogecoin: Infinity,
        cardano: MAX_HOLDING_AMOUNT + 1,
        solana: 3,
      }),
    ).toEqual({ bitcoin: 2.5, solana: 3 });
    expect(sanitizeHoldings([])).toEqual({});
  });

  it("sanitizes malformed state and saves a canonical value", () => {
    const storage = new MemoryStorage();
    const state = sanitizeState({
      watchlist: [" Bitcoin ", "bitcoin"],
      holdings: { bitcoin: "1.2" },
    });
    expect(saveAppState(storage, state)).toEqual({
      version: 2,
      watchlist: ["bitcoin"],
      holdings: { bitcoin: 1.2 },
    });
    expect(JSON.parse(storage.getItem(APP_STATE_KEY)!)).toEqual(state);
    expect(sanitizeState(null)).toEqual(EMPTY_APP_STATE);
  });

  it("loads valid current state and is idempotent", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      APP_STATE_KEY,
      JSON.stringify({
        version: 2,
        watchlist: ["bitcoin", "bitcoin"],
        holdings: { bitcoin: 2 },
      }),
    );
    const first = loadAppState(storage);
    const second = loadAppState(storage);
    expect(first.state.watchlist).toEqual(["bitcoin"]);
    expect(first.migrated).toBe(false);
    expect(second).toEqual(first);
  });

  it("recovers from malformed current JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(APP_STATE_KEY, "{broken");
    expect(loadAppState(storage).state).toEqual(EMPTY_APP_STATE);
  });

  it("migrates legacy IDs and holdings once and discards unrecoverable ranks", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_WATCHLIST_KEY,
      JSON.stringify([" Bitcoin ", "ethereum", "bitcoin"]),
    );
    storage.setItem(
      LEGACY_HOLDINGS_KEY,
      JSON.stringify({ bitcoin: "1.5", ethereum: -2 }),
    );
    storage.setItem(NUMERIC_LEGACY_WATCHLIST_KEY, JSON.stringify([0, 4]));
    const result = loadAppState(storage);
    expect(result).toEqual({
      state: {
        version: 2,
        watchlist: ["bitcoin", "ethereum"],
        holdings: { bitcoin: 1.5 },
      },
      migrated: true,
      discardedNumericLegacy: true,
    });
    expect(storage.getItem(LEGACY_WATCHLIST_KEY)).toBeNull();
    expect(loadAppState(storage).migrated).toBe(false);
  });

  it("keeps sanitized in-memory state if persistence is unavailable", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_WATCHLIST_KEY, JSON.stringify(["bitcoin"]));
    storage.setItem = () => {
      throw new Error("quota");
    };
    expect(loadAppState(storage).state.watchlist).toEqual(["bitcoin"]);
  });

  it("updates watchlist without deleting holdings by default", () => {
    const withHolding = {
      version: 2 as const,
      watchlist: ["bitcoin"],
      holdings: { bitcoin: 2 },
    };
    expect(updateWatchlist(withHolding, "bitcoin", false)).toEqual({
      version: 2,
      watchlist: [],
      holdings: { bitcoin: 2 },
    });
    expect(
      updateWatchlist(EMPTY_APP_STATE, " Ethereum ", true).watchlist,
    ).toEqual(["ethereum"]);
    expect(updateWatchlist(EMPTY_APP_STATE, "../bad", true)).toBe(
      EMPTY_APP_STATE,
    );
  });

  it("sets and removes valid holdings", () => {
    const added = updateHolding(EMPTY_APP_STATE, "bitcoin", 1.25);
    expect(added.holdings).toEqual({ bitcoin: 1.25 });
    expect(updateHolding(added, "bitcoin", null).holdings).toEqual({});
    expect(updateHolding(added, "bitcoin", Infinity).holdings).toEqual({});
    expect(updateHolding(added, "bad/id", 2)).toBe(added);
  });
});
