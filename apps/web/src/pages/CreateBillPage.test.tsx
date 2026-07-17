// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/providers/i18n';
import CreateBillPage from './CreateBillPage';

const mutate = vi.fn();

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

vi.mock('../components/ui/Dropdown', () => ({
  default: ({
    ariaLabel,
    value = '',
    values = [],
    options,
    multiple,
    onChange,
  }: any) => (
    <select
      aria-label={ariaLabel}
      multiple={multiple}
      value={multiple ? values : value}
      onChange={(event) =>
        onChange(
          multiple
            ? Array.from(event.currentTarget.selectedOptions).map(
                (option) => option.value,
              )
            : event.currentTarget.value,
        )
      }
    >
      <option value="">Choose</option>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../hooks/useMutation', () => ({
  useMutation: () => ({ mutate }),
}));

vi.mock('../app/providers/app-context', () => ({
  useAppContext: () => ({
    user: {
      id: 'sous-1',
      username: 'sous',
      name: 'Sous',
      chefRole: 'SOUS_CHEF',
      systemRole: null,
      roles: ['CUSTOMER', 'SOUS_CHEF'],
      paymentRemindersEnabled: true,
    },
    users: [
      {
        id: 'user-1',
        username: 'alice',
        name: 'Alice',
        chefRole: null,
        systemRole: null,
        roles: ['CUSTOMER'],
        paymentRemindersEnabled: true,
      },
      {
        id: 'user-2',
        username: 'bob',
        name: 'Bob',
        chefRole: null,
        systemRole: null,
        roles: ['CUSTOMER'],
        paymentRemindersEnabled: true,
      },
    ],
    bills: [],
    restaurants: [
      {
        id: 'restaurant-1',
        name: 'Lunch Place',
        type: 'Restaurant',
        cuisineType: 'Vietnamese',
        status: 'ACTIVE',
      },
    ],
    participantGroups: [
      {
        id: 'group-1',
        name: 'Lunch crew',
        ownerId: 'sous-1',
        createdAt: '2026-07-15T10:00:00.000Z',
        updatedAt: '2026-07-15T10:00:00.000Z',
        members: [
          { userId: 'user-1', user: {} },
          { userId: 'user-2', user: {} },
        ],
      },
    ],
  }),
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
  mutate.mockClear();
});

afterEach(cleanup);

describe('CreateBillPage repeat workflows', () => {
  it('applies an owner participant group without managing it inline', () => {
    render(
      <I18nProvider>
        <CreateBillPage />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText('Choose a group'), {
      target: { value: 'group-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply group' }));
    expect(screen.getByLabelText('Base amount for Alice')).toBeTruthy();
    expect(screen.getByLabelText('Base amount for Bob')).toBeTruthy();

    expect(screen.queryByLabelText('New group name')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Save current group' }),
    ).toBeNull();
  });

  it('requires explicit confirmation before overriding an exact duplicate', () => {
    render(
      <I18nProvider>
        <CreateBillPage />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('Restaurant / Eatery'), {
      target: { value: 'restaurant-1' },
    });
    fireEvent.change(screen.getByLabelText('Choose a group'), {
      target: { value: 'group-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply group' }));
    fireEvent.change(screen.getByLabelText('Base amount for Alice'), {
      target: { value: '6000' },
    });
    fireEvent.change(screen.getByLabelText('Base amount for Bob'), {
      target: { value: '7000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save bill' }));

    const firstOptions = mutate.mock.calls.at(-1)?.[1];
    act(() => firstOptions.onError('BILL_DUPLICATE_DETECTED', {}));
    expect(screen.getByText('Duplicate bill detected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(mutate.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        intent: 'create-bill',
        payload: expect.objectContaining({
          adjustmentAllocation: 'PROPORTIONAL',
          allowDuplicate: true,
        }),
      }),
    );
  });

  it('resets a discount value when its type changes', () => {
    render(
      <I18nProvider>
        <CreateBillPage />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add discount' }));
    const value = screen.getByLabelText('Discount 1 value');
    fireEvent.change(value, { target: { value: '500' } });
    expect((value as HTMLInputElement).value).toContain('500');
    fireEvent.change(screen.getByLabelText('Discount 1 type'), {
      target: { value: 'PERCENTAGE' },
    });
    expect((value as HTMLInputElement).value).toBe('');
  });
});
