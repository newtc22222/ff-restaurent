import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type BillServiceDb,
  participantAllocationsChanged,
  validateParticipantIds,
  validatePaymentQr,
} from './bill-service.js';

/**
 * These exercise the persistence-backed validations with an injected stub, so
 * the authorization-sensitive rules are covered without a live database.
 */

type QrRow = { id: string } | null;

const stubDb = (options: {
  qr?: QrRow;
  userCount?: number;
  onQrArgs?: (args: unknown) => void;
}): BillServiceDb => ({
  paymentQrImage: {
    findFirst: async (args) => {
      options.onQrArgs?.(args);
      return options.qr ?? null;
    },
  },
  user: {
    count: async () => options.userCount ?? 0,
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
  assert.deepEqual(
    await validateParticipantIds(['a', 'b'], stubDb({ userCount: 2 })),
    { ok: true },
  );
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
