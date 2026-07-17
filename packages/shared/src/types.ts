export enum ChefRole {
  SOUS_CHEF = 'SOUS_CHEF',
  HEAD_CHEF = 'HEAD_CHEF',
}

export enum SystemRole {
  ROOT_ADMIN = 'ROOT_ADMIN',
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

export enum AdjustmentAllocation {
  EQUAL = 'EQUAL',
  PROPORTIONAL = 'PROPORTIONAL',
}

/** Display labels for roles */
export const ROLE_LABELS: Record<string, Record<string, string>> = {
  vi: {
    CUSTOMER: 'Khách hàng',
    SOUS_CHEF: 'Sous chef',
    HEAD_CHEF: 'Bếp trưởng',
    ROOT_ADMIN: 'Quản trị viên gốc',
  },
  en: {
    CUSTOMER: 'Customer',
    SOUS_CHEF: 'Sous chef',
    HEAD_CHEF: 'Head Chef',
    ROOT_ADMIN: 'Root Admin',
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
  adjustmentAllocation?: AdjustmentAllocation;
  participants: ParticipantInput[];
};

export type BillSplitResult = {
  totalDiscount: number;
  totalVoucher: number;
  totalAdjustment: number;
  totalCost: number;
  participants: CalculatedParticipant[];
};
