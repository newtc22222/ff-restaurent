// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '@/app/providers/query';

import { usePushSubscription } from './push-subscription.queries';

const { register, requestPushToken } = vi.hoisted(() => ({
  register: vi.fn(),
  requestPushToken: vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  pushSubscriptionEndpoints: { register, remove: vi.fn() },
}));

vi.mock('@/lib/push', () => ({ requestPushToken }));
vi.mock('@/lib/session', () => ({ session: { api: () => ({}) } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryProvider>{children}</QueryProvider>
);

beforeEach(() => {
  register.mockReset();
  requestPushToken.mockReset();
});

describe('usePushSubscription', () => {
  it('silently resolves and registers the current browser token', async () => {
    requestPushToken.mockResolvedValue({
      status: 'registered',
      token: 'current-browser-token',
    });
    register.mockResolvedValue({ id: 'current-browser-subscription' });

    const { result } = renderHook(() => usePushSubscription('en'), { wrapper });

    await waitFor(() => {
      expect(result.current.subscriptionId).toBe(
        'current-browser-subscription',
      );
    });
    expect(requestPushToken).toHaveBeenCalledWith({ prompt: false });
    expect(register).toHaveBeenCalledWith(expect.anything(), {
      fcmToken: 'current-browser-token',
      locale: 'en',
    });
  });

  it('silently no-ops when push is unavailable', async () => {
    requestPushToken.mockResolvedValue({ status: 'unavailable' });

    const { result } = renderHook(() => usePushSubscription('en'), { wrapper });

    await waitFor(() => expect(requestPushToken).toHaveBeenCalled());
    expect(result.current.subscriptionId).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });
});
