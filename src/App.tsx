import { AppLayout } from "@/components/AppLayout";
import { LoadingPanel } from "@/components/StatusBanner";
import { MarketPage } from "@/pages/MarketPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

const CoinDetailPage = lazy(() =>
  import("@/pages/CoinDetailPage").then((module) => ({
    default: module.CoinDetailPage,
  })),
);
const PortfolioPage = lazy(() =>
  import("@/pages/PortfolioPage").then((module) => ({
    default: module.PortfolioPage,
  })),
);
const WatchlistPage = lazy(() =>
  import("@/pages/WatchlistPage").then((module) => ({
    default: module.WatchlistPage,
  })),
);

function DeferredRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingPanel label="Loading view" />}>
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<MarketPage />} />
        <Route
          path="coin/:id"
          element={
            <DeferredRoute>
              <CoinDetailPage />
            </DeferredRoute>
          }
        />
        <Route
          path="watchlist"
          element={
            <DeferredRoute>
              <WatchlistPage />
            </DeferredRoute>
          }
        />
        <Route
          path="portfolio"
          element={
            <DeferredRoute>
              <PortfolioPage />
            </DeferredRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
