import { PriceChart } from "@/components/PriceChart";
import {
  ErrorPanel,
  LoadingPanel,
  StatusBanner,
} from "@/components/StatusBanner";
import { WatchButton } from "@/components/WatchButton";
import { formatCurrency, formatPercent, trendLabel } from "@/domain/portfolio";
import { safeCoinImage } from "@/lib/images";
import { useChartQuery, useCoinQuery } from "@/lib/coinQueries";
import {
  ChartRangeSchema,
  CoinIdSchema,
  type ChartRange,
} from "@shared/contracts";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const ranges: { value: ChartRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "1y", label: "1Y" },
];

export function CoinDetailPage() {
  const params = useParams();
  const parsedId = CoinIdSchema.safeParse(params.id);
  const coinId = parsedId.success ? parsedId.data : "";
  const [range, setRange] = useState<ChartRange>("7d");
  const detail = useCoinQuery(coinId);
  const chart = useChartQuery(coinId, range);

  useEffect(() => {
    document.title = detail.data
      ? `${detail.data.data.name} | Lizard Coin Tracker`
      : "Coin detail | Lizard Coin Tracker";
    return () => {
      document.title = "Lizard Coin Tracker";
    };
  }, [detail.data]);

  if (!coinId) {
    return (
      <div className="page-wrap">
        <section className="empty-panel">
          <p className="eyebrow">Invalid route</p>
          <h1>Coin not found</h1>
          <p>The coin identifier is missing or malformed.</p>
          <Link className="button button--primary" to="/">
            Return to market
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <Link className="back-link" to="/">
        ← Market overview
      </Link>
      {detail.isPending ? <LoadingPanel label="Loading coin profile" /> : null}
      {detail.isError ? (
        <ErrorPanel
          title="Coin profile unavailable"
          error={detail.error}
          retry={() => void detail.refetch()}
        />
      ) : null}
      {detail.data ? (
        <>
          <StatusBanner meta={detail.data.meta} />
          <section className="coin-heading">
            <div className="coin-identity">
              <img
                src={safeCoinImage(detail.data.data.image)}
                alt=""
                width="64"
                height="64"
              />
              <div>
                <p className="eyebrow">
                  {detail.data.data.symbol.toUpperCase()} · Rank{" "}
                  {detail.data.data.marketCapRank ?? "unavailable"}
                </p>
                <h1>{detail.data.data.name}</h1>
              </div>
            </div>
            <div className="coin-action">
              <span className="coin-price">
                {formatCurrency(
                  detail.data.data.currentPrice,
                  detail.data.data.currentPrice < 1 ? 6 : 2,
                )}
              </span>
              <span
                className={`trend-label trend-label--${trendLabel(detail.data.data.change24h).toLowerCase()}`}
              >
                {formatPercent(detail.data.data.change24h)} ·{" "}
                {trendLabel(detail.data.data.change24h)} 24H
              </span>
              <WatchButton coinId={coinId} coinName={detail.data.data.name} />
            </div>
          </section>
          <section
            className="metric-strip"
            aria-label={`${detail.data.data.name} market statistics`}
          >
            <dl>
              <div>
                <dt>Market cap</dt>
                <dd>{formatCurrency(detail.data.data.marketCap, 0)}</dd>
              </div>
              <div>
                <dt>All-time high</dt>
                <dd>
                  {formatCurrency(
                    detail.data.data.allTimeHigh,
                    detail.data.data.allTimeHigh < 1 ? 6 : 2,
                  )}
                </dd>
              </div>
              <div>
                <dt>24H change</dt>
                <dd>{formatPercent(detail.data.data.change24h)}</dd>
              </div>
            </dl>
          </section>
          <section
            className="chart-panel"
            aria-labelledby="price-history-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Validated daily observations</p>
                <h2 id="price-history-title">Price history</h2>
              </div>
              <div className="range-control" aria-label="Chart range">
                {ranges.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={range === item.value}
                    onClick={() => {
                      const parsed = ChartRangeSchema.safeParse(item.value);
                      if (parsed.success) setRange(parsed.data);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            {chart.isPending ? (
              <LoadingPanel label={`Loading ${range} chart`} />
            ) : null}
            {chart.isError ? (
              <ErrorPanel
                title="Chart unavailable"
                error={chart.error}
                retry={() => void chart.refetch()}
              />
            ) : null}
            {chart.data ? (
              <>
                <StatusBanner meta={chart.data.meta} />
                <PriceChart
                  points={chart.data.data}
                  coinName={detail.data.data.name}
                />
              </>
            ) : null}
          </section>
          <section className="description-panel">
            <p className="eyebrow">Provider summary · rendered as text</p>
            <h2>About {detail.data.data.name}</h2>
            <p>
              {detail.data.data.description ||
                "A provider description is not available for this asset."}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
