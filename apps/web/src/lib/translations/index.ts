import { admin as viAdmin } from './vi/admin';
import { auth as viAuth } from './vi/auth';
import { bills as viBills } from './vi/bills';
import { collections as viCollections } from './vi/collections';
import { common as viCommon } from './vi/common';
import { errors as viErrors } from './vi/errors';
import { groups as viGroups } from './vi/groups';
import { restaurants as viRestaurants } from './vi/restaurants';
import { stats as viStats } from './vi/stats';
import { toast as viToast } from './vi/toast';

import { admin as enAdmin } from './en/admin';
import { auth as enAuth } from './en/auth';
import { bills as enBills } from './en/bills';
import { collections as enCollections } from './en/collections';
import { common as enCommon } from './en/common';
import { errors as enErrors } from './en/errors';
import { groups as enGroups } from './en/groups';
import { restaurants as enRestaurants } from './en/restaurants';
import { stats as enStats } from './en/stats';
import { toast as enToast } from './en/toast';

/**
 * Translation dictionaries, assembled from per-locale domain namespaces.
 *
 * Parity is enforced at two levels:
 *
 * 1. Each `en/<domain>.ts` module is `satisfies Record<keyof typeof vi<Domain>,
 *    string>`, so a key present in Vietnamese but missing from English is a
 *    compile error in that module.
 * 2. `translations.en` below is annotated with the Vietnamese key type, which
 *    catches a domain module that was added to one locale but not the other.
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

const en: Record<TranslationKey, string> = {
  ...enCommon,
  ...enAuth,
  ...enBills,
  ...enRestaurants,
  ...enCollections,
  ...enGroups,
  ...enAdmin,
  ...enStats,
  ...enToast,
  ...enErrors,
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
