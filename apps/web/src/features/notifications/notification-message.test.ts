import { describe, expect, it } from 'vitest';

import type { Notification } from '@/api/types';

import {
  notificationMessage,
  notificationTarget,
} from './notification-message';

const notification = (values: Partial<Notification>): Notification => ({
  id: 'notification-1',
  message: 'Fallback message',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...values,
});

describe('structured notification presentation', () => {
  it('renders localized restaurant and collection events', () => {
    expect(
      notificationMessage(
        notification({
          category: 'RESTAURANT_CREATED',
          data: { actorName: 'An', restaurantName: 'Bếp Mới' },
        }),
        (key) =>
          ({
            'notifications.restaurantCreated':
              '{{actorName}} added {{restaurantName}}.',
          })[key] ?? key,
      ),
    ).toBe('An added Bếp Mới.');
  });

  it('falls back to the stored message for unknown or incomplete events', () => {
    expect(
      notificationMessage(
        notification({ category: 'MEAL_VOTE_CREATED' }),
        (key) => key,
      ),
    ).toBe('Fallback message');
  });

  it('only returns internal navigation targets', () => {
    expect(
      notificationTarget(
        notification({ targetUrl: '/collections/collection-1' }),
      ),
    ).toBe('/collections/collection-1');
    expect(
      notificationTarget(
        notification({ targetUrl: 'https://example.com/private' }),
      ),
    ).toBeNull();
  });
});
