// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/providers/i18n';
import ParticipantGroupsPage from './ParticipantGroupsPage';

const mutate = vi.fn();

vi.mock('../hooks/useMutation', () => ({
  useMutation: () => ({ mutate }),
}));

vi.mock('../components/ui/Dropdown', () => ({
  default: ({ ariaLabel, values, options, onChange }: any) => (
    <select
      aria-label={ariaLabel}
      multiple
      value={values}
      onChange={(event) =>
        onChange(
          Array.from(event.currentTarget.selectedOptions).map(
            (option: any) => option.value,
          ),
        )
      }
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../app/providers/app-context', () => ({
  useAppContext: () => ({
    user: { id: 'owner', username: 'owner', name: 'Owner' },
    users: [
      { id: 'alice', username: 'alice', name: 'Alice' },
      { id: 'bob', username: 'bob', name: 'Bob' },
    ],
    participantGroups: [
      {
        id: 'group-1',
        name: 'Lunch crew',
        members: [
          { userId: 'alice', user: { name: 'Alice' } },
          { userId: 'bob', user: { name: 'Bob' } },
        ],
      },
    ],
  }),
}));

beforeEach(() => {
  localStorage.setItem('ff-locale', 'en');
  mutate.mockClear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ParticipantGroupsPage', () => {
  it('creates and edits owner groups with at least two members', () => {
    render(
      <I18nProvider>
        <ParticipantGroupsPage />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText('New group name'), {
      target: { value: 'Friday team' },
    });
    const members = screen.getByLabelText(
      'Choose members',
    ) as HTMLSelectElement;
    members.options[0]!.selected = true;
    members.options[1]!.selected = true;
    fireEvent.change(members);
    fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        intent: 'create-participant-group',
        payload: { name: 'Friday team', memberIds: ['alice', 'bob'] },
      },
      expect.objectContaining({ success: 'Participant group saved.' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit group' }));
    expect(screen.getByDisplayValue('Lunch crew')).toBeTruthy();
  });
});
