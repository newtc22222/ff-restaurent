// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { canRegisterServiceWorker } from './pwa';

describe('PWA registration policy', () => {
  it('registers only in production when service workers are supported', () => {
    expect(canRegisterServiceWorker(true, true)).toBe(true);
    expect(canRegisterServiceWorker(false, true)).toBe(false);
    expect(canRegisterServiceWorker(true, false)).toBe(false);
  });
});
