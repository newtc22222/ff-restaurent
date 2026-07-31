// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/providers/i18n';
import { QueryProvider } from '@/app/providers/query';

import CreateBillPage from './CreateBillPage';

const mutate = vi.fn();
const routerState = vi.hoisted(() => ({
  params: {} as { billId?: string },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => routerState.params,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/hooks/useRouteMutation', () => ({
  useRouteMutation: () => ({ mutate }),
}));

vi.mock('@/app/providers/app-context', () => ({
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
      {
        id: 'blocked-1',
        username: 'blocked-bob',
        name: 'Blocked Bob',
        chefRole: null,
        systemRole: null,
        roles: ['CUSTOMER'],
        paymentRemindersEnabled: true,
        accountStatus: 'BLOCKED',
      },
    ],
    bills: [
      {
        id: 'bill-blocked',
        restaurant: { id: 'restaurant-1' },
        occurredOn: '2026-07-15',
        vat: 0,
        shippingFee: 0,
        discounts: [],
        vouchers: [],
        adjustmentAllocation: 'PROPORTIONAL',
        paymentQrImageId: null,
        participants: [
          {
            memberId: 'blocked-1',
            member: {
              id: 'blocked-1',
              username: 'blocked-bob',
              name: 'Blocked Bob',
            },
            originCost: 6000,
          },
          {
            memberId: 'user-1',
            member: {
              id: 'user-1',
              username: 'alice',
              name: 'Alice',
            },
            originCost: 7000,
          },
        ],
      },
    ],
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
  routerState.params = {};
});

afterEach(cleanup);

describe('CreateBillPage repeat workflows', () => {
  it('keeps a blocked historical participant visible and removable while editing', () => {
    routerState.params = { billId: 'bill-blocked' };
    render(
      <QueryProvider>
        <I18nProvider>
          <CreateBillPage />
        </I18nProvider>
      </QueryProvider>,
    );

    expect(screen.getByText('Blocked Bob (blocked account)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add participant' }));
    expect(
      screen.getByRole('option', {
        name: /Blocked Bob \(blocked account\)/,
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('dropdown-backdrop'));

    fireEvent.click(screen.getAllByTitle('Remove')[0]!);
    expect(screen.queryByText('Blocked Bob (blocked account)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add participant' }));
    expect(
      screen.queryByRole('option', {
        name: /Blocked Bob \(blocked account\)/,
      }),
    ).toBeNull();
  });

  it('applies an owner participant group without managing it inline', () => {
    render(
      <QueryProvider>
        <I18nProvider>
          <CreateBillPage />
        </I18nProvider>
      </QueryProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose a group' }));
    fireEvent.click(screen.getByRole('option', { name: /Lunch crew/ }));
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
      <QueryProvider>
        <I18nProvider>
          <CreateBillPage />
        </I18nProvider>
      </QueryProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Restaurant / Eatery' }),
    );
    fireEvent.click(screen.getByRole('option', { name: /Lunch Place/ }));
    fireEvent.click(screen.getByLabelText('Bill date'));
    const day15 = screen
      .getAllByRole('button', { name: /July 15.*2026/i })
      .find((btn) => !btn.hasAttribute('disabled'));
    if (day15) fireEvent.click(day15);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a group' }));
    fireEvent.click(screen.getByRole('option', { name: /Lunch crew/ }));
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
          occurredOn: '2026-07-15',
        }),
      }),
    );
  });

  it('resets a discount value when its type changes', () => {
    render(
      <QueryProvider>
        <I18nProvider>
          <CreateBillPage />
        </I18nProvider>
      </QueryProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add discount' }));
    const value = screen.getByLabelText('Discount 1 value');
    fireEvent.change(value, { target: { value: '500' } });
    expect((value as HTMLInputElement).value).toContain('500');
    fireEvent.click(screen.getByRole('button', { name: 'Discount 1 type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Percent' }));
    expect((value as HTMLInputElement).value).toBe('');
  });
});
