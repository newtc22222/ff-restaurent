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
        'nav.settings': 'Settings',
        'nav.info': 'About this app',
        'settings.title': 'Settings',
        'info.title': 'About this app',
        'profile.title': 'Profile',
        'auth.signOut': 'Sign out',
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
  it('keeps display preferences out of the desktop actions row', () => {
    render(<AppHeader onOpenNotification={vi.fn()} />);

    const labels = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '');

    expect(labels.some((label) => label.startsWith('Language:'))).toBe(false);
    expect(labels.some((label) => label.startsWith('Theme:'))).toBe(false);
    expect(labels.some((label) => label.startsWith('Accent:'))).toBe(false);
    expect(labels).toContain('Notifications');
  });

  it('offers settings and info in the desktop user menu', () => {
    render(<AppHeader onOpenNotification={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Member, / }));

    const items = screen
      .getAllByRole('menuitem')
      .map((item) => item.textContent?.trim());

    expect(items).toEqual([
      'Profile',
      'Settings',
      'About this app',
      'Sign out',
    ]);
  });

  it('opens the settings dialog from the user menu', () => {
    render(<AppHeader onOpenNotification={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Member, / }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('returns focus to the desktop user trigger after closing settings', () => {
    render(<AppHeader onOpenNotification={vi.fn()} />);

    const userTrigger = screen.getByRole('button', { name: /Member, / });
    fireEvent.click(userTrigger);
    const settingsItem = screen.getByRole('menuitem', { name: 'Settings' });
    settingsItem.focus();
    fireEvent.click(settingsItem);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(userTrigger);
  });

  it('returns focus to the mobile menu trigger after closing info', () => {
    render(<AppHeader onOpenNotification={vi.fn()} />);

    const menuTrigger = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menuTrigger);
    const infoItem = screen
      .getAllByRole('button', { name: 'About this app' })
      .at(-1)!;
    infoItem.focus();
    fireEvent.click(infoItem);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(menuTrigger);
  });

  it('places notifications below settings and info in the mobile menu', () => {
    render(<AppHeader onOpenNotification={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /navigation/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const mobileSettings = screen
      .getAllByRole('button', { name: 'Settings' })
      .at(-1);
    const mobileNotification = screen
      .getAllByRole('button', { name: 'Notifications' })
      .at(-1);

    expect(mobileSettings).toBeDefined();
    expect(mobileNotification).toBeDefined();
    expect(
      mobileSettings!.compareDocumentPosition(mobileNotification!) &
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
