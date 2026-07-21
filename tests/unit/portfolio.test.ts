import {
  calculatePortfolio,
  formatCurrency,
  formatPercent,
  trendLabel,
} from "@/domain/portfolio";
import { marketCoins } from "../fixtures";

describe("portfolio calculations and formatting", () => {
  it("calculates totals, allocations, and largest position", () => {
    const result = calculatePortfolio(marketCoins, {
      version: 2,
      watchlist: [],
      holdings: { bitcoin: 0.5, ethereum: 10 },
    });
    expect(result.totalValueUsd).toBe(64_000);
    expect(result.positions).toHaveLength(2);
    expect(result.positions[0]!.allocationPercent).toBe(50);
    expect(result.largestPosition?.coin.id).toBe("bitcoin");
  });

  it("ignores invalid, missing, and overflowed values", () => {
    const result = calculatePortfolio(marketCoins, {
      version: 2,
      watchlist: [],
      holdings: { bitcoin: -1, ethereum: Number.POSITIVE_INFINITY, solana: 4 },
    });
    expect(result).toEqual({
      totalValueUsd: 0,
      positions: [],
      largestPosition: null,
    });
  });

  it("formats valid and invalid values accessibly", () => {
    expect(formatCurrency(12.345)).toBe("$12.35");
    expect(formatCurrency(Number.NaN)).toBe("Unavailable");
    expect(formatPercent(2)).toBe("+2.00%");
    expect(formatPercent(-2)).toBe("-2.00%");
    expect(formatPercent(null)).toBe("Unavailable");
    expect(trendLabel(1)).toBe("Up");
    expect(trendLabel(-1)).toBe("Down");
    expect(trendLabel(0)).toBe("Flat");
    expect(trendLabel(null)).toBe("Unavailable");
  });
});
