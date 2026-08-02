// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/api/client';
import type { Notification } from '@/api/types';
import { QueryProvider, getActiveQueryClient } from '@/app/providers/query';

import { notificationQueryKeys } from './notification.queries';
import { notificationIntents } from './notification.routes';

const notification = (
  id: string,
  readAt: string | null = null,
): Notification => ({
  id,
  message: id,
  readAt,
  createdAt: '2026-08-02T10:00:00.000Z',
});

const context = (request: ReturnType<typeof vi.fn>, intent: string) => ({
  api: { request } as unknown as ApiClient,
  body: { intent, notificationId: 'notification-1' },
  params: {},
});

beforeEach(() => {
  render(
    <QueryProvider>
      <div />
    </QueryProvider>,
  );
});

describe('notification intents', () => {
  it('updates a read notification in the cached inbox', async () => {
    const client = getActiveQueryClient();
    expect(client).not.toBeNull();
    const queryKey = notificationQueryKeys.list('user-1');
    client?.setQueryData(queryKey, [
      notification('notification-1'),
      notification('notification-2'),
    ]);
    const updated = notification('notification-1', '2026-08-02T10:01:00.000Z');
    const request = vi.fn().mockResolvedValue(updated);

    await notificationIntents['read-notification'](
      context(request, 'read-notification'),
    );

    expect(client?.getQueryData<Notification[]>(queryKey)).toEqual([
      updated,
      notification('notification-2'),
    ]);
  });

  it('updates every unread notification after mark-all-read', async () => {
    const client = getActiveQueryClient();
    expect(client).not.toBeNull();
    const queryKey = notificationQueryKeys.list('user-1');
    const alreadyRead = notification(
      'notification-2',
      '2026-08-02T09:00:00.000Z',
    );
    client?.setQueryData(queryKey, [
      notification('notification-1'),
      alreadyRead,
    ]);
    const request = vi.fn().mockResolvedValue({
      updated: 1,
      readAt: '2026-08-02T10:01:00.000Z',
    });

    await notificationIntents['read-all-notifications'](
      context(request, 'read-all-notifications'),
    );

    expect(client?.getQueryData<Notification[]>(queryKey)).toEqual([
      notification('notification-1', '2026-08-02T10:01:00.000Z'),
      alreadyRead,
    ]);
  });

  it('keeps the authoritative snapshot when a mutation fails', async () => {
    const client = getActiveQueryClient();
    expect(client).not.toBeNull();
    const queryKey = notificationQueryKeys.list('user-1');
    const initial = [notification('notification-1')];
    client?.setQueryData(queryKey, initial);
    const request = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(
      notificationIntents['read-notification'](
        context(request, 'read-notification'),
      ),
    ).rejects.toThrow('offline');
    expect(client?.getQueryData(queryKey)).toEqual(initial);
  });
});
