import type { MarketCoin } from "@shared/contracts";
import type { AppStateV2 } from "./storage";

export type PortfolioPosition = {
  coin: MarketCoin;
  amount: number;
  valueUsd: number;
  allocationPercent: number;
};

export type PortfolioSummary = {
  totalValueUsd: number;
  positions: PortfolioPosition[];
  largestPosition: PortfolioPosition | null;
};

export function calculatePortfolio(
  coins: MarketCoin[],
  state: AppStateV2,
): PortfolioSummary {
  const positions = coins
    .flatMap((coin) => {
      const amount = state.holdings[coin.id];
      if (amount === undefined || !Number.isFinite(amount) || amount <= 0)
        return [];
      return [
        {
          coin,
          amount,
          valueUsd: amount * coin.currentPrice,
          allocationPercent: 0,
        },
      ];
    })
    .filter((position) => Number.isFinite(position.valueUsd));

  const totalValueUsd = positions.reduce(
    (sum, position) => sum + position.valueUsd,
    0,
  );
  const withAllocation = positions.map((position) => ({
    ...position,
    allocationPercent:
      totalValueUsd > 0 ? (position.valueUsd / totalValueUsd) * 100 : 0,
  }));
  const largestPosition = withAllocation.reduce<PortfolioPosition | null>(
    (largest, position) =>
      !largest || position.valueUsd > largest.valueUsd ? position : largest,
    null,
  );

  return { totalValueUsd, positions: withAllocation, largestPosition };
}

export function formatCurrency(
  value: number,
  maximumFractionDigits = 2,
): string {
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function trendLabel(
  value: number | null,
): "Up" | "Down" | "Flat" | "Unavailable" {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  if (value > 0) return "Up";
  if (value < 0) return "Down";
  return "Flat";
}
