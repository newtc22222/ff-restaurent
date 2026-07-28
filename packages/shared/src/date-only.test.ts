import { describe, expect, it } from 'vitest';
import {
  formatDateOnlyInTimeZone,
  formatIsoDateOnly,
  parseIsoDateOnly,
  todayInHoChiMinh,
} from './date-only.js';

describe('date-only values', () => {
  it('round trips ISO dates without local timezone conversion', () => {
    expect(formatIsoDateOnly(parseIsoDateOnly('2026-07-28'))).toBe(
      '2026-07-28',
    );
    expect(() => parseIsoDateOnly('2026-02-31')).toThrow(/valid calendar date/);
    expect(() => parseIsoDateOnly('07/28/2026')).toThrow(/YYYY-MM-DD/);
  });

  it('crosses the Ho Chi Minh calendar date at UTC+07:00', () => {
    const beforeMidnight = new Date('2026-07-15T16:59:59.999Z');
    const afterMidnight = new Date('2026-07-15T17:00:00.000Z');

    expect(todayInHoChiMinh(beforeMidnight)).toBe('2026-07-15');
    expect(todayInHoChiMinh(afterMidnight)).toBe('2026-07-16');
    expect(formatDateOnlyInTimeZone(afterMidnight, 'UTC')).toBe('2026-07-15');
  });
});
