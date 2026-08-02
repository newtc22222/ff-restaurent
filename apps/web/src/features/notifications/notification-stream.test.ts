import { describe, expect, it, vi } from 'vitest';

import { connectNotificationStream } from './notification-stream';

const response = (body: string) => new Response(body, { status: 200 });

describe('connectNotificationStream', () => {
  it('authenticates, refetches on connection, and invalidates on events', async () => {
    const controller = new AbortController();
    const connected = vi.fn();
    const notification = vi.fn(() => controller.abort());
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(
          'event: ready\nid: cursor-1\ndata: {}\n\n' +
            'event: notification\nid: cursor-2\ndata: {"notificationId":"notification-1","cursor":"cursor-2"}\n\n',
        ),
      );

    await expect(
      connectNotificationStream(
        {
          token: 'jwt-token',
          signal: controller.signal,
          onConnected: connected,
          onNotification: notification,
        },
        { fetcher, wait: vi.fn() },
      ),
    ).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/\/notifications\/stream$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          Authorization: 'Bearer jwt-token',
        }),
      }),
    );
    expect(connected).toHaveBeenCalledTimes(1);
    expect(notification).toHaveBeenCalledWith({
      notificationId: 'notification-1',
      cursor: 'cursor-2',
    });
  });

  it('reconnects with the last creation cursor', async () => {
    const controller = new AbortController();
    const wait = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response('event: ready\nid: recovered-cursor\ndata: {}\n\n'),
      )
      .mockImplementationOnce(async (_url, init: RequestInit) => {
        expect(init.headers).toEqual(
          expect.objectContaining({ 'Last-Event-ID': 'recovered-cursor' }),
        );
        controller.abort();
        throw new DOMException('Aborted', 'AbortError');
      });

    await connectNotificationStream(
      {
        token: 'jwt-token',
        signal: controller.signal,
        onConnected: vi.fn(),
        onNotification: vi.fn(),
      },
      { fetcher, wait },
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1_000, controller.signal);
  });

  it('uses bounded exponential backoff and keeps failures silent', async () => {
    const controller = new AbortController();
    const delays: number[] = [];
    const wait = vi.fn(async (milliseconds: number) => {
      delays.push(milliseconds);
      if (delays.length === 6) controller.abort();
    });

    await expect(
      connectNotificationStream(
        {
          token: 'jwt-token',
          signal: controller.signal,
          onConnected: vi.fn(),
          onNotification: vi.fn(),
        },
        {
          fetcher: vi.fn().mockRejectedValue(new TypeError('offline')),
          wait,
        },
      ),
    ).resolves.toBeUndefined();

    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000]);
  });

  it('preserves exponential backoff across short-lived successful streams', async () => {
    const controller = new AbortController();
    const delays: number[] = [];
    const wait = vi.fn(async (milliseconds: number) => {
      delays.push(milliseconds);
      if (delays.length === 3) controller.abort();
    });

    await connectNotificationStream(
      {
        token: 'jwt-token',
        signal: controller.signal,
        onConnected: vi.fn(),
        onNotification: vi.fn(),
      },
      {
        fetcher: vi
          .fn()
          .mockResolvedValue(response('event: ready\ndata: {}\n\n')),
        wait,
      },
    );

    expect(delays).toEqual([1_000, 2_000, 4_000]);
  });

  it('resets reconnect backoff after a healthy stream lifetime', async () => {
    const controller = new AbortController();
    const delays: number[] = [];
    let connections = 0;
    let now = 0;

    await connectNotificationStream(
      {
        token: 'jwt-token',
        signal: controller.signal,
        onConnected: () => {
          connections += 1;
          if (connections === 2) now = 30_000;
        },
        onNotification: vi.fn(),
      },
      {
        fetcher: vi
          .fn()
          .mockResolvedValue(response('event: ready\ndata: {}\n\n')),
        wait: async (milliseconds) => {
          delays.push(milliseconds);
          if (delays.length === 2) controller.abort();
        },
        now: () => now,
      },
    );

    expect(delays).toEqual([1_000, 1_000]);
  });

  it('silently retains the snapshot when streaming is unsupported', async () => {
    await expect(
      connectNotificationStream(
        {
          token: 'jwt-token',
          signal: new AbortController().signal,
          onConnected: vi.fn(),
          onNotification: vi.fn(),
        },
        {
          fetcher: vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            body: null,
          }),
          wait: vi.fn(),
        },
      ),
    ).resolves.toBeUndefined();
  });
});
