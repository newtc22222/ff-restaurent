import assert from 'node:assert/strict';
import test from 'node:test';
import vietnamAddressData from './data/vietnam-wards-full.json' with { type: 'json' };
import {
  AddressDirectory,
  AddressProvinceNotFoundError,
  buildAddressDirectoryIndex,
} from './address-directory.js';

const cloneDataset = () =>
  JSON.parse(JSON.stringify(vietnamAddressData)) as typeof vietnamAddressData;

test('loads the complete bundled 2025 province and ward directory', () => {
  const directory = new AddressDirectory();
  const provinces = directory.getProvinces();

  assert.equal(provinces.stale, false);
  assert.equal(provinces.items.length, 34);
  assert.equal(
    provinces.items.reduce(
      (total, province) =>
        total + directory.getWards(province.code).items.length,
      0,
    ),
    3_321,
  );
});

test('uses stable local codes, merged aliases, and full administrative labels', () => {
  const first = new AddressDirectory();
  const second = new AddressDirectory();
  assert.deepEqual(first.getProvinces(), second.getProvinces());

  const hoChiMinh = first
    .getProvinces()
    .items.find((province) => province.name === 'Thành phố Hồ Chí Minh');
  assert.deepEqual(hoChiMinh, {
    code: 'p-thanh-pho-ho-chi-minh',
    name: 'Thành phố Hồ Chí Minh',
    aliases: ['Bình Dương', 'Bà Rịa - Vũng Tàu'],
  });

  const wards = first.getWards(hoChiMinh!.code).items;
  assert.equal(wards.length, 168);
  assert.equal(
    wards.some((ward) => ward.name === 'Phường Sài Gòn'),
    true,
  );
  assert.equal(
    wards.some((ward) => ward.name === 'Đặc khu Côn Đảo'),
    true,
  );
  assert.equal(new Set(wards.map((ward) => ward.code)).size, wards.length);
});

test('rejects an unknown local province with a stable not-found error', () => {
  const directory = new AddressDirectory();
  assert.throws(
    () => directory.getWards('p-not-a-province'),
    (error: unknown) =>
      error instanceof AddressProvinceNotFoundError &&
      error.code === 'ADDRESS_PROVINCE_NOT_FOUND' &&
      error.statusCode === 404,
  );
});

test('rejects incomplete or internally inconsistent bundled datasets', () => {
  const incomplete = cloneDataset();
  (incomplete.incomplete_provinces as unknown[]).push('Missing province');
  assert.throws(
    () => buildAddressDirectoryIndex(incomplete),
    /incomplete_provinces must be empty/,
  );

  const badWardCount = cloneDataset();
  badWardCount.provinces[0]!.ward_count += 1;
  assert.throws(
    () => buildAddressDirectoryIndex(badWardCount),
    /ward count mismatch/,
  );

  const duplicateProvince = cloneDataset();
  duplicateProvince.provinces[1]!.province_name =
    duplicateProvince.provinces[0]!.province_name;
  assert.throws(
    () => buildAddressDirectoryIndex(duplicateProvince),
    /duplicate province name/,
  );
});
