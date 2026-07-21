import { useAppState } from "@/state/AppStateProvider";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Market", end: true },
  { to: "/watchlist", label: "Watchlist", end: false },
  { to: "/portfolio", label: "Portfolio", end: false },
];

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { migrationNotice, dismissMigrationNotice } = useAppState();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <NavLink
          className="brand"
          to="/"
          aria-label="Lizard Coin Tracker market home"
        >
          <span className="brand-mark" aria-hidden="true">
            L
          </span>
          <span>
            <strong>Lizard</strong>
            <small>Coin Tracker</small>
          </span>
        </NavLink>
        <button
          type="button"
          className="menu-button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={menuOpen ? "is-open" : ""}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {migrationNotice ? (
        <aside className="migration-notice" role="status">
          <p>{migrationNotice}</p>
          <button
            type="button"
            onClick={dismissMigrationNotice}
            aria-label="Dismiss migration notice"
          >
            Dismiss
          </button>
        </aside>
      ) : null}
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <p>
          Market data:{" "}
          <a
            href="https://www.coingecko.com/"
            rel="noopener noreferrer"
            target="_blank"
          >
            CoinGecko
          </a>
          . Sentiment data:{" "}
          <a
            href="https://alternative.me/crypto/fear-and-greed-index/"
            rel="noopener noreferrer"
            target="_blank"
          >
            Alternative.me
          </a>
          .
        </p>
        <p>
          A 2023 team project by Connor, Larissa, and Ali; productionized by
          Connor in 2026. Local hypothetical portfolio only—not trading or
          financial advice.
        </p>
      </footer>
    </div>
  );
}
