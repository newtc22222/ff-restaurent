// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';
import { QueryProvider } from '@/app/providers/query';

import ProfilePage from './ProfilePage';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('@/app/providers/app-context', () => ({
  useAppContext: () => ({
    user: {
      id: 'user-1',
      name: 'Phone Member',
      username: 'phone-member',
      phone: '+84901234567',
      chefRole: null,
      roles: ['CUSTOMER'],
      paymentRemindersEnabled: true,
    },
  }),
}));

vi.mock('@/hooks/useRouteMutation', () => ({
  useRouteMutation: () => ({ mutate }),
}));

const { requestPushToken } = vi.hoisted(() => ({
  requestPushToken: vi.fn(),
}));

vi.mock('@/lib/push', () => ({ requestPushToken }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  mutate.mockClear();
  requestPushToken.mockReset();
});

afterEach(cleanup);

describe('ProfilePage account forms', () => {
  it('keeps invalid phones inline and submits an explicit null when cleared', () => {
    render(
      <QueryProvider>
        <I18nProvider>
          <ProfilePage />
        </I18nProvider>
      </QueryProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    const phone = screen.getByLabelText('Phone number');
    fireEvent.change(phone, { target: { value: '+12025550123' } });
    expect(screen.getByRole('alert').textContent).toContain(
      'valid Vietnamese mobile number',
    );
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.change(phone, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        intent: 'update-profile',
        payload: {
          name: 'Phone Member',
          username: 'phone-member',
          phone: null,
        },
      },
      expect.objectContaining({
        fallback: 'Could not update the profile.',
        success: 'Profile updated.',
      }),
    );
  });

  it('validates password changes inline and submits a valid change', () => {
    render(
      <QueryProvider>
        <I18nProvider>
          <ProfilePage />
        </I18nProvider>
      </QueryProvider>,
    );

    const current = screen.getByLabelText('Current password');
    const next = screen.getByLabelText('New password');
    const confirmation = screen.getByLabelText('Confirm new password');
    const submit = screen.getByRole('button', { name: 'Change password' });

    fireEvent.change(current, { target: { value: 'password123' } });
    fireEvent.change(next, { target: { value: 'short' } });
    expect(screen.getByText(/between 8 and 128/)).toBeTruthy();

    fireEvent.change(next, { target: { value: 'password123' } });
    expect(screen.getByText(/differ from your current/)).toBeTruthy();

    fireEvent.change(next, { target: { value: 'new-password-123' } });
    fireEvent.change(confirmation, { target: { value: 'different' } });
    expect(screen.getByText(/confirmation does not match/)).toBeTruthy();
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(confirmation, {
      target: { value: 'new-password-123' },
    });
    fireEvent.click(submit);
    expect(mutate).toHaveBeenCalledWith(
      {
        intent: 'change-password',
        payload: {
          currentPassword: 'password123',
          newPassword: 'new-password-123',
          confirmation: 'new-password-123',
        },
      },
      expect.objectContaining({
        fallback: 'Could not change the password.',
        success: 'Password changed and other sessions were signed out.',
      }),
    );
  });

  it('updates payment reminder preferences from the profile', () => {
    render(
      <QueryProvider>
        <I18nProvider>
          <ProfilePage />
        </I18nProvider>
      </QueryProvider>,
    );

    const reminders = screen.getByRole('checkbox', {
      name: 'Receive payment reminders',
    });
    expect((reminders as HTMLInputElement).checked).toBe(true);
    fireEvent.click(reminders);
    expect(mutate).toHaveBeenCalledWith(
      {
        intent: 'notification-preferences',
        payload: { paymentRemindersEnabled: false },
      },
      expect.objectContaining({
        success: 'Notification preferences updated.',
      }),
    );
  });

  it('subscribes to push notifications when permission and a token are granted', async () => {
    requestPushToken.mockResolvedValue('fcm-token-abc');
    render(
      <QueryProvider>
        <I18nProvider>
          <ProfilePage />
        </I18nProvider>
      </QueryProvider>,
    );

    const pushToggle = screen.getByRole('checkbox', {
      name: 'Push notifications',
    });
    fireEvent.click(pushToggle);

    await vi.waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        {
          intent: 'push-subscribe',
          payload: { fcmToken: 'fcm-token-abc' },
        },
        expect.objectContaining({
          success: 'Push notifications enabled.',
        }),
      );
    });
  });

  it('shows an error toast when push permission is denied', async () => {
    requestPushToken.mockResolvedValue(null);
    render(
      <QueryProvider>
        <I18nProvider>
          <ProfilePage />
        </I18nProvider>
      </QueryProvider>,
    );

    const pushToggle = screen.getByRole('checkbox', {
      name: 'Push notifications',
    });
    fireEvent.click(pushToggle);

    await vi.waitFor(() => {
      expect(mutate).not.toHaveBeenCalled();
    });
  });
});
