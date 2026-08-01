// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { cacheStrategyFor, parsePushPayload } from '../../public/sw.js';

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
