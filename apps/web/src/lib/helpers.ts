import {
  isHeadChef,
  isRootAdmin as isRootAdminShared,
  isSousChefOrAbove,
} from '@ff-restaurent/shared';
import { User, Bill } from './api';

/**
 * Array of Vietnamese cuisine options displayed when creating a restaurant.
 */
export const CUISINE_OPTIONS: string[] = [
  'Phở',
  'Bún bò Huế',
  'Bánh mì',
  'Cơm tấm',
  'Bún chả',
  'Gỏi cuốn',
  'Chả giò',
  'Hủ tiếu',
  'Mì Quảng',
  'Bánh xèo',
  'Lẩu',
  'Trà sữa',
  'Cà phê',
  'Ăn vặt',
  'Đồ nướng',
  'Hải sản',
  'Chay',
  'Nhật Bản',
  'Hàn Quốc',
  'Thái',
  'Ý',
  'Trung Hoa',
  'Ấn Độ',
  'Pháp',
  'Mỹ',
];

/**
 * Colors used in Pie charts for stats breakdowns.
 */
export const PIE_COLORS: string[] = [
  '#10b981',
  '#f59e0b',
  '#6366f1',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#8b5cf6',
];

/**
 * Pre-seeded user identities for easy switching on local development.
 */
export const seededUsers = [
  ['customer', 'role.customer'],
  ['sous', 'role.souschef'],
  ['head', 'role.rootadmin'],
] as const;

/**
 * Returns a translated or fallback role label for a given User.
 * @param user The user object.
 * @param t The translation function.
 */
export const roleLabel = (
  user?: User | null,
  t?: (key: string) => string,
): string => {
  if (!user) return t?.('role.customer') ?? 'Customer';
  if (user.systemRole === 'ROOT_ADMIN')
    return t?.('role.rootadmin') ?? 'Root Admin';
  if (user.chefRole === 'HEAD_CHEF') return t?.('role.headchef') ?? 'Head Chef';
  if (user.chefRole === 'SOUS_CHEF') return t?.('role.souschef') ?? 'Sous chef';
  return t?.('role.customer') ?? 'Customer';
};

/*
 * The role hierarchy itself lives in @ff-restaurent/shared so the web and the
 * API cannot disagree about who may do what. These are thin, named wrappers
 * that keep the existing call sites unchanged.
 */

/**
 * Check if the user is a SOUS_CHEF or HEAD_CHEF.
 */
export const canChef = (user: User | null): boolean => isSousChefOrAbove(user);

/**
 * Check if the user is a HEAD_CHEF.
 */
export const isHead = (user: User | null): boolean => isHeadChef(user);

/** Check if the user holds the singleton system-administration role. */
export const isRootAdmin = (user: User | null): boolean =>
  isRootAdminShared(user);

/**
 * Check if the user has permission to edit or manage a bill.
 */
export const canManageBill = (bill: Bill, user: User): boolean =>
  isHead(user) || bill.createdById === user.id;

/**
 * Combines users and target fallback to return a list of unique users sorted by name.
 */
export const uniqueUsers = (users: User[], fallback: User): User[] => {
  const byId = new Map<string, User>();
  [...users, fallback].forEach((member) => byId.set(member.id, member));
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Returns initials (max 2 characters) for a given user name.
 */
export const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
