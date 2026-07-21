import { formatCurrency } from "@/domain/portfolio";
import type { ChartPoint } from "@shared/contracts";

export function PriceChart({
  points,
  coinName,
}: {
  points: ChartPoint[];
  coinName: string;
}) {
  if (points.length < 2)
    return (
      <p className="empty-inline">
        Not enough chart data is available for this range.
      </p>
    );
  const width = 960;
  const height = 320;
  const padding = 24;
  const prices = points.map((point) => point.priceUsd);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const span = Math.max(high - low, 1e-9);
  const coords = points.map((point, index) => ({
    x: padding + (index / (points.length - 1)) * (width - padding * 2),
    y:
      height -
      padding -
      ((point.priceUsd - low) / span) * (height - padding * 2),
  }));
  const line = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const direction = prices.at(-1)! >= prices[0]! ? "increased" : "decreased";

  return (
    <figure className="price-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="chart-title chart-description"
      >
        <title id="chart-title">{coinName} historical price</title>
        <desc id="chart-description">
          {coinName} {direction} across this range. Low{" "}
          {formatCurrency(low, low < 1 ? 6 : 2)}; high{" "}
          {formatCurrency(high, high < 1 ? 6 : 2)}.
        </desc>
        <line
          className="chart-grid"
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
        />
        <line
          className="chart-grid"
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
        />
        <polygon className="chart-area" points={area} />
        <polyline className="chart-line" points={line} fill="none" />
      </svg>
      <figcaption>
        <span>
          Low <strong>{formatCurrency(low, low < 1 ? 6 : 2)}</strong>
        </span>
        <span>
          High <strong>{formatCurrency(high, high < 1 ? 6 : 2)}</strong>
        </span>
      </figcaption>
    </figure>
  );
}
