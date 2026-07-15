import { parseVietnamMobilePhone } from '@ff-restaurent/shared';
import { useI18n } from '../../app/providers/i18n';
import type { RestaurantPlatformLink } from '../../lib/api';
import PlatformLinksEditor, {
  arePlatformLinksValid,
} from './PlatformLinksEditor';

export type RestaurantProfileDraft = {
  phone: string;
  bannerImageUrl: string;
  platformLinks: RestaurantPlatformLink[];
};

export const emptyRestaurantProfile = (): RestaurantProfileDraft => ({
  phone: '',
  bannerImageUrl: '',
  platformLinks: [],
});

const validHttps = (value: string) => {
  if (!value.trim()) return true;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
};

export const isRestaurantProfileValid = (value: RestaurantProfileDraft) =>
  parseVietnamMobilePhone(value.phone).success &&
  validHttps(value.bannerImageUrl) &&
  arePlatformLinksValid(value.platformLinks);

export default function RestaurantProfileFields({
  value,
  onChange,
}: {
  value: RestaurantProfileDraft;
  onChange: (value: RestaurantProfileDraft) => void;
}) {
  const { locale } = useI18n();
  const phone = parseVietnamMobilePhone(value.phone);
  const bannerValid = validHttps(value.bannerImageUrl);
  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="label">
          {locale === 'vi' ? 'Điện thoại (không bắt buộc)' : 'Phone (optional)'}
        </span>
        <input
          className="field w-full"
          inputMode="tel"
          value={value.phone}
          onChange={(event) =>
            onChange({ ...value, phone: event.target.value })
          }
        />
        {!phone.success && (
          <span className="block text-xs text-red-600 dark:text-red-400">
            {locale === 'vi'
              ? 'Nhập số di động Việt Nam hợp lệ.'
              : 'Enter a valid Vietnamese mobile number.'}
          </span>
        )}
      </label>
      <label className="block space-y-1">
        <span className="label">
          {locale === 'vi' ? 'URL ảnh bìa' : 'Banner image URL'}
        </span>
        <input
          className="field w-full"
          inputMode="url"
          placeholder="https://"
          type="url"
          value={value.bannerImageUrl}
          onChange={(event) =>
            onChange({ ...value, bannerImageUrl: event.target.value })
          }
        />
        {!bannerValid && (
          <span className="block text-xs text-red-600 dark:text-red-400">
            {locale === 'vi'
              ? 'Ảnh bìa phải dùng URL HTTPS.'
              : 'The banner must use an HTTPS URL.'}
          </span>
        )}
      </label>
      <PlatformLinksEditor
        links={value.platformLinks}
        onChange={(platformLinks) => onChange({ ...value, platformLinks })}
      />
    </div>
  );
}
