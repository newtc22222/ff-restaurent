// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DatePicker from './DatePicker';

afterEach(cleanup);

describe('DatePicker', () => {
  it('renders placeholder when value is empty and opens popover on click', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value=""
        onChange={onChange}
        placeholderText="Choose date..."
      />,
    );

    const button = screen.getByRole('button', { name: 'Choose date...' });
    expect(button).toBeTruthy();

    fireEvent.click(button);

    // Dialog popover should now be rendered
    const dialog = screen.getByRole('dialog', { name: 'Choose date...' });
    expect(dialog).toBeTruthy();
  });

  it('selects a date from the calendar grid', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-07-15"
        onChange={onChange}
        placeholderText="Choose date..."
      />,
    );

    const button = screen.getByRole('button', { name: /2026/ });
    expect(button).toBeTruthy();

    fireEvent.click(button);

    // Pick day 20
    const day20 = screen.getByRole('button', { name: /20.*7.*2026/ });
    fireEvent.click(day20);

    expect(onChange).toHaveBeenCalledWith('2026-07-20');
  });

  it('supports clear button when isClearable is true', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-07-15"
        onChange={onChange}
        isClearable
        placeholderText="Choose date..."
      />,
    );

    const clearButton = screen.getByRole('button', { name: 'Clear date' });
    expect(clearButton).toBeTruthy();

    fireEvent.click(clearButton);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('moves focus into the dialog, traps tab navigation, and restores focus on close', async () => {
    render(
      <DatePicker
        value="2026-07-15"
        onChange={vi.fn()}
        placeholderText="Choose date..."
      />,
    );

    const trigger = screen.getByRole('button', { name: /2026/ });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Choose date...' });
    const selectedDay = within(dialog).getByRole('button', {
      name: /15.*7.*2026/,
    });

    await waitFor(() => expect(document.activeElement).toBe(selectedDay));

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    );
    focusable[0].focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
