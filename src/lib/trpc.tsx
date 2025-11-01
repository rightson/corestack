import React from 'react';
import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';
import superjson from 'superjson';
import type { QueryClient } from '@tanstack/react-query';

export const trpc = createTRPCReact<AppRouter>();

interface TRPCProviderProps {
  children: React.ReactNode;
  queryClient: QueryClient;
}

export function TRPCProvider({ children, queryClient }: TRPCProviderProps) {
  const [trpcClient] = React.useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // Add credentials for cookies/JWT
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: 'include',
            });
          },
        }),
      ],
      transformer: superjson,
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
