import { Phone } from 'lucide-react';
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

export const isRestaurantProfileValid = (value: RestaurantProfileDraft) =>
  parseVietnamMobilePhone(value.phone).success &&
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
  return (
    <div className="space-y-3">
      <div className="field-group">
        <p className="field-group-title">
          <Phone size={13} aria-hidden="true" />
          {locale === 'vi' ? 'Liên hệ' : 'Contact'}
        </p>
        <label className="block space-y-1">
          <span className="label">
            {locale === 'vi'
              ? 'Điện thoại (không bắt buộc)'
              : 'Phone (optional)'}
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
      </div>
      <PlatformLinksEditor
        links={value.platformLinks}
        onChange={(platformLinks) => onChange({ ...value, platformLinks })}
      />
    </div>
  );
}
