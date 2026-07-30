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

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(queryConfig));
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
