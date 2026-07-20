import { createHash } from 'node:crypto';
import { z } from 'zod';
import vietnamAddressData from './data/vietnam-wards-full.json' with { type: 'json' };

export type AddressDirectoryItem = {
  code: string;
  name: string;
  aliases?: string[];
};

export type AddressDirectoryResult = {
  items: AddressDirectoryItem[];
  stale: false;
};

const EXPECTED_PROVINCES = 34;
const EXPECTED_WARDS = 3_321;

const wardSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.enum(['xã', 'phường', 'đặc khu']),
  })
  .passthrough();

const provinceSchema = z
  .object({
    province_name: z.string().trim().min(1),
    province_type: z.enum(['province', 'centrally-controlled city']),
    merged_from_province: z.array(z.string().trim().min(1)).nullable(),
    ward_count: z.number().int().nonnegative(),
    wards: z.array(wardSchema),
  })
  .passthrough();

const datasetSchema = z
  .object({
    effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    total_provinces: z.number().int().positive(),
    total_wards_communes: z.number().int().positive(),
    provinces: z.array(provinceSchema),
    incomplete_provinces: z.array(z.unknown()),
  })
  .passthrough();

const administrativeTypeLabels = {
  xã: 'Xã',
  phường: 'Phường',
  'đặc khu': 'Đặc khu',
} as const;

export const addressCodeSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (letter) => (letter === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const wardCode = (provinceName: string, type: string, name: string) => {
  const digest = createHash('sha256')
    .update(
      `${provinceName.normalize('NFC')}\0${type}\0${name.normalize('NFC')}`,
    )
    .digest('hex')
    .slice(0, 6);
  return `${addressCodeSlug(name)}-${digest}`;
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new Error(`Invalid Vietnam address dataset: ${message}`);
}

type AddressDirectoryIndex = {
  provinces: AddressDirectoryItem[];
  wardsByProvince: Map<string, AddressDirectoryItem[]>;
};

export const buildAddressDirectoryIndex = (
  input: unknown,
): AddressDirectoryIndex => {
  const dataset = datasetSchema.parse(input);
  invariant(
    dataset.total_provinces === EXPECTED_PROVINCES &&
      dataset.provinces.length === EXPECTED_PROVINCES,
    `expected ${EXPECTED_PROVINCES} provinces`,
  );
  invariant(
    dataset.effective_date === '2025-07-01',
    'expected effective date 2025-07-01',
  );
  invariant(
    dataset.total_wards_communes === EXPECTED_WARDS,
    `expected ${EXPECTED_WARDS} wards`,
  );
  invariant(
    dataset.incomplete_provinces.length === 0,
    'incomplete_provinces must be empty',
  );

  const provinceNames = new Set<string>();
  const provinceCodes = new Set<string>();
  const allWardCodes = new Set<string>();
  const wardsByProvince = new Map<string, AddressDirectoryItem[]>();
  let wardTotal = 0;

  const provinces = dataset.provinces.map((province) => {
    const code = `p-${addressCodeSlug(province.province_name)}`;
    invariant(
      code.length > 2,
      `could not generate a code for ${province.province_name}`,
    );
    invariant(
      !provinceNames.has(province.province_name),
      `duplicate province name ${province.province_name}`,
    );
    invariant(!provinceCodes.has(code), `duplicate province code ${code}`);
    provinceNames.add(province.province_name);
    provinceCodes.add(code);

    invariant(
      province.ward_count === province.wards.length,
      `ward count mismatch for ${province.province_name}`,
    );
    wardTotal += province.wards.length;
    const wardNames = new Set<string>();
    const wardCodes = new Set<string>();
    const wards = province.wards.map((ward) => {
      const name = `${administrativeTypeLabels[ward.type]} ${ward.name}`;
      const generatedCode = wardCode(
        province.province_name,
        ward.type,
        ward.name,
      );
      invariant(
        !wardNames.has(name),
        `duplicate ward name ${name} in ${province.province_name}`,
      );
      invariant(
        !wardCodes.has(generatedCode) && !allWardCodes.has(generatedCode),
        `duplicate ward code ${generatedCode}`,
      );
      wardNames.add(name);
      wardCodes.add(generatedCode);
      allWardCodes.add(generatedCode);
      return Object.freeze({ code: generatedCode, name });
    });
    wardsByProvince.set(code, Object.freeze(wards) as AddressDirectoryItem[]);

    const aliases = province.merged_from_province ?? [];
    return Object.freeze({
      code,
      name: province.province_name,
      ...(aliases.length > 0
        ? { aliases: Object.freeze([...aliases]) as string[] }
        : {}),
    });
  });

  invariant(wardTotal === EXPECTED_WARDS, `expected ${EXPECTED_WARDS} wards`);
  return {
    provinces: Object.freeze(provinces) as AddressDirectoryItem[],
    wardsByProvince,
  };
};

export class AddressProvinceNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'ADDRESS_PROVINCE_NOT_FOUND';

  constructor() {
    super('The requested Vietnamese province was not found');
  }
}

/** Application-owned, immutable directory backed by the bundled 2025 dataset. */
export class AddressDirectory {
  private readonly index: AddressDirectoryIndex;

  constructor(input: unknown = vietnamAddressData) {
    this.index = buildAddressDirectoryIndex(input);
  }

  getProvinces(): AddressDirectoryResult {
    return { items: this.index.provinces, stale: false };
  }

  getWards(provinceCode: string): AddressDirectoryResult {
    const wards = this.index.wardsByProvince.get(provinceCode);
    if (!wards) throw new AddressProvinceNotFoundError();
    return { items: wards, stale: false };
  }
}
