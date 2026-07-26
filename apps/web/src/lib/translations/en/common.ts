import type { common as viCommon } from '../vi/common';

/**
 * English strings for the common namespace.
 *
 * `satisfies` against the Vietnamese module makes a missing or misspelled
 * key a compile error, so the two locales cannot drift apart.
 */

export const common = {
  'language.english': 'English',
  'language.vietnamese': 'Vietnamese',
  'app.name': 'FF RESTaurent',
  'app.tagline': 'Track group restaurant bills, payment status, and spending.',
  'nav.bills': 'Bills',
  'nav.restaurants': 'Restaurants',
  'nav.collections': 'Collections',
  'nav.participantGroups': 'Participant groups',
  'nav.stats': 'Stats',
  'nav.notifications': 'Notifications',
  'nav.menu': 'Options',
  'nav.language': 'Language',
  'nav.theme': 'Theme',
  'notifications.empty': 'No notifications yet.',
  'notifications.markAllRead': 'Mark all read',
  'nav.members': 'Members',
  'media.choose': 'Choose image',
  'media.replace': 'Replace',
  'media.remove': 'Remove',
  'media.formats': 'JPEG, PNG or WebP',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'common.loading': 'Loading latest data...',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.add': 'Add',
  'common.step': 'Step',
  'common.remove': 'Remove',
  'common.confirm': 'Confirm',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.nextPage': 'Next page',
  'common.previousPage': 'Previous page',
  'common.rows': 'rows',
  'common.rowsPerPage': 'Rows per page',
} as const satisfies Record<keyof typeof viCommon, string>;
