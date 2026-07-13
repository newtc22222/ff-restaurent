// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { useFetcher } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/providers/i18n';
import { ThemeProvider } from '../app/providers/theme';
import LoginPage from './LoginPage';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useFetcher: vi.fn() };
});

beforeEach(() => {
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

describe('LoginPage', () => {
  it('shows and dismisses handled fetcher action errors inline', async () => {
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

    expect(await screen.findByText('Invalid credentials')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Phone / Username'), {
      target: { value: 'another-user' },
    });
    expect(screen.queryByText('Invalid credentials')).toBeNull();
  });
});
