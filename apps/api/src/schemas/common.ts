import { z } from 'zod';

import { parseVietnamMobilePhone } from '@ff-restaurent/shared';

/**
 * Primitives shared across domain schemas: phone parsing, the Vietnam address
 * shape and its structural rule, and the URL schemas platform links build on.
 */

export const isoDateOnlySchema = z.string().date();

export const vietnamMobilePhoneSchema = z
  .union([z.string().max(40), z.null()])
  .transform((value, context) => {
    const result = parseVietnamMobilePhone(value);
    if (!result.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone must be a valid Vietnamese mobile number',
      });
      return z.NEVER;
    }
    return result.phone;
  });

export const vietnamAddressShape = {
  address: z.string().trim().min(1),
  addressLine: z.string().trim().min(1).nullable().optional(),
  provinceCode: z.string().trim().min(1).nullable().optional(),
  provinceName: z.string().trim().min(1).nullable().optional(),
  wardCode: z.string().trim().min(1).nullable().optional(),
  wardName: z.string().trim().min(1).nullable().optional(),
};

export const validateStructuredAddress = (
  value: Partial<z.infer<z.ZodObject<typeof vietnamAddressShape>>>,
  context: z.RefinementCtx,
) => {
  const structured = [
    value.addressLine,
    value.provinceCode,
    value.provinceName,
    value.wardCode,
    value.wardName,
  ];
  const supplied = structured.filter(
    (part) => typeof part === 'string' && part.length > 0,
  ).length;
  if (supplied !== 0 && supplied !== structured.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address'],
      message:
        'Structured addresses require an address line, province, and ward',
    });
  }
};

type VietnamAddressInput = Partial<
  Record<keyof typeof vietnamAddressShape, string | null | undefined>
>;

/** Builds the display snapshot server-side or clears stale structure for manual input. */
export const normalizeVietnamAddressSnapshot = <T extends VietnamAddressInput>(
  value: T,
): T => {
  const structured = [value.addressLine, value.wardName, value.provinceName];
  if (structured.every((part) => typeof part === 'string' && part.length > 0)) {
    return { ...value, address: structured.join(', ') };
  }
  if (value.address !== undefined) {
    return {
      ...value,
      addressLine: null,
      provinceCode: null,
      provinceName: null,
      wardCode: null,
      wardName: null,
    };
  }
  return value;
};

export const vietnamAddressSchema = z
  .object(vietnamAddressShape)
  .superRefine(validateStructuredAddress);

const normalizePlatformUrl = (value: string) => {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
};

export const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => {
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    },
    {
      message: 'URL must use HTTPS',
    },
  )
  .transform(normalizePlatformUrl);

export const optionalHttpsUrlSchema = z
  .union([httpsUrlSchema, z.literal(''), z.null()])
  .transform((value) => (value ? value : null));

export const legacyUrlSchema = z
  .string()
  .trim()
  .url()
  .transform(normalizePlatformUrl);
