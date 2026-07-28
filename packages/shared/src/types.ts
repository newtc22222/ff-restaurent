export enum ChefRole {
  SOUS_CHEF = 'SOUS_CHEF',
  HEAD_CHEF = 'HEAD_CHEF',
}

export enum SystemRole {
  ROOT_ADMIN = 'ROOT_ADMIN',
}

export enum UserAccountStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
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

/** Typed delivery/ordering platforms a restaurant can be linked on. */
export enum RestaurantPlatform {
  GRAB = 'GRAB',
  SHOPEE_FOOD = 'SHOPEE_FOOD',
  BE_FOOD = 'BE_FOOD',
  GOJEK = 'GOJEK',
  WEBSITE = 'WEBSITE',
  FACEBOOK = 'FACEBOOK',
  OTHER = 'OTHER',
}

/**
 * System-managed collections. A `null` system type denotes a user-created
 * collection.
 */
export enum CollectionSystemType {
  FAVORITES = 'FAVORITES',
  RECOMMENDED = 'RECOMMENDED',
}

/*
 * Value tuples for each domain enum.
 *
 * These exist because a TypeScript string-enum type is nominal: a plain
 * `'SOUS_CHEF'` string is not assignable to `ChefRole`, so neither Prisma's
 * generated literal unions nor JSON parsed at the API boundary satisfy the
 * enum type directly. Each tuple is `satisfies readonly `${Enum}`[]`, so
 * adding or renaming an enum member without updating its tuple is a
 * compile error — the tuple cannot drift from the enum it mirrors.
 *
 * Use the enum when you need a value (`ChefRole.HEAD_CHEF`); use the tuple
 * when you need the literal union, e.g. `z.enum(CHEF_ROLE_VALUES)`.
 */

export const CHEF_ROLE_VALUES = [
  'SOUS_CHEF',
  'HEAD_CHEF',
] as const satisfies readonly `${ChefRole}`[];

export const SYSTEM_ROLE_VALUES = [
  'ROOT_ADMIN',
] as const satisfies readonly `${SystemRole}`[];

export const USER_ACCOUNT_STATUS_VALUES = [
  'ACTIVE',
  'BLOCKED',
] as const satisfies readonly `${UserAccountStatus}`[];

export const ENTRY_STATUS_VALUES = [
  'ACTIVE',
  'ARCHIVED',
] as const satisfies readonly `${EntryStatus}`[];

export const PAYMENT_STATUS_VALUES = [
  'PAID',
  'WAITING',
] as const satisfies readonly `${PaymentStatus}`[];

export const ADJUSTMENT_TYPE_VALUES = [
  'FIXED',
  'PERCENTAGE',
] as const satisfies readonly `${AdjustmentType}`[];

export const ADJUSTMENT_ALLOCATION_VALUES = [
  'EQUAL',
  'PROPORTIONAL',
] as const satisfies readonly `${AdjustmentAllocation}`[];

export const RESTAURANT_PLATFORM_VALUES = [
  'GRAB',
  'SHOPEE_FOOD',
  'BE_FOOD',
  'GOJEK',
  'WEBSITE',
  'FACEBOOK',
  'OTHER',
] as const satisfies readonly `${RestaurantPlatform}`[];

export const COLLECTION_SYSTEM_TYPE_VALUES = [
  'FAVORITES',
  'RECOMMENDED',
] as const satisfies readonly `${CollectionSystemType}`[];

/** Literal-union counterparts of the domain enums, for wire-level shapes. */
export type ChefRoleValue = (typeof CHEF_ROLE_VALUES)[number];
export type SystemRoleValue = (typeof SYSTEM_ROLE_VALUES)[number];
export type UserAccountStatusValue =
  (typeof USER_ACCOUNT_STATUS_VALUES)[number];
export type EntryStatusValue = (typeof ENTRY_STATUS_VALUES)[number];
export type PaymentStatusValue = (typeof PAYMENT_STATUS_VALUES)[number];
export type AdjustmentTypeValue = (typeof ADJUSTMENT_TYPE_VALUES)[number];
export type AdjustmentAllocationValue =
  (typeof ADJUSTMENT_ALLOCATION_VALUES)[number];
export type RestaurantPlatformValue =
  (typeof RESTAURANT_PLATFORM_VALUES)[number];
export type CollectionSystemTypeValue =
  (typeof COLLECTION_SYSTEM_TYPE_VALUES)[number];

/**
 * Minimal shape the role predicates need. Both the API's Prisma-backed user
 * and the web's API response type satisfy this structurally, which is what
 * lets a single implementation serve both.
 */
export type RoleBearer = {
  chefRole?: ChefRoleValue | null;
  systemRole?: SystemRoleValue | null;
};

/** Holds the singleton system-administration role. */
export const isRootAdmin = (user?: RoleBearer | null): boolean =>
  user?.systemRole === 'ROOT_ADMIN';

/** SOUS_CHEF or above. ROOT_ADMIN passes every chef check. */
export const isSousChefOrAbove = (user?: RoleBearer | null): boolean =>
  isRootAdmin(user) ||
  user?.chefRole === 'SOUS_CHEF' ||
  user?.chefRole === 'HEAD_CHEF';

/** HEAD_CHEF or above. ROOT_ADMIN passes every chef check. */
export const isHeadChef = (user?: RoleBearer | null): boolean =>
  isRootAdmin(user) || user?.chefRole === 'HEAD_CHEF';

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
