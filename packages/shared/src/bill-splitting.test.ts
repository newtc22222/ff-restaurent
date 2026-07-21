import { describe, expect, it } from 'vitest';
import { AdjustmentAllocation, AdjustmentType } from './types.js';
import { calculateBillSplit } from './bill-splitting.js';

describe('calculateBillSplit', () => {
  it('splits base, vat, shipping, discounts, and vouchers evenly with deterministic remainders', () => {
    const result = calculateBillSplit({
      baseCost: 1001,
      vat: 101,
      shippingFee: 50,
      discounts: [{ type: AdjustmentType.FIXED, value: 100 }],
      vouchers: [{ code: 'LUNCH', value: 20 }],
      adjustmentAllocation: AdjustmentAllocation.EQUAL,
      participants: [{ memberId: 'c' }, { memberId: 'a' }, { memberId: 'b' }],
    });

    expect(result.totalCost).toBe(1032);
    expect(
      result.participants.map((participant) => participant.memberId),
    ).toEqual(['a', 'b', 'c']);
    expect(
      result.participants.map((participant) => participant.finalPrice),
    ).toEqual([345, 345, 342]);
    expect(
      result.participants.reduce(
        (sum, participant) => sum + participant.finalPrice,
        0,
      ),
    ).toBe(result.totalCost);
  });

  it('uses explicit origin costs when they sum to the base cost', () => {
    const result = calculateBillSplit({
      baseCost: 2000,
      vat: 200,
      shippingFee: 0,
      participants: [
        { memberId: 'alice', originCost: 1500 },
        { memberId: 'bob', originCost: 500 },
      ],
    });

    expect(result.participants[0]?.finalPrice).toBe(1600);
    expect(result.participants[1]?.finalPrice).toBe(600);
  });

  it('converts percentage discounts from base cost', () => {
    const result = calculateBillSplit({
      baseCost: 999,
      vat: 0,
      shippingFee: 0,
      discounts: [{ type: AdjustmentType.PERCENTAGE, value: 10 }],
      participants: [{ memberId: 'a' }, { memberId: 'b' }, { memberId: 'c' }],
    });

    expect(result.totalDiscount).toBe(100);
    expect(result.totalCost).toBe(899);
  });

  it('allocates adjustments proportionally with deterministic remainder ties', () => {
    const result = calculateBillSplit({
      baseCost: 1000,
      vat: 0,
      shippingFee: 0,
      discounts: [{ type: AdjustmentType.FIXED, value: 101 }],
      adjustmentAllocation: AdjustmentAllocation.PROPORTIONAL,
      participants: [
        { memberId: 'charlie', originCost: 200 },
        { memberId: 'alice', originCost: 400 },
        { memberId: 'bob', originCost: 400 },
      ],
    });

    expect(
      result.participants.map(({ memberId, discountApplied }) => ({
        memberId,
        discountApplied,
      })),
    ).toEqual([
      { memberId: 'alice', discountApplied: 41 },
      { memberId: 'bob', discountApplied: 40 },
      { memberId: 'charlie', discountApplied: 20 },
    ]);
    expect(
      result.participants.reduce(
        (sum, participant) => sum + participant.finalPrice,
        0,
      ),
    ).toBe(result.totalCost);
  });

  it('rejects origin costs that drift from the bill base cost', () => {
    expect(() =>
      calculateBillSplit({
        baseCost: 1000,
        vat: 0,
        shippingFee: 0,
        participants: [
          { memberId: 'alice', originCost: 700 },
          { memberId: 'bob', originCost: 200 },
        ],
      }),
    ).toThrow('sum to baseCost');
  });
});
