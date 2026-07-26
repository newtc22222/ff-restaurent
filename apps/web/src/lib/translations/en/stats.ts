import type { stats as viStats } from '../vi/stats';

/**
 * English strings for the stats namespace.
 *
 * `satisfies` against the Vietnamese module makes a missing or misspelled
 * key a compile error, so the two locales cannot drift apart.
 */

export const stats = {
  'stats.title': 'Personal statistics',
  'stats.subtitle': 'Spend grouped by payment, cuisine, entry, and period.',
  'stats.range': 'Date range',
  'stats.custom': 'Custom dates',
  'stats.from': 'From',
  'stats.to': 'To',
  'stats.applyRange': 'Apply',
  'stats.invalidRange': 'The end date must be on or after the start date.',
  'stats.paid': 'Paid',
  'stats.waiting': 'Waiting',
  'stats.totalObligation': 'Total obligation',
  'stats.totalPeriod': 'Total in selected period',
  'stats.paymentStatus': 'Payment status',
  'stats.cuisineType': 'Cuisine type',
  'stats.restaurant': 'Restaurant / Eatery',
  'stats.monthlyTrend': 'Monthly trend',
  'stats.spendingTrend': 'Spending trend',
  'stats.noStats': 'No statistics yet',
  'stats.noStatsDesc':
    'There are no payment obligations in the selected date range.',
  'stats.weekly': 'Weekly',
  'stats.monthly': 'Monthly',
  'stats.yearly': 'Yearly',
  'stats.frequency': 'Frequency',
  'stats.frequencyRestaurant': 'Restaurant frequency',
  'stats.frequencyCuisine': 'Cuisine frequency',
} as const satisfies Record<keyof typeof viStats, string>;
