// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
  cacheStrategyFor,
  openNotificationTarget,
  parsePushPayload,
} from '../../public/sw.js';

const origin = 'https://ff.example.test';
const request = (overrides = {}) => ({
  method: 'GET',
  url: `${origin}/assets/app.js`,
  mode: 'cors',
  destination: 'script',
  ...overrides,
});

describe('service worker cache policy', () => {
  it('caches only same-origin navigation and static assets', () => {
    expect(cacheStrategyFor(request(), origin)).toBe('static');
    expect(
      cacheStrategyFor(
        request({
          url: `${origin}/collections`,
          mode: 'navigate',
          destination: '',
        }),
        origin,
      ),
    ).toBe('navigation');
  });

  it('leaves API, mutations, and cross-origin traffic network-only', () => {
    expect(
      cacheStrategyFor(
        request({ url: `${origin}/bills`, destination: '' }),
        origin,
      ),
    ).toBe('network-only');
    expect(cacheStrategyFor(request({ method: 'POST' }), origin)).toBe(
      'network-only',
    );
    expect(
      cacheStrategyFor(
        request({ url: 'https://api.example.test/bills', destination: '' }),
        origin,
      ),
    ).toBe('network-only');
  });
});

describe('push payload parsing', () => {
  it('extracts title, body, and target url from a JSON push payload', () => {
    const event = {
      data: {
        json: () => ({
          title: 'Payment reminder',
          body: 'You owe 50,000 VND',
          url: '/bills/abc',
        }),
      },
    };
    expect(parsePushPayload(event)).toEqual({
      title: 'Payment reminder',
      body: 'You owe 50,000 VND',
      url: '/bills/abc',
    });
  });

  it('extracts the notification and target from an FCM message envelope', () => {
    const event = {
      data: {
        json: () => ({
          notification: {
            title: 'Payment reminder',
            body: 'Open FF RESTaurent to review your bill.',
          },
          data: { url: '/bills/abc' },
        }),
      },
    };

    expect(parsePushPayload(event)).toEqual({
      title: 'Payment reminder',
      body: 'Open FF RESTaurent to review your bill.',
      url: '/bills/abc',
    });
  });

  it('rejects external notification targets', () => {
    const event = {
      data: {
        json: () => ({
          title: 'Payment reminder',
          url: 'https://attacker.example/bills/abc',
        }),
      },
    };

    expect(parsePushPayload(event)).toEqual({
      title: 'Payment reminder',
      body: '',
      url: '/',
    });
  });

  it('falls back to defaults when the payload is missing or malformed', () => {
    expect(parsePushPayload({ data: null })).toEqual({
      title: 'FF RESTaurent',
      body: '',
      url: '/',
    });
    expect(
      parsePushPayload({
        data: {
          json: () => {
            throw new Error('bad json');
          },
        },
      }),
    ).toEqual({ title: 'FF RESTaurent', body: '', url: '/' });
  });
});

describe('notification click target', () => {
  it('navigates and focuses the focused app window', async () => {
    const visibleClient = {
      focused: false,
      visibilityState: 'visible',
      navigate: vi.fn(),
      focus: vi.fn(),
    };
    const navigatedClient = { focus: vi.fn().mockResolvedValue(undefined) };
    const focusedClient = {
      focused: true,
      visibilityState: 'hidden',
      navigate: vi.fn().mockResolvedValue(navigatedClient),
      focus: vi.fn(),
    };
    const clientManager = {
      matchAll: vi.fn().mockResolvedValue([visibleClient, focusedClient]),
      openWindow: vi.fn(),
    };

    await openNotificationTarget('/bills/abc', clientManager);

    expect(focusedClient.navigate).toHaveBeenCalledWith('/bills/abc');
    expect(navigatedClient.focus).toHaveBeenCalledOnce();
    expect(visibleClient.navigate).not.toHaveBeenCalled();
    expect(clientManager.openWindow).not.toHaveBeenCalled();
  });

  it('navigates an existing target again to reload it', async () => {
    const client = {
      focused: false,
      visibilityState: 'visible',
      url: `${origin}/bills/abc`,
      navigate: vi.fn(),
      focus: vi.fn().mockResolvedValue(undefined),
    };
    client.navigate.mockResolvedValue(client);
    const clientManager = {
      matchAll: vi.fn().mockResolvedValue([client]),
      openWindow: vi.fn(),
    };

    await openNotificationTarget('/bills/abc', clientManager);

    expect(client.navigate).toHaveBeenCalledWith('/bills/abc');
    expect(client.focus).toHaveBeenCalledOnce();
    expect(clientManager.openWindow).not.toHaveBeenCalled();
  });

  it('opens the target when no app window exists', async () => {
    const clientManager = {
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(undefined),
    };

    await openNotificationTarget('/bills/abc', clientManager);

    expect(clientManager.openWindow).toHaveBeenCalledWith('/bills/abc');
  });

  it('focuses the existing window when navigation returns no client', async () => {
    const client = {
      focused: true,
      visibilityState: 'visible',
      navigate: vi.fn().mockResolvedValue(null),
      focus: vi.fn().mockResolvedValue(undefined),
    };
    const clientManager = {
      matchAll: vi.fn().mockResolvedValue([client]),
      openWindow: vi.fn(),
    };

    await openNotificationTarget('/bills/abc', clientManager);

    expect(client.focus).toHaveBeenCalledOnce();
    expect(clientManager.openWindow).not.toHaveBeenCalled();
  });
});
