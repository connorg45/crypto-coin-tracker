import { MarketTable } from "@/components/MarketTable";
import {
  ErrorPanel,
  LoadingPanel,
  StatusBanner,
} from "@/components/StatusBanner";
import { useMarketsQuery } from "@/lib/marketQueries";
import { useAppState } from "@/state/AppStateProvider";
import { Link } from "react-router-dom";

export function WatchlistPage() {
  const markets = useMarketsQuery();
  const { state } = useAppState();
  const saved =
    markets.data?.data.filter((coin) => state.watchlist.includes(coin.id)) ??
    [];
  const missing = state.watchlist.length - saved.length;
  return (
    <div className="page-wrap">
      <section className="page-heading">
        <p className="eyebrow">Saved locally</p>
        <h1>Watchlist</h1>
        <p>
          Track selected assets and record hypothetical holdings without an
          account.
        </p>
      </section>
      {markets.isPending ? (
        <LoadingPanel label="Loading saved market data" />
      ) : null}
      {markets.isError ? (
        <ErrorPanel
          error={markets.error}
          retry={() => void markets.refetch()}
        />
      ) : null}
      {markets.data ? (
        <>
          <StatusBanner meta={markets.data.meta} />
          {missing > 0 ? (
            <p className="inline-notice" role="status">
              {missing} saved {missing === 1 ? "coin is" : "coins are"} outside
              the current top 50 and cannot be priced in this view.
            </p>
          ) : null}
          {saved.length ? (
            <MarketTable coins={saved} mode="watchlist" />
          ) : (
            <section className="empty-panel">
              <p className="eyebrow">No saved assets</p>
              <h2>Build a focused watchlist</h2>
              <p>
                Use the star control in the market table, then return here to
                add local holdings.
              </p>
              <Link className="button button--primary" to="/">
                Browse market
              </Link>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
