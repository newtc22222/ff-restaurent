import {
  QueryClient,
  type QueryClientConfig,
  QueryClientProvider,
} from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

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
 * A module-level singleton so route actions (which run outside the React
 * tree) can invalidate query data after a mutation, e.g. catalog writes in
 * `features/catalog/catalog.routes.ts`.
 */
export const queryClient = new QueryClient(queryConfig);

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => queryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
