import { describe, expect, it } from 'vitest';
import {
  ADJUSTMENT_ALLOCATION_VALUES,
  ADJUSTMENT_TYPE_VALUES,
  AdjustmentAllocation,
  AdjustmentType,
  CHEF_ROLE_VALUES,
  COLLECTION_SYSTEM_TYPE_VALUES,
  ChefRole,
  CollectionSystemType,
  ENTRY_STATUS_VALUES,
  EntryStatus,
  PAYMENT_STATUS_VALUES,
  PaymentStatus,
  RESTAURANT_PLATFORM_VALUES,
  RestaurantPlatform,
  SYSTEM_ROLE_VALUES,
  SystemRole,
  isHeadChef,
  isRootAdmin,
  isSousChefOrAbove,
} from './types.js';

/**
 * The `satisfies` clause on each tuple catches a *missing* or misspelled
 * member at compile time, but not an *extra* enum member that nobody added to
 * the tuple. These checks close that gap at runtime.
 */
describe('domain enum value tuples', () => {
  const cases: ReadonlyArray<
    [string, Record<string, string>, readonly string[]]
  > = [
    ['ChefRole', ChefRole, CHEF_ROLE_VALUES],
    ['SystemRole', SystemRole, SYSTEM_ROLE_VALUES],
    ['EntryStatus', EntryStatus, ENTRY_STATUS_VALUES],
    ['PaymentStatus', PaymentStatus, PAYMENT_STATUS_VALUES],
    ['AdjustmentType', AdjustmentType, ADJUSTMENT_TYPE_VALUES],
    [
      'AdjustmentAllocation',
      AdjustmentAllocation,
      ADJUSTMENT_ALLOCATION_VALUES,
    ],
    ['RestaurantPlatform', RestaurantPlatform, RESTAURANT_PLATFORM_VALUES],
    [
      'CollectionSystemType',
      CollectionSystemType,
      COLLECTION_SYSTEM_TYPE_VALUES,
    ],
  ];

  it.each(cases)(
    '%s tuple covers every enum member',
    (_name, enumObj, tuple) => {
      expect([...tuple].sort()).toEqual(Object.values(enumObj).sort());
    },
  );
});

describe('role predicates', () => {
  const customer = { chefRole: null, systemRole: null } as const;
  const sous = { chefRole: 'SOUS_CHEF', systemRole: null } as const;
  const head = { chefRole: 'HEAD_CHEF', systemRole: null } as const;
  const root = { chefRole: null, systemRole: 'ROOT_ADMIN' } as const;

  it('treats a missing user as an unprivileged customer', () => {
    for (const user of [null, undefined]) {
      expect(isRootAdmin(user)).toBe(false);
      expect(isSousChefOrAbove(user)).toBe(false);
      expect(isHeadChef(user)).toBe(false);
    }
  });

  it('grants nothing to a plain customer', () => {
    expect(isRootAdmin(customer)).toBe(false);
    expect(isSousChefOrAbove(customer)).toBe(false);
    expect(isHeadChef(customer)).toBe(false);
  });

  it('grants SOUS_CHEF the chef tier but not the head tier', () => {
    expect(isSousChefOrAbove(sous)).toBe(true);
    expect(isHeadChef(sous)).toBe(false);
    expect(isRootAdmin(sous)).toBe(false);
  });

  it('grants HEAD_CHEF both chef tiers but not root', () => {
    expect(isSousChefOrAbove(head)).toBe(true);
    expect(isHeadChef(head)).toBe(true);
    expect(isRootAdmin(head)).toBe(false);
  });

  it('passes ROOT_ADMIN through every chef check without a chefRole', () => {
    expect(isRootAdmin(root)).toBe(true);
    expect(isSousChefOrAbove(root)).toBe(true);
    expect(isHeadChef(root)).toBe(true);
  });
});
