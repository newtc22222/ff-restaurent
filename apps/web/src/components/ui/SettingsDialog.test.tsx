// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccentProvider } from '@/app/providers/accent';
import { I18nProvider } from '@/app/providers/i18n';
import { ThemeProvider } from '@/app/providers/theme';

import SettingsDialog from './SettingsDialog';

// ThemeProvider resolves the system theme through matchMedia, which jsdom lacks.
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.accent;
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderSettings = (onClose = () => undefined) => {
  localStorage.setItem('ff-locale', 'en');
  return render(
    <I18nProvider>
      <ThemeProvider>
        <AccentProvider>
          <SettingsDialog open onClose={onClose} />
        </AccentProvider>
      </ThemeProvider>
    </I18nProvider>,
  );
};

describe('SettingsDialog', () => {
  it('renders as a labelled dialog holding all three display preferences', () => {
    renderSettings();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Language: English' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Theme: System' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Accent: Saffron' }),
    ).toBeTruthy();
  });

  it('applies an accent chosen inside the dialog', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Accent: Saffron' }));
    fireEvent.click(screen.getByRole('option', { name: 'Basil' }));

    expect(localStorage.getItem('ff-accent')).toBe('basil');
    expect(document.documentElement.dataset.accent).toBe('basil');
  });

  it('applies a locale chosen inside the dialog', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }));
    fireEvent.click(screen.getByRole('option', { name: 'Vietnamese' }));

    expect(screen.getByRole('heading', { name: 'Cài đặt' })).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderSettings(onClose);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
