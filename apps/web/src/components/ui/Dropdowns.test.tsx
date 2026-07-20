// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dropdown, { type DropdownOption } from './Dropdown';

const options: DropdownOption[] = [
  { value: 'an', label: 'An Kitchen' },
  { value: 'pho', label: 'Pho House' },
  { value: 'rice', label: 'Rice Corner' },
];

afterEach(cleanup);

function SelectHarness() {
  const [value, setValue] = useState('');
  return (
    <Dropdown
      searchable
      allowClear
      emptyMessage="Nothing found"
      label="Restaurant"
      onChange={setValue}
      options={options}
      searchPlaceholder="Search restaurants"
      value={value}
    />
  );
}

function MultiSelectHarness() {
  const [values, setValues] = useState<string[]>([]);
  return (
    <Dropdown
      multiple
      searchable
      allowClear
      emptyMessage="Nobody found"
      label="Members"
      onChange={setValues}
      options={[
        { value: 'casey', label: 'Casey Nguyen' },
        { value: 'hana', label: 'Hana Tran' },
        { value: 'sam', label: 'Sam Le' },
      ]}
      searchPlaceholder="Search members"
      values={values}
      formatSelection={(selected) =>
        selected.length === 1
          ? (selected[0]?.label.split(' ')[0] ?? '')
          : `${selected.length} members`
      }
    />
  );
}

describe('searchable dropdowns', () => {
  it('sizes a header menu to its trigger without a minimum-width floor', async () => {
    const rect = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        if (
          this instanceof HTMLButtonElement &&
          this.getAttribute('aria-haspopup')
        ) {
          return {
            top: 20,
            left: 100,
            right: 220,
            bottom: 52,
            width: 120,
            height: 32,
            x: 100,
            y: 20,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          top: 0,
          left: 0,
          right: 2,
          bottom: 146,
          width: 2,
          height: 146,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    render(
      <Dropdown
        label="Language"
        ariaLabel="Language: English"
        value="en"
        variant="header"
        onChange={() => undefined}
        options={[
          { value: 'en', label: 'English' },
          { value: 'vi', label: 'Vietnamese' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }));
    await waitFor(() => {
      const menu = screen
        .getByRole('listbox')
        .closest('[data-placement]') as HTMLElement;
      expect(menu.style.width).toBe('120px');
      expect(menu.className).not.toContain('min-w-');
    });
    rect.mockRestore();
  });

  it('flips above the trigger when the viewport bottom cannot fit the menu', async () => {
    const rect = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        if (
          this instanceof HTMLButtonElement &&
          this.getAttribute('aria-haspopup')
        ) {
          return {
            top: 560,
            left: 20,
            right: 220,
            bottom: 600,
            width: 200,
            height: 40,
            x: 20,
            y: 560,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          top: 0,
          left: 20,
          right: 220,
          bottom: 180,
          width: 200,
          height: 180,
          x: 20,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });
    Object.defineProperty(window, 'innerHeight', {
      value: 640,
      configurable: true,
    });
    render(
      <Dropdown
        label="Rows"
        ariaLabel="Rows"
        value="25"
        onChange={() => undefined}
        options={[{ value: '25', label: '25 rows' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
    await waitFor(() =>
      expect(
        screen
          .getByRole('listbox')
          .closest('[data-placement]')
          ?.getAttribute('data-placement'),
      ).toBe('top'),
    );
    rect.mockRestore();
  });
  it('filters case-insensitively, reports empty results, and clears a selection', () => {
    render(<SelectHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Restaurant' }));
    const search = screen.getByRole('searchbox', {
      name: 'Search restaurants',
    });
    expect(search.className).toContain('bg-surface');
    fireEvent.change(search, { target: { value: 'PHO' } });
    expect(screen.getByText('Pho House')).toBeTruthy();
    expect(screen.queryByText('An Kitchen')).toBeNull();

    fireEvent.change(search, { target: { value: 'missing' } });
    expect(screen.getByText('Nothing found')).toBeTruthy();

    fireEvent.change(search, { target: { value: 'rice' } });
    fireEvent.click(screen.getByRole('option', { name: 'Rice Corner' }));
    expect(screen.getByRole('button', { name: 'Rice Corner' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rice Corner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: 'Restaurant' })).toBeTruthy();
  });

  it('preserves multi-selection across searches and resets search when closed', () => {
    render(<MultiSelectHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Members' }));
    const search = screen.getByRole('searchbox', { name: 'Search members' });
    expect(search.className).toContain('bg-surface');
    fireEvent.change(search, { target: { value: 'casey' } });
    const casey = screen.getByRole('option', { name: 'Casey Nguyen' });
    fireEvent.click(casey);

    fireEvent.keyDown(casey, { key: 'Escape' });
    expect(
      screen.queryByRole('searchbox', { name: 'Search members' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search members' }),
      {
        target: { value: 'hana' },
      },
    );
    fireEvent.click(screen.getByRole('option', { name: 'Hana Tran' }));
    expect(screen.getByRole('button', { name: '2 members' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '2 members' }));
    fireEvent.click(screen.getByRole('button', { name: '2 members' }));
    expect(screen.getByText('Casey Nguyen')).toBeTruthy();
    expect(screen.getByText('Hana Tran')).toBeTruthy();
    expect(screen.getByText('Sam Le')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('button', { name: 'Members' })).toBeTruthy();
  });
});
