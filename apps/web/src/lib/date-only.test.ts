import { describe, expect, it } from 'vitest';

import {
  formatDateOnlyForLocale,
  formatLocalDateOnly,
  parseLocalDateOnly,
} from './date-only';

describe('date-only display helpers', () => {
  it('round-trips a calendar date without applying a UTC offset', () => {
    const date = parseLocalDateOnly('2026-01-01');

    expect(formatLocalDateOnly(date)).toBe('2026-01-01');
    expect(formatDateOnlyForLocale('2026-01-01', 'en')).toBe('Jan 1, 2026');
  });
});
