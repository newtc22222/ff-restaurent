import {
  QueryClient,
  type QueryClientConfig,
  QueryClientProvider,
} from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';

const queryConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
};

/**
 * Tracks whichever `QueryProvider` is currently mounted, so route actions
 * (which run outside the React tree, e.g. catalog writes in
 * `features/catalog/catalog.routes.ts`) can invalidate its cache. Each
 * `QueryProvider` still gets its own `QueryClient` instance — tests that
 * mount several independent providers stay isolated from each other, unlike
 * a shared module-level singleton would leave them.
 */
let activeQueryClient: QueryClient | null = null;

export const getActiveQueryClient = () => activeQueryClient;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient(queryConfig));
  useEffect(() => {
    activeQueryClient = client;
    return () => {
      if (activeQueryClient === client) activeQueryClient = null;
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
