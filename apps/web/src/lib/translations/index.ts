import enAdmin from './en/admin.json';
import enAuth from './en/auth.json';
import enBills from './en/bills.json';
import enCollections from './en/collections.json';
import enCommon from './en/common.json';
import enErrors from './en/errors.json';
import enGroups from './en/groups.json';
import enRestaurants from './en/restaurants.json';
import enStats from './en/stats.json';
import enToast from './en/toast.json';
import viAdmin from './vi/admin.json';
import viAuth from './vi/auth.json';
import viBills from './vi/bills.json';
import viCollections from './vi/collections.json';
import viCommon from './vi/common.json';
import viErrors from './vi/errors.json';
import viGroups from './vi/groups.json';
import viRestaurants from './vi/restaurants.json';
import viStats from './vi/stats.json';
import viToast from './vi/toast.json';

/**
 * Translation dictionaries, assembled from per-locale domain namespaces.
 *
 * The strings live in JSON so translation tooling and non-developers can edit
 * them without touching TypeScript. Type safety is not lost: `resolveJsonModule`
 * makes TypeScript derive a precise key type from each file's contents, so both
 * guarantees below are still compile-time.
 *
 * Parity is enforced at two levels:
 *
 * 1. Each `en<Domain>` is assigned to `Record<keyof typeof vi<Domain>, string>`
 *    below. A key present in Vietnamese but missing from English fails to
 *    compile, and the error names both the property and the namespace.
 * 2. `en` is typed as `Record<TranslationKey, string>`, which catches a domain
 *    wired into one locale but not the other.
 *
 * Vietnamese is the source of truth for the key set — it is the default locale
 * and the one product copy is authored in.
 */

export type Locale = 'vi' | 'en';

const vi = {
  ...viCommon,
  ...viAuth,
  ...viBills,
  ...viRestaurants,
  ...viCollections,
  ...viGroups,
  ...viAdmin,
  ...viStats,
  ...viToast,
  ...viErrors,
} as const;

/** Every valid translation key. Misspellings fail typecheck at the call site. */
export type TranslationKey = keyof typeof vi;

/*
 * Per-namespace coverage checks, declared separately rather than only checking
 * the merged object so a compile error points at the namespace actually
 * missing a key.
 */
const common: Record<keyof typeof viCommon, string> = enCommon;
const auth: Record<keyof typeof viAuth, string> = enAuth;
const bills: Record<keyof typeof viBills, string> = enBills;
const restaurants: Record<keyof typeof viRestaurants, string> = enRestaurants;
const collections: Record<keyof typeof viCollections, string> = enCollections;
const groups: Record<keyof typeof viGroups, string> = enGroups;
const admin: Record<keyof typeof viAdmin, string> = enAdmin;
const stats: Record<keyof typeof viStats, string> = enStats;
const toast: Record<keyof typeof viToast, string> = enToast;
const errors: Record<keyof typeof viErrors, string> = enErrors;

const en: Record<TranslationKey, string> = {
  ...common,
  ...auth,
  ...bills,
  ...restaurants,
  ...collections,
  ...groups,
  ...admin,
  ...stats,
  ...toast,
  ...errors,
};

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  vi,
  en,
};

export const LOCALE_STORAGE_KEY = 'ff-locale';

export const getStoredLocale = (): Locale => {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'en' || stored === 'vi') return stored;
  return 'vi';
};
