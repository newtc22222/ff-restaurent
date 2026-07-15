import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';

export type VietnamMobilePhoneResult =
  | { success: true; phone: string | null }
  | { success: false; reason: 'INVALID_VIETNAM_MOBILE' };

/**
 * Accepts an optional Vietnamese mobile number and returns canonical E.164.
 * Empty input is the valid representation of an omitted optional phone.
 */
export const parseVietnamMobilePhone = (
  input: string | null | undefined,
): VietnamMobilePhoneResult => {
  const value = input?.trim() ?? '';
  if (!value) return { success: true, phone: null };

  const parsed = parsePhoneNumberFromString(value, 'VN');
  if (
    !parsed ||
    parsed.country !== 'VN' ||
    !parsed.isValid() ||
    parsed.getType() !== 'MOBILE'
  ) {
    return { success: false, reason: 'INVALID_VIETNAM_MOBILE' };
  }

  return { success: true, phone: parsed.number };
};
