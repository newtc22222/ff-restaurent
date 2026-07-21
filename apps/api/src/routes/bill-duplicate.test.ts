import assert from 'node:assert/strict';
import test from 'node:test';
import { AdjustmentAllocation } from '@ff-restaurent/shared';
import { createBillFingerprint } from './bill-routes.js';

test('bill fingerprints ignore participant and adjustment ordering', () => {
  const bill = {
    restaurantId: 'restaurant-1',
    baseCost: 3000,
    vat: 300,
    shippingFee: 200,
    paymentUrl: 'https://pay.example.test/bill',
    discounts: [
      { type: 'FIXED', value: 100 },
      { type: 'PERCENTAGE', value: 5 },
    ],
    vouchers: [
      { code: 'A', value: 50 },
      { code: 'B', value: 25 },
    ],
    participants: [
      { memberId: 'user-b', originCost: 2000 },
      { memberId: 'user-a', originCost: 1000 },
    ],
  };

  assert.equal(
    createBillFingerprint(bill),
    createBillFingerprint({
      ...bill,
      discounts: [...bill.discounts].reverse(),
      vouchers: [...bill.vouchers].reverse(),
      participants: [...bill.participants].reverse(),
    }),
  );
  assert.notEqual(
    createBillFingerprint(bill),
    createBillFingerprint({ ...bill, shippingFee: 201 }),
  );
  assert.notEqual(
    createBillFingerprint({
      ...bill,
      adjustmentAllocation: AdjustmentAllocation.EQUAL,
    }),
    createBillFingerprint({
      ...bill,
      adjustmentAllocation: AdjustmentAllocation.PROPORTIONAL,
    }),
  );
});
