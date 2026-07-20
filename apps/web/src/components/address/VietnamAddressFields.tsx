import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '../../app/providers/i18n';
import type { AddressDirectoryResult, VietnamAddress } from '../../lib/api';
import { session } from '../../lib/session';
import Dropdown from '../ui/Dropdown';

type DirectoryLoader = (path: string) => Promise<AddressDirectoryResult>;

const defaultLoader: DirectoryLoader = (path) =>
  session.api().request<AddressDirectoryResult>(path);

export const emptyVietnamAddress = (): VietnamAddress => ({
  address: '',
  addressLine: null,
  provinceCode: null,
  provinceName: null,
  wardCode: null,
  wardName: null,
});

export const isVietnamAddressComplete = (value: VietnamAddress) => {
  const structuredStarted = Boolean(
    value.addressLine || value.provinceCode || value.wardCode,
  );
  return (
    Boolean(value.address.trim()) &&
    (!structuredStarted ||
      Boolean(
        value.addressLine &&
        value.provinceCode &&
        value.provinceName &&
        value.wardCode &&
        value.wardName,
      ))
  );
};

const formatAddress = (value: VietnamAddress) =>
  [value.addressLine, value.wardName, value.provinceName]
    .filter(Boolean)
    .join(', ');

export const addressLookupKey = (value: string, kind: 'province' | 'ward') => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const prefix =
    kind === 'province'
      ? /^(?:tinh|thanh pho|tp)\s+/
      : /^(?:phuong|xa|thi tran|dac khu)\s+/;
  return normalized.replace(prefix, '').replace(/\s+/g, ' ');
};

type VietnamAddressFieldsProps = {
  value: VietnamAddress;
  onChange: (value: VietnamAddress) => void;
  loadDirectory?: DirectoryLoader;
};

/** Reusable structured/manual Vietnamese address control for location forms. */
export default function VietnamAddressFields({
  value,
  onChange,
  loadDirectory = defaultLoader,
}: VietnamAddressFieldsProps) {
  const { locale } = useI18n();
  const text =
    locale === 'vi'
      ? {
          address: 'Địa chỉ',
          addressLine: 'Số nhà, tên đường',
          province: 'Tỉnh / thành phố',
          ward: 'Phường / xã',
          chooseProvince: 'Chọn tỉnh / thành phố...',
          chooseWard: 'Chọn phường / xã...',
          searchProvince: 'Tìm tỉnh / thành phố...',
          searchWard: 'Tìm phường / xã...',
          noResults: 'Không tìm thấy kết quả',
          loading: 'Đang tải...',
          retry: 'Thử lại',
          unavailable: 'Không thể tải danh mục địa chỉ.',
          stale: 'Đang dùng danh mục đã lưu do nguồn dữ liệu chưa phản hồi.',
          legacyProvince:
            'Địa chỉ đã lưu dùng danh mục cũ. Hãy chọn lại tỉnh / thành phố và phường / xã hiện tại.',
          legacyWard:
            'Tỉnh / thành phố đã được cập nhật. Hãy chọn lại phường / xã hiện tại.',
          manual: 'Nhập địa chỉ thủ công',
          structured: 'Chọn địa chỉ có cấu trúc',
          manualPlaceholder: 'Nhập địa chỉ đầy đủ',
        }
      : {
          address: 'Address',
          addressLine: 'Street address',
          province: 'Province / city',
          ward: 'Ward',
          chooseProvince: 'Choose a province / city...',
          chooseWard: 'Choose a ward...',
          searchProvince: 'Search provinces / cities...',
          searchWard: 'Search wards...',
          noResults: 'No results found',
          loading: 'Loading...',
          retry: 'Retry',
          unavailable: 'The address directory could not be loaded.',
          stale: 'Using saved address data while the directory is unavailable.',
          legacyProvince:
            'This saved address uses the previous directory. Select its current province and ward.',
          legacyWard:
            'The province was updated. Select the current ward for this address.',
          manual: 'Enter address manually',
          structured: 'Choose a structured address',
          manualPlaceholder: 'Enter the complete address',
        };
  const [manual, setManual] = useState(
    Boolean(value.address) && !value.provinceCode,
  );
  const [provinces, setProvinces] = useState<AddressDirectoryResult['items']>(
    [],
  );
  const [wards, setWards] = useState<AddressDirectoryResult['items']>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [provinceError, setProvinceError] = useState(false);
  const [wardError, setWardError] = useState(false);
  const [stale, setStale] = useState(false);
  const [legacyIssue, setLegacyIssue] = useState<'province' | 'ward' | null>(
    null,
  );

  const commit = (next: VietnamAddress) =>
    onChange({ ...next, address: formatAddress(next) });

  const reportStale = useCallback(
    (result: AddressDirectoryResult) => {
      if (!result.stale) return;
      setStale(true);
      toast(text.stale, { id: 'address-directory-stale', icon: '⚠️' });
    },
    [text.stale],
  );

  const loadProvinces = useCallback(async () => {
    setLoadingProvinces(true);
    setProvinceError(false);
    try {
      const result = await loadDirectory('/address/provinces');
      setProvinces(result.items);
      reportStale(result);
      return result.items;
    } catch {
      setProvinceError(true);
      toast.error(text.unavailable, { id: 'address-directory-error' });
      return null;
    } finally {
      setLoadingProvinces(false);
    }
  }, [loadDirectory, reportStale, text.unavailable]);

  const loadWards = useCallback(
    async (provinceCode: string) => {
      setLoadingWards(true);
      setWardError(false);
      try {
        const result = await loadDirectory(
          `/address/provinces/${provinceCode}/wards`,
        );
        setWards(result.items);
        reportStale(result);
        return result.items;
      } catch {
        setWardError(true);
        toast.error(text.unavailable, { id: 'address-directory-error' });
        return null;
      } finally {
        setLoadingWards(false);
      }
    },
    [loadDirectory, reportStale, text.unavailable],
  );

  useEffect(() => {
    if (manual) return;
    let cancelled = false;
    void (async () => {
      const provinceItems = await loadProvinces();
      if (
        cancelled ||
        !provinceItems ||
        (!value.provinceCode && !value.provinceName)
      ) {
        return;
      }

      let province = provinceItems.find(
        (item) => item.code === value.provinceCode,
      );
      if (!province && value.provinceName) {
        const savedProvince = addressLookupKey(value.provinceName, 'province');
        province = provinceItems.find((item) =>
          [item.name, ...(item.aliases ?? [])].some(
            (name) => addressLookupKey(name, 'province') === savedProvince,
          ),
        );
      }

      if (!province) {
        setWards([]);
        setLegacyIssue('province');
        onChange({
          ...value,
          provinceCode: null,
          provinceName: null,
          wardCode: null,
          wardName: null,
        });
        return;
      }

      const wardItems = await loadWards(province.code);
      if (cancelled || !wardItems) return;
      let ward = wardItems.find((item) => item.code === value.wardCode);
      if (!ward && value.wardName) {
        const savedWard = addressLookupKey(value.wardName, 'ward');
        ward = wardItems.find(
          (item) => addressLookupKey(item.name, 'ward') === savedWard,
        );
      }

      if (!ward) {
        setLegacyIssue('ward');
        onChange({
          ...value,
          provinceCode: province.code,
          provinceName: province.name,
          wardCode: null,
          wardName: null,
        });
        return;
      }

      if (
        province.code !== value.provinceCode ||
        province.name !== value.provinceName ||
        ward.code !== value.wardCode ||
        ward.name !== value.wardName
      ) {
        commit({
          ...value,
          provinceCode: province.code,
          provinceName: province.name,
          wardCode: ward.code,
          wardName: ward.name,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manual]);

  const chooseProvince = (provinceCode: string) => {
    const province = provinces.find((item) => item.code === provinceCode);
    const next = {
      ...value,
      provinceCode: province?.code ?? null,
      provinceName: province?.name ?? null,
      wardCode: null,
      wardName: null,
    };
    setWards([]);
    setWardError(false);
    if (legacyIssue === 'province') setLegacyIssue('ward');
    commit(next);
    if (province) void loadWards(province.code);
  };

  const chooseWard = (wardCode: string) => {
    const ward = wards.find((item) => item.code === wardCode);
    commit({
      ...value,
      wardCode: ward?.code ?? null,
      wardName: ward?.name ?? null,
    });
    setLegacyIssue(null);
  };

  const toggleMode = () => {
    const nextManual = !manual;
    setManual(nextManual);
    setProvinceError(false);
    setWardError(false);
    setLegacyIssue(null);
    if (nextManual) {
      onChange({
        address: value.address,
        addressLine: null,
        provinceCode: null,
        provinceName: null,
        wardCode: null,
        wardName: null,
      });
    } else {
      onChange(emptyVietnamAddress());
    }
  };

  return (
    <fieldset className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="label">{text.address}</legend>
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-ink hover:underline"
          onClick={toggleMode}
        >
          {manual ? text.structured : text.manual}
        </button>
      </div>

      {manual ? (
        <input
          aria-label={text.address}
          className="field w-full"
          placeholder={text.manualPlaceholder}
          required
          value={value.address}
          onChange={(event) =>
            onChange({ ...value, address: event.target.value })
          }
        />
      ) : (
        <>
          <input
            aria-label={text.addressLine}
            className="field w-full"
            placeholder={text.addressLine}
            required
            value={value.addressLine ?? ''}
            onChange={(event) =>
              commit({ ...value, addressLine: event.target.value || null })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="label">{text.province}</span>
              <Dropdown
                fullWidth
                searchable
                disabled={loadingProvinces || provinceError}
                label={loadingProvinces ? text.loading : text.chooseProvince}
                ariaLabel={text.province}
                value={value.provinceCode ?? ''}
                onChange={chooseProvince}
                options={provinces.map((item) => ({
                  value: item.code,
                  label: item.name,
                  searchText: [item.name, ...(item.aliases ?? [])].join(' '),
                }))}
                searchPlaceholder={text.searchProvince}
                emptyMessage={text.noResults}
              />
              {provinceError && (
                <button
                  type="button"
                  className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                  onClick={() => void loadProvinces()}
                >
                  {text.unavailable} {text.retry}
                </button>
              )}
            </div>
            <div className="space-y-1">
              <span className="label">{text.ward}</span>
              <Dropdown
                fullWidth
                searchable
                disabled={!value.provinceCode || loadingWards || wardError}
                label={loadingWards ? text.loading : text.chooseWard}
                ariaLabel={text.ward}
                value={value.wardCode ?? ''}
                onChange={chooseWard}
                options={wards.map((item) => ({
                  value: item.code,
                  label: item.name,
                }))}
                searchPlaceholder={text.searchWard}
                emptyMessage={text.noResults}
              />
              {wardError && value.provinceCode && (
                <button
                  type="button"
                  className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                  onClick={() => void loadWards(value.provinceCode ?? '')}
                >
                  {text.unavailable} {text.retry}
                </button>
              )}
            </div>
          </div>
          {stale && (
            <p
              role="status"
              className="text-xs text-amber-700 dark:text-amber-300"
            >
              {text.stale}
            </p>
          )}
          {legacyIssue && (
            <p
              role="status"
              className="text-xs text-amber-700 dark:text-amber-300"
            >
              {legacyIssue === 'province'
                ? text.legacyProvince
                : text.legacyWard}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
