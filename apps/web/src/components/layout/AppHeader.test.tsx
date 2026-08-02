// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AppHeader from './AppHeader';

vi.mock('@/app/providers/app-context', () => ({
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

vi.mock('@/app/providers/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) =>
      ({
        'nav.language': 'Language',
        'nav.menu': 'Menu',
        'language.english': 'English',
        'nav.theme': 'Theme',
        'theme.light': 'Light',
        'theme.accent': 'Accent',
        'theme.accentSaffron': 'Saffron',
        'nav.notifications': 'Notifications',
        'notifications.markAllRead': 'Mark all read',
        'auth.cancel': 'Cancel',
      })[key] ?? key,
  }),
}));

vi.mock('@/app/providers/theme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

vi.mock('@/app/providers/accent', () => ({
  useAccent: () => ({ accent: 'saffron', setAccent: vi.fn() }),
}));

afterEach(cleanup);

describe('AppHeader notification controls', () => {
  it('places notifications after the theme control in the desktop actions', () => {
    render(<AppHeader onOpenNotification={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    const localeIndex = buttons.findIndex((button) =>
      button.getAttribute('aria-label')?.startsWith('Language:'),
    );
    const themeIndex = buttons.findIndex((button) =>
      button.getAttribute('aria-label')?.startsWith('Theme:'),
    );
    const accentIndex = buttons.findIndex((button) =>
      button.getAttribute('aria-label')?.startsWith('Accent:'),
    );
    const notificationIndex = buttons.findIndex(
      (button) => button.getAttribute('aria-label') === 'Notifications',
    );

    expect(localeIndex).toBeGreaterThanOrEqual(0);
    expect(themeIndex).toBeGreaterThan(localeIndex);
    expect(accentIndex).toBeGreaterThan(themeIndex);
    expect(notificationIndex).toBeGreaterThan(accentIndex);
  });

  it('places notifications below the theme control in the mobile menu', () => {
    render(<AppHeader onOpenNotification={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /navigation/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const themeButtons = screen.getAllByRole('button', { name: /Theme:/ });
    const notificationButtons = screen.getAllByRole('button', {
      name: 'Notifications',
    });
    const mobileTheme = themeButtons.at(-1);
    const mobileNotification = notificationButtons.at(-1);

    expect(mobileTheme).toBeDefined();
    expect(mobileNotification).toBeDefined();
    expect(
      mobileTheme!.compareDocumentPosition(mobileNotification!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

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

    fireEvent.click(screen.getByTestId('notification-backdrop'));
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
  });
});
