import { App } from "@/App";
import { AppStateProvider } from "@/state/AppStateProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { envelope, marketCoins, staleMeta } from "../fixtures";
import { server } from "../testServer";

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

describe("application workflow and states", () => {
  it("renders validated market and isolated sentiment data", async () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: "Market overview" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /Bitcoin/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fear & Greed Index" }),
    ).toBeInTheDocument();
    expect(screen.getByText("+2.40%")).toBeInTheDocument();
    expect(screen.getByText("-1.20%")).toBeInTheDocument();
  });

  it("shows timestamped stale availability and isolated sentiment failure", async () => {
    server.use(
      http.get("/api/markets", () =>
        HttpResponse.json(envelope(marketCoins, staleMeta)),
      ),
      http.get("/api/sentiment", () =>
        HttpResponse.json(
          {
            error: {
              code: "UPSTREAM_UNAVAILABLE",
              message: "Unavailable.",
              retryable: true,
              requestId: "x",
            },
          },
          { status: 502 },
        ),
      ),
    );
    renderApp();
    expect(await screen.findByTestId("stale-banner")).toHaveTextContent(
      "Showing saved data",
    );
    expect(
      await screen.findByRole("heading", { name: "Sentiment unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bitcoin/ })).toBeInTheDocument();
  });

  it("completes market to detail to watchlist to portfolio", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(
      (await screen.findAllByRole("button", { name: /Watch$/ }))[0]!,
    );
    expect(screen.getByRole("button", { name: /Watching/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("link", { name: /Bitcoin/ }));
    expect(
      await screen.findByRole("heading", { name: "Bitcoin", level: 1 }),
    ).toBeInTheDocument();
    const range30 = screen.getByRole("button", { name: "30D" });
    await user.click(range30);
    expect(range30).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByRole("img", { name: /Bitcoin historical price/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Watchlist" }));
    const input = await screen.findByLabelText("Amount of Bitcoin owned");
    await user.type(input, "0.5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Saved: 0.5")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Portfolio" }));
    expect(await screen.findAllByText("$32,000.00")).toHaveLength(2);
    expect(screen.getByText("Bitcoin · 100.0%")).toBeInTheDocument();
  });

  it("retains a holding by default when removing a watched coin", async () => {
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
    const dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Keep holding" }),
    );
    expect(JSON.parse(localStorage.getItem("lct:state")!)).toEqual({
      version: 2,
      watchlist: [],
      holdings: { bitcoin: 1 },
    });
  });

  it("can explicitly delete a holding when unwatching", async () => {
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
    await user.click(screen.getByRole("button", { name: "Delete holding" }));
    expect(JSON.parse(localStorage.getItem("lct:state")!)).toEqual({
      version: 2,
      watchlist: [],
      holdings: {},
    });
  });

  it("announces legacy rank discard once", () => {
    localStorage.setItem("watchListArr", "[0,1]");
    renderApp("/watchlist");
    expect(screen.getByText(/rank-based watchlist/)).toBeInTheDocument();
    expect(localStorage.getItem("watchListArr")).toBeNull();
  });

  it("renders total failure and retries visibly", async () => {
    server.use(
      http.get("/api/markets", () =>
        HttpResponse.json(
          {
            error: {
              code: "UPSTREAM_TIMEOUT",
              message: "Provider timeout.",
              retryable: true,
              requestId: "timeout",
            },
          },
          { status: 504 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider timeout",
    );
    server.use(
      http.get("/api/markets", () => HttpResponse.json(envelope(marketCoins))),
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("link", { name: /Bitcoin/ }),
    ).toBeInTheDocument();
  });

  it("handles invalid and unknown routes", () => {
    const { unmount } = renderApp("/coin/INVALID ID");
    expect(
      screen.getByRole("heading", { name: "Coin not found" }),
    ).toBeInTheDocument();
    unmount();
    renderApp("/missing");
    expect(
      screen.getByRole("heading", { name: "That view does not exist" }),
    ).toBeInTheDocument();
  });
});
