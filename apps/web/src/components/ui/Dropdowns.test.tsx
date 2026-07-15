// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import Dropdown, { type DropdownOption } from './Dropdown';

const options: DropdownOption[] = [
  { value: 'an', label: 'An Kitchen' },
  { value: 'pho', label: 'Pho House' },
  { value: 'rice', label: 'Rice Corner' },
];

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
