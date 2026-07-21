import { App } from "@/App";
import { PriceChart } from "@/components/PriceChart";
import { MarketTable } from "@/components/MarketTable";
import { AppStateProvider } from "@/state/AppStateProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { marketCoins } from "../fixtures";

function renderApp(route = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AppStateProvider>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </AppStateProvider>
    </QueryClientProvider>,
  );
}

describe("local-state and control edge cases", () => {
  it("opens mobile navigation and dismisses a migration notice", async () => {
    localStorage.setItem("watchListCoinIds", '["bitcoin"]');
    const user = userEvent.setup();
    renderApp("/watchlist");
    const menu = screen.getByRole("button", { name: "Menu" });
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await user.click(
      screen.getByRole("button", { name: "Dismiss migration notice" }),
    );
    expect(
      screen.queryByText(/migrated to the current/),
    ).not.toBeInTheDocument();
  });

  it("validates, saves, and removes a holding", async () => {
    localStorage.setItem(
      "lct:state",
      JSON.stringify({ version: 2, watchlist: ["bitcoin"], holdings: {} }),
    );
    const user = userEvent.setup();
    renderApp("/watchlist");
    const input = await screen.findByLabelText("Amount of Bitcoin owned");
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText(/Enter a number greater than 0/),
    ).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Holding removed")).toBeInTheDocument();
  });

  it("can cancel an unwatch decision", async () => {
    localStorage.setItem(
      "lct:state",
      JSON.stringify({
        version: 2,
        watchlist: ["bitcoin"],
        holdings: { bitcoin: 1 },
      }),
    );
    const user = userEvent.setup();
    renderApp("/watchlist");
    await user.click(await screen.findByRole("button", { name: /Watching/ }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("lct:state")!).watchlist).toEqual([
      "bitcoin",
    ]);
  });

  it("supports canceling and confirming position removal", async () => {
    localStorage.setItem(
      "lct:state",
      JSON.stringify({
        version: 2,
        watchlist: ["bitcoin"],
        holdings: { bitcoin: 1 },
      }),
    );
    const user = userEvent.setup();
    renderApp("/portfolio");
    await screen.findByText("Bitcoin · 100.0%");
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(screen.getByText("Bitcoin · 100.0%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(
      await screen.findByRole("heading", {
        name: "Add a hypothetical holding",
      }),
    ).toBeInTheDocument();
  });

  it("supports canceling and confirming full local-state clearing", async () => {
    localStorage.setItem(
      "lct:state",
      JSON.stringify({
        version: 2,
        watchlist: ["bitcoin"],
        holdings: { bitcoin: 1 },
      }),
    );
    const user = userEvent.setup();
    renderApp("/portfolio");
    const clear = await screen.findByRole("button", {
      name: "Clear local data",
    });
    await user.click(clear);
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    await user.click(clear);
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Clear data",
      }),
    );
    expect(JSON.parse(localStorage.getItem("lct:state")!)).toEqual({
      version: 2,
      watchlist: [],
      holdings: {},
    });
  });

  it("renders a useful empty chart summary", () => {
    render(<PriceChart points={[]} coinName="Bitcoin" />);
    expect(screen.getByText(/Not enough chart data/)).toBeInTheDocument();
  });

  it("labels flat, unavailable, and missing sparkline trends without color alone", () => {
    const coin = {
      ...marketCoins[0]!,
      change24h: 0,
      change7d: null,
      sparkline7d: [],
    };
    render(
      <AppStateProvider>
        <MemoryRouter>
          <MarketTable coins={[coin]} />
        </MemoryRouter>
      </AppStateProvider>,
    );
    expect(screen.getByText("Flat")).toHaveClass("sr-only");
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(2);
  });
});
