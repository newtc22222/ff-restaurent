export enum ChefRole {
  SOUS_CHEF = 'SOUS_CHEF',
  HEAD_CHEF = 'HEAD_CHEF',
}

export enum EntryStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum PaymentStatus {
  PAID = 'PAID',
  WAITING = 'WAITING',
}

export enum AdjustmentType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

/** Display labels for roles */
export const ROLE_LABELS: Record<string, Record<string, string>> = {
  vi: {
    CUSTOMER: 'Khách hàng',
    SOUS_CHEF: 'Sous chef',
    HEAD_CHEF: 'Bếp trưởng',
  },
  en: {
    CUSTOMER: 'Customer',
    SOUS_CHEF: 'Sous chef',
    HEAD_CHEF: 'Executive chef',
  },
};

export type DiscountInput = {
  type: AdjustmentType;
  value: number;
  label?: string;
};

export type VoucherInput = {
  code: string;
  value: number;
};

export type ParticipantInput = {
  memberId: string;
  originCost?: number;
};

export type CalculatedParticipant = {
  memberId: string;
  originCost: number;
  allocatedVat: number;
  allocatedShipping: number;
  discountApplied: number;
  finalPrice: number;
};

export type BillSplitInput = {
  baseCost: number;
  vat: number;
  shippingFee: number;
  discounts?: DiscountInput[];
  vouchers?: VoucherInput[];
  participants: ParticipantInput[];
};

export type BillSplitResult = {
  totalDiscount: number;
  totalVoucher: number;
  totalAdjustment: number;
  totalCost: number;
  participants: CalculatedParticipant[];
};
