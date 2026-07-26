// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { canRequestPushPermission } from './push';

describe('push permission policy', () => {
  it('requires both service worker and Notification API support', () => {
    expect(canRequestPushPermission(true, true)).toBe(true);
    expect(canRequestPushPermission(false, true)).toBe(false);
    expect(canRequestPushPermission(true, false)).toBe(false);
  });
});
