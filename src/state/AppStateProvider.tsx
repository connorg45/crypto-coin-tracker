import {
  EMPTY_APP_STATE,
  loadAppState,
  saveAppState,
  updateHolding,
  updateWatchlist,
  type AppStateV2,
} from "@/domain/storage";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AppStateContextValue = {
  state: AppStateV2;
  migrationNotice: string | null;
  dismissMigrationNotice: () => void;
  setWatchlisted: (
    coinId: string,
    saved: boolean,
    deleteHolding?: boolean,
  ) => void;
  setHolding: (coinId: string, amount: number | null) => void;
  clearState: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function initialState(): { state: AppStateV2; migrationNotice: string | null } {
  if (typeof window === "undefined")
    return { state: EMPTY_APP_STATE, migrationNotice: null };
  const loaded = loadAppState(window.localStorage);
  return {
    state: loaded.state,
    migrationNotice: loaded.discardedNumericLegacy
      ? "An older rank-based watchlist could not be mapped safely to coin identities and was discarded. Current holdings and coin-ID entries were preserved."
      : loaded.migrated
        ? "Your saved watchlist and holdings were migrated to the current storage format."
        : null,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(initialState);
  const [state, setState] = useState(initial.state);
  const [migrationNotice, setMigrationNotice] = useState(
    initial.migrationNotice,
  );

  const persist = useCallback((next: AppStateV2) => {
    let saved = next;
    try {
      saved = saveAppState(window.localStorage, next);
    } catch {
      // The UI remains usable in memory when private mode or quota blocks storage.
    }
    setState(saved);
  }, []);

  const setWatchlisted = useCallback(
    (coinId: string, saved: boolean, deleteHolding = false) => {
      let next = updateWatchlist(state, coinId, saved);
      if (!saved && deleteHolding) next = updateHolding(next, coinId, null);
      persist(next);
    },
    [persist, state],
  );

  const setHolding = useCallback(
    (coinId: string, amount: number | null) =>
      persist(updateHolding(state, coinId, amount)),
    [persist, state],
  );

  const clearState = useCallback(() => persist(EMPTY_APP_STATE), [persist]);

  const value = useMemo(
    () => ({
      state,
      migrationNotice,
      dismissMigrationNotice: () => setMigrationNotice(null),
      setWatchlisted,
      setHolding,
      clearState,
    }),
    [clearState, migrationNotice, setHolding, setWatchlisted, state],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context)
    throw new Error("useAppState must be used inside AppStateProvider");
  return context;
}
