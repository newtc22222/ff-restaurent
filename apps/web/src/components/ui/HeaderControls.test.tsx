// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LocaleToggle from './LocaleToggle';
import ThemeToggle from './ThemeToggle';

describe('header selectors', () => {
  it('lets the user explicitly choose a language', () => {
    const setLocale = vi.fn();
    render(
      <LocaleToggle
        locale="en"
        setLocale={setLocale}
        label="Language"
        englishLabel="English"
        vietnameseLabel="Vietnamese"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }));
    expect(screen.getByRole('listbox', { name: 'Language' })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Vietnamese' }));
    expect(setLocale).toHaveBeenCalledWith('vi');
  });

  it('lets the user explicitly choose light, dark, or system theme', () => {
    const setTheme = vi.fn();
    render(
      <ThemeToggle
        theme="system"
        setTheme={setTheme}
        label="Theme"
        lightLabel="Light"
        darkLabel="Dark"
        systemLabel="System"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Theme: System' }));
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.click(screen.getByRole('option', { name: 'Dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
