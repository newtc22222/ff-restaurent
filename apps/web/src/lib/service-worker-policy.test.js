// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { cacheStrategyFor } from '../../public/sw.js';

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
