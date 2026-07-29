// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    const day20 = screen.getByRole('button', { name: /20.*07.*2026/ });
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
});
