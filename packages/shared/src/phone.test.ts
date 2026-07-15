import { describe, expect, it } from 'vitest';
import { parseVietnamMobilePhone } from './phone';

describe('parseVietnamMobilePhone', () => {
  it.each([
    ['0901234567', '+84901234567'],
    ['+84 90 123 4567', '+84901234567'],
    [' 0901-234-567 ', '+84901234567'],
  ])('normalizes %s to %s', (input, phone) => {
    expect(parseVietnamMobilePhone(input)).toEqual({ success: true, phone });
  });

  it('accepts an empty optional phone', () => {
    expect(parseVietnamMobilePhone('  ')).toEqual({
      success: true,
      phone: null,
    });
  });

  it.each(['0123456789', '+12025550123', '02812345678', 'not-a-phone'])(
    'rejects non-Vietnamese-mobile input %s',
    (input) => {
      expect(parseVietnamMobilePhone(input)).toEqual({
        success: false,
        reason: 'INVALID_VIETNAM_MOBILE',
      });
    },
  );
});
