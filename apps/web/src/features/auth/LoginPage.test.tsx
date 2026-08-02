// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useFetcher } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';
import { ThemeProvider } from '@/app/providers/theme';

import LoginPage from './LoginPage';

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: toastError, success: toastSuccess },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useFetcher: vi.fn() };
});

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(cleanup);

describe('LoginPage', () => {
  it('introduces the app in a footer that still exposes the locale control', () => {
    vi.mocked(useFetcher).mockReturnValue({
      state: 'idle',
      data: undefined,
      submit: vi.fn(),
    } as never);

    render(
      <ThemeProvider>
        <I18nProvider>
          <LoginPage />
        </I18nProvider>
      </ThemeProvider>,
    );

    // Display preferences now live in the authenticated Settings dialog; only
    // locale stays reachable before sign-in.
    expect(screen.queryByRole('button', { name: /Theme:/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Accent:/ })).toBeNull();

    const locale = screen.getByRole('button', { name: 'Language: English' });
    const footer = locale.closest('footer');
    expect(footer).toBeTruthy();
    expect(footer!.textContent).toContain('FF RESTaurent helps');
  });

  it('stacks demo roles on mobile and restores the desktop columns', () => {
    vi.mocked(useFetcher).mockReturnValue({
      state: 'idle',
      data: undefined,
      submit: vi.fn(),
    } as never);

    render(
      <ThemeProvider>
        <I18nProvider>
          <LoginPage />
        </I18nProvider>
      </ThemeProvider>,
    );

    const roles = screen.getByTestId('demo-role-grid');
    expect(roles.className).toContain('grid-cols-1');
    expect(roles.className).toContain('sm:grid-cols-3');
    for (const button of roles.querySelectorAll('button')) {
      expect(button.className).toContain('w-full');
      expect(button.className).toContain('whitespace-normal');
    }
  });

  it('shows handled fetcher action errors once as localized toasts', async () => {
    vi.mocked(useFetcher).mockReturnValue({
      state: 'idle',
      data: {
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        intent: 'login',
      },
      submit: vi.fn(),
    } as never);

    render(
      <ThemeProvider>
        <I18nProvider>
          <LoginPage />
        </I18nProvider>
      </ThemeProvider>,
    );

    expect(toastError).toHaveBeenCalledWith(
      'The username, phone number, or password is incorrect.',
      { id: 'auth-login-INVALID_CREDENTIALS' },
    );
    expect(screen.queryByText('Invalid credentials')).toBeNull();

    fireEvent.change(screen.getByLabelText('Phone / Username'), {
      target: { value: 'another-user' },
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('keeps invalid Vietnamese mobile numbers inline and blocks registration', () => {
    vi.mocked(useFetcher).mockReturnValue({
      state: 'idle',
      data: undefined,
      submit: vi.fn(),
    } as never);

    render(
      <ThemeProvider>
        <I18nProvider>
          <LoginPage />
        </I18nProvider>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '+12025550123' },
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'valid Vietnamese mobile number',
    );
    expect(
      (screen.getByRole('button', { name: 'Register' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('submits forgot-password requests without exposing account existence', () => {
    const submit = vi.fn();
    vi.mocked(useFetcher).mockReturnValue({
      state: 'idle',
      data: undefined,
      submit,
    } as never);

    render(
      <ThemeProvider>
        <I18nProvider>
          <LoginPage />
        </I18nProvider>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByLabelText('Phone / Username'), {
      target: { value: 'member-one' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Request password reset' }),
    );

    expect(submit).toHaveBeenCalledWith(
      { intent: 'forgot-request', identifier: 'member-one' },
      { method: 'post', encType: 'application/json' },
    );
    expect(screen.queryByText(/account exists/i)).toBeNull();
  });
});
