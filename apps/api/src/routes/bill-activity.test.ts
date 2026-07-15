import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBillActivityTimeline } from './bill-routes.js';

const actor = { id: 'user-1', username: 'member', name: 'Member One' };

test('bill activity returns curated summaries in reverse chronological order', () => {
  const timeline = buildBillActivityTimeline({
    id: 'bill-1',
    createdAt: new Date('2026-07-15T01:00:00.000Z'),
    createdBy: actor,
    participants: [{ memberId: actor.id, member: actor }],
    auditLogs: [
      {
        id: 'updated-1',
        action: 'UPDATED',
        before: {
          baseCost: 1000,
          vat: 0,
          shippingFee: 0,
          discounts: [],
          vouchers: [],
          paymentUrl: null,
          participants: [{ memberId: actor.id, finalPrice: 1000 }],
        },
        after: {
          baseCost: 1200,
          vat: 0,
          shippingFee: 0,
          discounts: [],
          vouchers: [],
          paymentUrl: 'https://pay.example.test/bill',
          participants: [{ memberId: actor.id, finalPrice: 1200 }],
        },
        createdAt: new Date('2026-07-15T02:00:00.000Z'),
        user: actor,
      },
      {
        id: 'payment-1',
        action: 'PAYMENT_STATUS_CHANGED',
        before: { memberId: actor.id, paymentStatus: 'WAITING' },
        after: { memberId: actor.id, paymentStatus: 'PAID' },
        createdAt: new Date('2026-07-15T03:00:00.000Z'),
        user: actor,
      },
    ],
  });

  assert.deepEqual(
    timeline.map((event) => event.action),
    ['PAYMENT_STATUS_CHANGED', 'UPDATED', 'CREATED'],
  );
  assert.deepEqual(timeline[0]?.details, {
    memberId: actor.id,
    memberName: actor.name,
    fromStatus: 'WAITING',
    toStatus: 'PAID',
  });
  assert.deepEqual(timeline[1]?.details?.changes, [
    'costs',
    'paymentLink',
    'participants',
  ]);
  assert.equal(JSON.stringify(timeline).includes('before'), false);
  assert.equal(JSON.stringify(timeline).includes('after'), false);
});

test('bill activity ignores unsupported internal audit actions', () => {
  const timeline = buildBillActivityTimeline({
    id: 'bill-1',
    createdAt: new Date('2026-07-15T01:00:00.000Z'),
    createdBy: actor,
    participants: [],
    auditLogs: [
      {
        id: 'internal-1',
        action: 'INTERNAL_ONLY',
        before: null,
        after: { secret: 'not-for-the-timeline' },
        createdAt: new Date('2026-07-15T02:00:00.000Z'),
        user: actor,
      },
    ],
  });

  assert.deepEqual(
    timeline.map((event) => event.action),
    ['CREATED'],
  );
});
