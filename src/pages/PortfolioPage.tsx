import { calculatePortfolio, formatCurrency } from "@/domain/portfolio";
import {
  ErrorPanel,
  LoadingPanel,
  StatusBanner,
} from "@/components/StatusBanner";
import { safeCoinImage } from "@/lib/images";
import { useMarketsQuery } from "@/lib/marketQueries";
import { useAppState } from "@/state/AppStateProvider";
import { useState } from "react";
import { Link } from "react-router-dom";

export function PortfolioPage() {
  const markets = useMarketsQuery();
  const { state, setHolding, clearState } = useAppState();
  const [removing, setRemoving] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const summary = calculatePortfolio(markets.data?.data ?? [], state);
  const unpricedCount =
    Object.keys(state.holdings).length - summary.positions.length;

  return (
    <div className="page-wrap">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Hypothetical positions</p>
          <h1>Portfolio</h1>
          <p>
            Amounts stay in this browser. Values are estimates, not trading
            balances.
          </p>
        </div>
        {Object.keys(state.holdings).length ? (
          <button
            className="button button--danger"
            type="button"
            onClick={() => setClearing(true)}
          >
            Clear local data
          </button>
        ) : null}
      </section>
      {markets.isPending ? (
        <LoadingPanel label="Calculating portfolio" />
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
          <section className="portfolio-summary" aria-label="Portfolio summary">
            <dl>
              <div>
                <dt>Estimated value</dt>
                <dd>{formatCurrency(summary.totalValueUsd)}</dd>
              </div>
              <div>
                <dt>Priced positions</dt>
                <dd>{summary.positions.length}</dd>
              </div>
              <div>
                <dt>Largest allocation</dt>
                <dd>
                  {summary.largestPosition
                    ? `${summary.largestPosition.coin.name} · ${summary.largestPosition.allocationPercent.toFixed(1)}%`
                    : "None"}
                </dd>
              </div>
            </dl>
          </section>
          {unpricedCount > 0 ? (
            <p className="inline-notice" role="status">
              {unpricedCount} holding {unpricedCount === 1 ? "is" : "are"}{" "}
              outside the current top 50 and excluded from this estimate.
            </p>
          ) : null}
          {summary.positions.length ? (
            <div className="table-frame">
              <table className="portfolio-table">
                <caption>
                  Locally saved hypothetical positions valued with current
                  market data
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Asset</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Price</th>
                    <th scope="col">Value</th>
                    <th scope="col">Allocation</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.positions.map((position) => (
                    <tr key={position.coin.id}>
                      <th scope="row">
                        <Link
                          className="coin-link"
                          to={`/coin/${position.coin.id}`}
                        >
                          <img
                            src={safeCoinImage(position.coin.image)}
                            alt=""
                            width="36"
                            height="36"
                          />
                          <span>
                            <strong>{position.coin.name}</strong>
                            <small>{position.coin.symbol.toUpperCase()}</small>
                          </span>
                        </Link>
                      </th>
                      <td data-label="Amount">
                        {position.amount.toLocaleString(undefined, {
                          maximumFractionDigits: 8,
                        })}
                      </td>
                      <td data-label="Price">
                        {formatCurrency(
                          position.coin.currentPrice,
                          position.coin.currentPrice < 1 ? 6 : 2,
                        )}
                      </td>
                      <td data-label="Value">
                        <strong>{formatCurrency(position.valueUsd)}</strong>
                      </td>
                      <td data-label="Allocation">
                        {position.allocationPercent.toFixed(1)}%
                      </td>
                      <td data-label="Action">
                        {removing === position.coin.id ? (
                          <span className="inline-confirm" role="alert">
                            <span>Delete?</span>
                            <button
                              className="button button--danger button--small"
                              type="button"
                              onClick={() => {
                                setHolding(position.coin.id, null);
                                setRemoving(null);
                              }}
                            >
                              Yes
                            </button>
                            <button
                              className="button button--small"
                              type="button"
                              onClick={() => setRemoving(null)}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            className="button button--text"
                            type="button"
                            onClick={() => setRemoving(position.coin.id)}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className="empty-panel">
              <p className="eyebrow">No positions</p>
              <h2>Add a hypothetical holding</h2>
              <p>
                Save a coin, enter an amount on the watchlist, and its estimated
                value will appear here.
              </p>
              <Link className="button button--primary" to="/watchlist">
                Open watchlist
              </Link>
            </section>
          )}
        </>
      ) : null}
      {clearing ? (
        <div className="dialog-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-title"
          >
            <p className="eyebrow">Browser storage</p>
            <h2 id="clear-title">Clear all watchlist and holding data?</h2>
            <p>This only affects this browser and cannot be undone.</p>
            <div className="button-row">
              <button
                className="button button--danger"
                type="button"
                onClick={() => {
                  clearState();
                  setClearing(false);
                }}
              >
                Clear data
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setClearing(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
