import type { FreshnessMeta } from "@shared/contracts";

export function StatusBanner({ meta }: { meta: FreshnessMeta }) {
  if (meta.freshness === "fresh") return null;
  return (
    <aside
      className="status-banner"
      role="status"
      aria-live="polite"
      data-testid="stale-banner"
    >
      <strong>Showing saved data.</strong> The provider is temporarily
      unavailable; this snapshot is from{" "}
      <time dateTime={meta.fetchedAt}>
        {new Date(meta.fetchedAt).toLocaleString()}
      </time>
      .
    </aside>
  );
}

export function ErrorPanel({
  title = "Data unavailable",
  error,
  retry,
}: {
  title?: string;
  error: Error;
  retry: () => void;
}) {
  return (
    <section className="error-panel" role="alert">
      <p className="eyebrow">Connection state</p>
      <h2>{title}</h2>
      <p>{error.message}</p>
      <button className="button button--primary" type="button" onClick={retry}>
        Retry
      </button>
    </section>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true" />
      {label}
    </div>
  );
}
