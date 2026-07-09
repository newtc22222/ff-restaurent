import { AdjustmentType, BillSplitInput, BillSplitResult } from './types.js';

const assertAmount = (label: string, value: number) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
};

const splitAmount = (amount: number, count: number): number[] => {
  const base = Math.floor(amount / count);
  const remainder = amount % count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
};

const normalizeParticipants = (input: BillSplitInput): string[] => {
  if (input.participants.length < 2) {
    throw new Error('A bill requires at least two participants');
  }
  const ids = input.participants.map((participant) => participant.memberId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Participants must be unique');
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
};

export const calculateDiscount = (input: BillSplitInput): number => {
  return (input.discounts ?? []).reduce((sum, discount) => {
    if (discount.type === AdjustmentType.FIXED) {
      assertAmount('discount.value', discount.value);
      return sum + discount.value;
    }
    if (discount.value < 0) {
      throw new Error('percentage discount value must be non-negative');
    }
    return sum + Math.round((input.baseCost * discount.value) / 100);
  }, 0);
};

export const calculateBillSplit = (input: BillSplitInput): BillSplitResult => {
  assertAmount('baseCost', input.baseCost);
  assertAmount('vat', input.vat);
  assertAmount('shippingFee', input.shippingFee);

  const orderedIds = normalizeParticipants(input);
  const participantById = new Map(
    input.participants.map((participant) => [
      participant.memberId,
      participant,
    ]),
  );
  const count = orderedIds.length;

  const explicitOriginTotal = input.participants.reduce((sum, participant) => {
    if (participant.originCost == null) return sum;
    assertAmount('participant.originCost', participant.originCost);
    return sum + participant.originCost;
  }, 0);

  const everyOriginSpecified = input.participants.every(
    (participant) => participant.originCost != null,
  );
  if (everyOriginSpecified && explicitOriginTotal !== input.baseCost) {
    throw new Error('Participant origin costs must sum to baseCost');
  }

  const originShares = everyOriginSpecified
    ? orderedIds.map((id) => participantById.get(id)?.originCost ?? 0)
    : splitAmount(input.baseCost, count);

  const vatShares = splitAmount(input.vat, count);
  const shippingShares = splitAmount(input.shippingFee, count);
  const totalDiscount = calculateDiscount(input);
  const totalVoucher = (input.vouchers ?? []).reduce((sum, voucher) => {
    assertAmount('voucher.value', voucher.value);
    return sum + voucher.value;
  }, 0);
  const totalAdjustment = totalDiscount + totalVoucher;
  const adjustmentShares = splitAmount(totalAdjustment, count);
  const grossTotal = input.baseCost + input.vat + input.shippingFee;
  const totalCost = Math.max(0, grossTotal - totalAdjustment);

  const participants = orderedIds.map((memberId, index) => {
    const finalPrice = Math.max(
      0,
      originShares[index] +
        vatShares[index] +
        shippingShares[index] -
        adjustmentShares[index],
    );
    return {
      memberId,
      originCost: originShares[index],
      allocatedVat: vatShares[index],
      allocatedShipping: shippingShares[index],
      discountApplied: adjustmentShares[index],
      finalPrice,
    };
  });

  const participantTotal = participants.reduce(
    (sum, participant) => sum + participant.finalPrice,
    0,
  );
  if (participantTotal !== totalCost) {
    throw new Error(
      'Adjustments exceed one or more participant shares; cannot reconcile bill total',
    );
  }

  return {
    totalDiscount,
    totalVoucher,
    totalAdjustment,
    totalCost,
    participants,
  };
};

export const formatMoney = (
  amount: number,
  locale = 'vi-VN',
  currency = 'VND',
) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
