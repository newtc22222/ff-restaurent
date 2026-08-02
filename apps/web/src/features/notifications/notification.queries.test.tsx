// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '@/api/types';

import {
  notificationQueryKeys,
  useNotificationStream,
  useNotifications,
} from './notification.queries';

const { connectNotificationStream, request } = vi.hoisted(() => ({
  connectNotificationStream: vi.fn(),
  request: vi.fn(),
}));

vi.mock('./notification-stream', () => ({ connectNotificationStream }));
vi.mock('@/lib/session', () => ({
  session: {
    api: () => ({ request }),
    getToken: () => 'jwt-token',
  },
}));

const notification = (
  id: string,
  readAt: string | null = null,
): Notification => ({
  id,
  message: id,
  readAt,
  createdAt: '2026-08-02T10:00:00.000Z',
});

const createWrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

beforeEach(() => {
  connectNotificationStream.mockReset();
  request.mockReset();
});

describe('notification queries', () => {
  it('seeds the feature cache from authoritative route-loader data', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const initial = [notification('notification-1')];
    request.mockResolvedValue(initial);

    const { result } = renderHook(() => useNotifications('user-1', initial), {
      wrapper: createWrapper(client),
    });

    expect(result.current.data).toEqual(initial);
    expect(client.getQueryData(notificationQueryKeys.list('user-1'))).toEqual(
      initial,
    );
  });

  it('refetches on connection and invalidates on notification events', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    connectNotificationStream.mockImplementation(
      async ({ onConnected, onNotification }) => {
        await onConnected();
        await onNotification({
          notificationId: 'notification-1',
          cursor: 'cursor-1',
        });
      },
    );

    renderHook(() => useNotificationStream('user-1'), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(invalidate).toHaveBeenNthCalledWith(1, {
      queryKey: notificationQueryKeys.list('user-1'),
      refetchType: 'active',
    });
  });
});
