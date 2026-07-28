import { ChevronDown, ChevronUp, Link2, Plus, Trash2 } from 'lucide-react';
import { RESTAURANT_PLATFORM_VALUES } from '@ff-restaurent/shared';
import { useI18n } from '@/app/providers/i18n';
import type { RestaurantPlatform, RestaurantPlatformLink } from '@/api/types';
import Dropdown from '@/components/ui/Dropdown';

const platforms: readonly RestaurantPlatform[] = RESTAURANT_PLATFORM_VALUES;

/**
 * Brand-cased display names. Typing this as a total Record means adding a
 * platform in @ff-restaurent/shared fails the build here until it has a label,
 * rather than silently rendering undefined.
 */
const PLATFORM_LABELS: Record<RestaurantPlatform, string> = {
  GRAB: 'Grab',
  SHOPEE_FOOD: 'ShopeeFood',
  BE_FOOD: 'beFood',
  GOJEK: 'Gojek',
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  OTHER: 'Other',
};

export const platformLabel = (platform: RestaurantPlatform) =>
  PLATFORM_LABELS[platform];

const normalizedUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString().toLocaleLowerCase();
  } catch {
    return null;
  }
};

export const arePlatformLinksValid = (links: RestaurantPlatformLink[]) => {
  const urls = new Set<string>();
  const namedPlatforms = new Set<RestaurantPlatform>();
  for (const link of links) {
    const url = normalizedUrl(link.url);
    if (!url || urls.has(url)) return false;
    urls.add(url);
    if (link.platform === 'OTHER') {
      if (!link.label?.trim()) return false;
      continue;
    }
    if (namedPlatforms.has(link.platform)) return false;
    namedPlatforms.add(link.platform);
  }
  return true;
};

export default function PlatformLinksEditor({
  links,
  onChange,
}: {
  links: RestaurantPlatformLink[];
  onChange: (links: RestaurantPlatformLink[]) => void;
}) {
  const { t } = useI18n();
  const update = (index: number, patch: Partial<RestaurantPlatformLink>) =>
    onChange(
      links.map((link, current) =>
        current === index ? { ...link, ...patch } : link,
      ),
    );
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <fieldset className="field-group">
      <div className="flex items-center justify-between gap-3">
        <legend className="field-group-title">
          <Link2 size={13} aria-hidden="true" />
          {t('restaurants.platformLinks')}
        </legend>
        <button
          type="button"
          className="btn btn-soft h-8 gap-1.5 px-2.5 text-xs"
          disabled={links.length >= 20}
          onClick={() =>
            onChange([...links, { platform: 'WEBSITE', url: '', label: null }])
          }
        >
          <Plus size={12} /> {t('restaurants.addLink')}
        </button>
      </div>
      {links.map((link, index) => (
        <div
          key={link.id ?? index}
          className="space-y-2 rounded-lg border border-border bg-surface p-3"
        >
          <div className="flex gap-2">
            <Dropdown
              fullWidth
              label={t('restaurants.platform')}
              ariaLabel={`${t('restaurants.platform')} ${index + 1}`}
              value={link.platform}
              onChange={(platform) =>
                update(index, {
                  platform: platform as RestaurantPlatform,
                  label: platform === 'OTHER' ? link.label : null,
                })
              }
              options={platforms.map((platform) => ({
                value: platform,
                label: platformLabel(platform),
              }))}
            />
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`${t('restaurants.moveUp')} ${index + 1}`}
                className="btn btn-soft h-10 w-12 p-0"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                aria-label={`${t('restaurants.moveDown')} ${index + 1}`}
                className="btn btn-soft h-10 p-0"
                disabled={index === links.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDown size={13} />
              </button>
              <button
                type="button"
                aria-label={`${t('restaurants.removeLink')} ${index + 1}`}
                className="btn btn-soft h-10 p-0 text-red-500"
                onClick={() =>
                  onChange(links.filter((_, current) => current !== index))
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {link.platform === 'OTHER' && (
            <input
              aria-label={`${t('restaurants.customLabel')} ${index + 1}`}
              className="field w-full"
              maxLength={60}
              placeholder={t('restaurants.customLabel')}
              value={link.label ?? ''}
              onChange={(event) => update(index, { label: event.target.value })}
            />
          )}
          <input
            aria-label={`${t('restaurants.linkUrl')} ${index + 1}`}
            className="field w-full"
            inputMode="url"
            placeholder="https://"
            type="url"
            value={link.url}
            onChange={(event) => update(index, { url: event.target.value })}
          />
        </div>
      ))}
      {links.length > 0 && !arePlatformLinksValid(links) && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {t('restaurants.invalidPlatformLinks')}
        </p>
      )}
    </fieldset>
  );
}
