import { useAppState } from "@/state/AppStateProvider";
import { useRef, useState } from "react";

export function WatchButton({
  coinId,
  coinName,
}: {
  coinId: string;
  coinName: string;
}) {
  const { state, setWatchlisted } = useAppState();
  const [confirming, setConfirming] = useState(false);
  const keepButton = useRef<HTMLButtonElement>(null);
  const saved = state.watchlist.includes(coinId);
  const hasHolding = state.holdings[coinId] !== undefined;

  function toggle() {
    if (!saved) {
      setWatchlisted(coinId, true);
      return;
    }
    if (hasHolding) {
      setConfirming(true);
      queueMicrotask(() => keepButton.current?.focus());
      return;
    }
    setWatchlisted(coinId, false);
  }

  function remove(deleteHolding: boolean) {
    setWatchlisted(coinId, false, deleteHolding);
    setConfirming(false);
  }

  return (
    <>
      <button
        type="button"
        className={`watch-button${saved ? " is-saved" : ""}`}
        aria-pressed={saved}
        onClick={toggle}
      >
        <span aria-hidden="true">{saved ? "★" : "☆"}</span>
        {saved ? "Watching" : "Watch"}
      </button>
      {confirming ? (
        <div className="dialog-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`remove-${coinId}`}
          >
            <p className="eyebrow">Saved holding</p>
            <h2 id={`remove-${coinId}`}>
              Remove {coinName} from the watchlist?
            </h2>
            <p>
              Your holding can stay in the portfolio even when the coin is no
              longer watched.
            </p>
            <div className="button-row">
              <button
                ref={keepButton}
                className="button button--primary"
                type="button"
                onClick={() => remove(false)}
              >
                Keep holding
              </button>
              <button
                className="button button--danger"
                type="button"
                onClick={() => remove(true)}
              >
                Delete holding
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
