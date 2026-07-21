import { formatCurrency, formatPercent, trendLabel } from "@/domain/portfolio";
import { MAX_HOLDING_AMOUNT } from "@/domain/storage";
import { safeCoinImage } from "@/lib/images";
import { useAppState } from "@/state/AppStateProvider";
import type { MarketCoin } from "@shared/contracts";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { WatchButton } from "./WatchButton";

function Trend({ value }: { value: number | null }) {
  const label = trendLabel(value);
  const className =
    label === "Up"
      ? "trend trend--up"
      : label === "Down"
        ? "trend trend--down"
        : "trend";
  return (
    <span className={className}>
      <span className="trend-icon" aria-hidden="true">
        {label === "Up" ? "↗" : label === "Down" ? "↘" : "→"}
      </span>
      {formatPercent(value)} <span className="sr-only">{label}</span>
    </span>
  );
}

function Sparkline({ prices, name }: { prices: number[]; name: string }) {
  if (prices.length < 2) return <span className="muted">Unavailable</span>;
  const width = 110;
  const height = 34;
  const min = Math.min(...prices);
  const span = Math.max(Math.max(...prices) - min, 1e-9);
  const points = prices
    .map(
      (price, index) =>
        `${(index / (prices.length - 1)) * width},${height - ((price - min) / span) * height}`,
    )
    .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${name} seven-day price trend`}
    >
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function HoldingEditor({ coin }: { coin: MarketCoin }) {
  const { state, setHolding } = useAppState();
  const current = state.holdings[coin.id];
  const [value, setValue] = useState(current?.toString() ?? "");
  const [message, setMessage] = useState(
    current ? `Saved: ${current}` : "No amount saved",
  );
  const inputId = `holding-${coin.id}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(value);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_HOLDING_AMOUNT
    ) {
      setMessage(
        `Enter a number greater than 0 and no more than ${MAX_HOLDING_AMOUNT.toLocaleString()}.`,
      );
      return;
    }
    setHolding(coin.id, amount);
    setMessage(
      `Saved: ${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}`,
    );
  }

  return (
    <form className="holding-form" onSubmit={submit}>
      <label className="sr-only" htmlFor={inputId}>
        Amount of {coin.name} owned
      </label>
      <input
        id={inputId}
        type="number"
        min="0"
        max={MAX_HOLDING_AMOUNT}
        step="any"
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Amount owned"
      />
      <button className="button button--small" type="submit">
        Save
      </button>
      {current ? (
        <button
          className="button button--text"
          type="button"
          onClick={() => {
            setHolding(coin.id, null);
            setValue("");
            setMessage("Holding removed");
          }}
        >
          Remove
        </button>
      ) : null}
      <span className="holding-message" role="status">
        {message}
      </span>
    </form>
  );
}

export function MarketTable({
  coins,
  mode = "market",
}: {
  coins: MarketCoin[];
  mode?: "market" | "watchlist";
}) {
  return (
    <div className="table-frame">
      <table className="market-table">
        <caption>
          {mode === "market"
            ? "Top cryptocurrency market data in U.S. dollars"
            : "Saved coins and local holding amounts"}
        </caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Asset</th>
            <th scope="col">Price</th>
            <th scope="col">24 hours</th>
            <th scope="col">7 days</th>
            <th scope="col">Market cap</th>
            <th scope="col">7D shape</th>
            <th scope="col">Watchlist</th>
            {mode === "watchlist" ? <th scope="col">Holding</th> : null}
          </tr>
        </thead>
        <tbody>
          {coins.map((coin) => (
            <tr key={coin.id}>
              <td data-label="Rank">{coin.marketCapRank ?? "—"}</td>
              <th scope="row" data-label="Asset">
                <Link className="coin-link" to={`/coin/${coin.id}`}>
                  <img
                    src={safeCoinImage(coin.image)}
                    alt=""
                    width="36"
                    height="36"
                  />
                  <span>
                    <strong>{coin.name}</strong>
                    <small>{coin.symbol.toUpperCase()}</small>
                  </span>
                </Link>
              </th>
              <td data-label="Price">
                {formatCurrency(
                  coin.currentPrice,
                  coin.currentPrice < 1 ? 6 : 2,
                )}
              </td>
              <td data-label="24 hours">
                <Trend value={coin.change24h} />
              </td>
              <td data-label="7 days">
                <Trend value={coin.change7d} />
              </td>
              <td data-label="Market cap">
                {formatCurrency(coin.marketCap, 0)}
              </td>
              <td data-label="7D shape">
                <Sparkline prices={coin.sparkline7d} name={coin.name} />
              </td>
              <td data-label="Watchlist">
                <WatchButton coinId={coin.id} coinName={coin.name} />
              </td>
              {mode === "watchlist" ? (
                <td data-label="Holding">
                  <HoldingEditor coin={coin} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
