import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page-wrap">
      <section className="empty-panel">
        <p className="eyebrow">404</p>
        <h1>That view does not exist</h1>
        <p>Return to the market dashboard to continue.</p>
        <Link className="button button--primary" to="/">
          Open market
        </Link>
      </section>
    </div>
  );
}
