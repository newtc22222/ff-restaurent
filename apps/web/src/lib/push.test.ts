// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { canRequestPushPermission, pushRegistrationState } from './push';

describe('push permission policy', () => {
  it('requires both service worker and Notification API support', () => {
    expect(canRequestPushPermission(true, true)).toBe(true);
    expect(canRequestPushPermission(false, true)).toBe(false);
    expect(canRequestPushPermission(true, false)).toBe(false);
  });

  it('silently skips unsupported and unconfigured clients', () => {
    expect(pushRegistrationState(false, true, true, 'default')).toBe(
      'unavailable',
    );
    expect(pushRegistrationState(true, true, false, 'default')).toBe(
      'unavailable',
    );
  });

  it('distinguishes denied permission from clients ready to register', () => {
    expect(pushRegistrationState(true, true, true, 'denied')).toBe('denied');
    expect(pushRegistrationState(true, true, true, 'granted')).toBe('ready');
    expect(pushRegistrationState(true, true, true, 'default')).toBe('prompt');
  });

  it('does not prompt during silent token synchronization', () => {
    expect(pushRegistrationState(true, true, true, 'default', false)).toBe(
      'unavailable',
    );
  });
});
