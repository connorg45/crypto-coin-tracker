import { App } from "@/App";
import { AppStateProvider } from "@/state/AppStateProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      gcTime: 15 * 60 * 1000,
    },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppStateProvider>
    </QueryClientProvider>
  </StrictMode>,
);
