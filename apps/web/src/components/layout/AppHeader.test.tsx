// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppHeader from './AppHeader';

vi.mock('../../app/providers/app-context', () => ({
  useAppContext: () => ({
    user: {
      id: 'user-1',
      username: 'member',
      name: 'Member',
      chefRole: null,
      systemRole: null,
      roles: ['CUSTOMER'],
      paymentRemindersEnabled: true,
    },
    logout: vi.fn(),
  }),
}));

vi.mock('../../app/providers/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) =>
      ({
        'nav.notifications': 'Notifications',
        'notifications.markAllRead': 'Mark all read',
        'auth.cancel': 'Cancel',
      })[key] ?? key,
  }),
}));

vi.mock('../../app/providers/theme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

afterEach(cleanup);

describe('AppHeader notification controls', () => {
  it('offers a bulk read action when unread notifications exist', () => {
    const markAllRead = vi.fn();
    render(
      <AppHeader
        notifications={[
          {
            id: 'notification-1',
            message: 'Pay the bill',
            createdAt: '2026-07-15T10:00:00.000Z',
          },
        ]}
        onOpenNotification={vi.fn()}
        onMarkAllNotificationsRead={markAllRead}
      />,
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Notifications' })[0],
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(markAllRead).toHaveBeenCalledOnce();
  });
});
