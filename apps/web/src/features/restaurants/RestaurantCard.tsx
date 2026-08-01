import { ExternalLink, MapPin, Store } from 'lucide-react';
import type { ReactNode } from 'react';

import type { RestaurantEntry } from '@/api/types';
import { useI18n } from '@/app/providers/i18n';

import PlatformLinkBadge from './PlatformLinkBadge';

interface RestaurantCardProps {
  restaurant: RestaurantEntry;
  onOpen: () => void;
  actions?: ReactNode;
  collectionType?: 'FAVORITES' | 'RECOMMENDED' | null;
}

export default function RestaurantCard({
  restaurant,
  onOpen,
  actions,
  collectionType = null,
}: RestaurantCardProps) {
  const { t } = useI18n();
  const cardTone =
    collectionType === 'FAVORITES'
      ? 'ticket-edge-chili border-chili/40 bg-chili/[0.04] dark:bg-chili/[0.08]'
      : collectionType === 'RECOMMENDED'
        ? 'ticket-edge-basil border-basil/40 bg-basil/[0.04] dark:bg-basil/[0.08]'
        : '';

  return (
    <article
      className={`ticket-edge panel min-w-0 overflow-hidden transition-shadow hover:shadow-md ${cardTone}`}
    >
      <button
        type="button"
        className="block w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chili focus-visible:ring-inset"
        onClick={onOpen}
      >
        <div className="flex min-w-0 gap-3 p-4 pb-3">
          {restaurant.avatarUrl ? (
            <img
              src={restaurant.avatarUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
              loading="lazy"
            />
          ) : (
            <div className="chip-saffron grid h-14 w-14 shrink-0 place-items-center rounded-xl">
              <Store size={22} aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-sm font-bold text-ink">
                {restaurant.name}
              </h3>
              <ExternalLink
                size={15}
                className="mt-0.5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
            </div>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-500">
              {restaurant.type}
            </p>
            <p className="mt-2 flex min-w-0 items-start gap-1 text-xs text-slate-500">
              <MapPin
                size={13}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{restaurant.address}</span>
            </p>
          </div>
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-3">
        {restaurant.cuisines?.slice(0, 4).map(({ cuisine, isPrimary }) => (
          <span
            key={cuisine.id}
            className={`chip max-w-full truncate ${isPrimary ? 'chip-saffron' : 'chip-muted'}`}
          >
            {cuisine.name}
          </span>
        ))}
        {restaurant.platformLinks?.slice(0, 3).map((link) => (
          <PlatformLinkBadge
            key={link.id ?? `${link.platform}-${link.url}`}
            platform={link.platform}
            label={link.label}
            className="max-w-full truncate"
          />
        ))}
        {(restaurant.isFavoritedByMe ?? restaurant.isFavorite) && (
          <span className="chip chip-badge chip-chili">
            {t('restaurants.favorite')}
          </span>
        )}
        {restaurant.isRecommended && (
          <span className="chip chip-badge chip-basil">
            {t('restaurants.recommended')}
          </span>
        )}
        {restaurant.status === 'ARCHIVED' && (
          <span className="chip chip-badge chip-muted">
            {t('restaurants.archived')}
          </span>
        )}
        {actions && (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1">
            {actions}
          </div>
        )}
      </div>
    </article>
  );
}
