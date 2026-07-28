import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type BillServiceDb,
  computeBillCreateData,
  participantAllocationsChanged,
  validateParticipantIds,
  validatePaymentQr,
} from './bill-service.js';

const billBody = {
  restaurantId: 'restaurant-1',
  baseCost: 2000,
  vat: 0,
  shippingFee: 0,
  participants: [
    { memberId: 'member-1', originCost: 1000 },
    { memberId: 'member-2', originCost: 1000 },
  ],
};

test('bill computation defaults new bills to the Ho Chi Minh City calendar date', () => {
  const computed = computeBillCreateData(
    billBody,
    'owner-1',
    undefined,
    null,
    undefined,
    new Date('2026-07-15T18:30:00.000Z'),
  );

  assert.equal(
    computed.bill.occurredOn.toISOString(),
    '2026-07-16T00:00:00.000Z',
  );
});

test('bill computation preserves the stored date for legacy edit clients', () => {
  const computed = computeBillCreateData(
    billBody,
    'owner-1',
    undefined,
    null,
    new Date('2026-07-04T00:00:00.000Z'),
  );

  assert.equal(
    computed.bill.occurredOn.toISOString(),
    '2026-07-04T00:00:00.000Z',
  );
});

test('bill computation accepts an explicit occurrence date', () => {
  const computed = computeBillCreateData(
    { ...billBody, occurredOn: '2026-07-10' },
    'owner-1',
  );

  assert.equal(
    computed.bill.occurredOn.toISOString(),
    '2026-07-10T00:00:00.000Z',
  );
});

/**
 * These exercise the persistence-backed validations with an injected stub, so
 * the authorization-sensitive rules are covered without a live database.
 */

type QrRow = { id: string } | null;

const stubDb = (options: {
  qr?: QrRow;
  userCount?: number;
  onUserCountArgs?: (args: unknown) => void;
  onQrArgs?: (args: unknown) => void;
}): BillServiceDb => ({
  paymentQrImage: {
    findFirst: async (args) => {
      options.onQrArgs?.(args);
      return options.qr ?? null;
    },
  },
  user: {
    count: async (args) => {
      options.onUserCountArgs?.(args);
      return options.userCount ?? 0;
    },
  },
});

test('payment QR validation passes when none is attached', async () => {
  let queried = false;
  const db = stubDb({ onQrArgs: () => (queried = true) });
  assert.deepEqual(await validatePaymentQr(null, 'owner-1', db), { ok: true });
  assert.deepEqual(await validatePaymentQr(undefined, 'owner-1', db), {
    ok: true,
  });
  assert.equal(queried, false, 'must not hit the database when unset');
});

test('payment QR validation scopes the lookup to an active image owned by the creator', async () => {
  let seen: unknown;
  const db = stubDb({ qr: { id: 'qr-1' }, onQrArgs: (args) => (seen = args) });
  assert.deepEqual(await validatePaymentQr('qr-1', 'owner-1', db), {
    ok: true,
  });
  assert.deepEqual(seen, {
    where: { id: 'qr-1', ownerId: 'owner-1', status: 'ACTIVE' },
    select: { id: true },
  });
});

test('payment QR validation rejects an image that is missing, retired, or owned by someone else', async () => {
  const db = stubDb({ qr: null });
  assert.deepEqual(await validatePaymentQr('qr-1', 'owner-1', db), {
    ok: false,
    code: 'PAYMENT_QR_INVALID',
    message: 'Payment QR must be active and owned by the bill creator',
  });
});

test('participant validation passes only when every id resolves to a user', async () => {
  let countArgs: unknown;
  assert.deepEqual(
    await validateParticipantIds(
      ['a', 'b'],
      stubDb({
        userCount: 2,
        onUserCountArgs: (args) => {
          countArgs = args;
        },
      }),
    ),
    { ok: true },
  );
  assert.deepEqual(countArgs, {
    where: {
      id: { in: ['a', 'b'] },
      accountStatus: 'ACTIVE',
    },
  });
  assert.deepEqual(
    await validateParticipantIds(['a', 'b'], stubDb({ userCount: 1 })),
    {
      ok: false,
      code: 'INVALID_PARTICIPANTS',
      message: 'One or more participants do not exist',
    },
  );
});

const participant = (memberId: string, finalPrice: number) => ({
  memberId,
  originCost: 1000,
  allocatedVat: 100,
  allocatedShipping: 50,
  discountApplied: 0,
  finalPrice,
});

test('allocation comparison ignores ordering but detects real movement', () => {
  const existing = [participant('a', 1150), participant('b', 1150)];

  assert.equal(
    participantAllocationsChanged(existing, [
      participant('b', 1150),
      participant('a', 1150),
    ]),
    false,
    'reordering the same allocations is not a change',
  );

  assert.equal(
    participantAllocationsChanged(existing, [
      participant('a', 1151),
      participant('b', 1150),
    ]),
    true,
    'a one-cent difference is a change',
  );

  assert.equal(
    participantAllocationsChanged(existing, [participant('a', 1150)]),
    true,
    'dropping a participant is a change',
  );

  assert.equal(
    participantAllocationsChanged(existing, [
      participant('a', 1150),
      participant('c', 1150),
    ]),
    true,
    'swapping who participates is a change even at equal totals',
  );
});
