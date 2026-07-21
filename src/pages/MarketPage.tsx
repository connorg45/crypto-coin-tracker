import {
  ErrorPanel,
  LoadingPanel,
  StatusBanner,
} from "@/components/StatusBanner";
import { MarketTable } from "@/components/MarketTable";
import { useMarketsQuery, useSentimentQuery } from "@/lib/marketQueries";

function SentimentPanel() {
  const sentiment = useSentimentQuery();
  if (sentiment.isPending)
    return (
      <div className="sentiment-panel">
        <LoadingPanel label="Loading market sentiment" />
      </div>
    );
  if (sentiment.isError)
    return (
      <section className="sentiment-panel error-compact" role="status">
        <p className="eyebrow">Fear & Greed Index</p>
        <h2>Sentiment unavailable</h2>
        <p>The market table remains available.</p>
        <button
          className="button button--small"
          type="button"
          onClick={() => void sentiment.refetch()}
        >
          Retry sentiment
        </button>
      </section>
    );
  const { data, meta } = sentiment.data;
  return (
    <section className="sentiment-panel" aria-labelledby="sentiment-title">
      <div>
        <p className="eyebrow">Alternative.me</p>
        <h2 id="sentiment-title">Fear & Greed Index</h2>
      </div>
      <dl>
        <div>
          <dt>Current</dt>
          <dd>
            <strong>{data.current.value}</strong>
            <span>{data.current.classification}</span>
          </dd>
        </div>
        <div>
          <dt>Nearest 30D</dt>
          <dd>
            <strong>{data.thirtyDaysAgo.value}</strong>
            <span>{data.thirtyDaysAgo.classification}</span>
          </dd>
        </div>
        <div>
          <dt>Nearest 1Y</dt>
          <dd>
            <strong>{data.oneYearAgo.value}</strong>
            <span>{data.oneYearAgo.classification}</span>
          </dd>
        </div>
      </dl>
      <StatusBanner meta={meta} />
    </section>
  );
}

export function MarketPage() {
  const markets = useMarketsQuery();
  return (
    <div className="page-wrap">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Live market workspace</p>
          <h1>Market overview</h1>
          <p>
            Top 50 assets with server-validated prices, seven-day shape, and
            explicit freshness.
          </p>
        </div>
        <div className="freshness-key" aria-label="Data state key">
          <span>
            <i className="dot dot--fresh" />
            Fresh
          </span>
          <span>
            <i className="dot dot--stale" />
            Saved fallback
          </span>
        </div>
      </section>
      <SentimentPanel />
      {markets.isPending ? <LoadingPanel label="Loading market data" /> : null}
      {markets.isError ? (
        <ErrorPanel
          error={markets.error}
          retry={() => void markets.refetch()}
        />
      ) : null}
      {markets.data ? (
        <>
          <StatusBanner meta={markets.data.meta} />
          {markets.data.data.length ? (
            <MarketTable coins={markets.data.data} />
          ) : (
            <section className="empty-panel">
              <h2>No market records</h2>
              <p>The provider returned no usable assets. Retry in a moment.</p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
