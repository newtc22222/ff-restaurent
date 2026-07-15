import { ExternalLink, Heart, Pencil, Phone, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { canChef, isHead } from '../lib/helpers';
import type { VietnamAddress } from '../lib/api';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import BackButton from '../components/ui/BackButton';
import VietnamAddressFields, {
  isVietnamAddressComplete,
} from '../components/address/VietnamAddressFields';
import RestaurantProfileFields, {
  isRestaurantProfileValid,
  type RestaurantProfileDraft,
} from '../components/restaurants/RestaurantProfileFields';
import RestaurantBanner from '../components/restaurants/RestaurantBanner';
import { platformLabel } from '../components/restaurants/PlatformLinksEditor';

/**
 * RestaurantDetailPage displays comprehensive information about a restaurant including its links,
 * and enables managers to archive/restore entries.
 */
export default function RestaurantDetailPage() {
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const { user, restaurants } = useAppContext();
  const { locale, t } = useI18n();
  const { mutate } = useMutation();

  const restaurant = restaurants.find(
    (candidate) => candidate.id === restaurantId,
  );
  const [editingProfile, setEditingProfile] = useState(false);
  const [address, setAddress] = useState<VietnamAddress>(() => ({
    address: restaurant?.address ?? '',
    addressLine: restaurant?.addressLine ?? null,
    provinceCode: restaurant?.provinceCode ?? null,
    provinceName: restaurant?.provinceName ?? null,
    wardCode: restaurant?.wardCode ?? null,
    wardName: restaurant?.wardName ?? null,
  }));
  const [profile, setProfile] = useState<RestaurantProfileDraft>(() => ({
    phone: restaurant?.phone ?? '',
    bannerImageUrl: restaurant?.bannerImageUrl ?? '',
    platformLinks: restaurant?.platformLinks ?? [],
  }));
  if (!restaurant) return <Navigate to="/restaurants" replace />;

  const onBack = () => navigate('/restaurants');

  const toggleFavorite = () =>
    mutate(
      { intent: 'restaurant-favorite' },
      {
        fallback: t('toast.favoriteFailed'),
        success: t('toast.favoriteUpdated'),
      },
    );

  const runAction = (
    status: 'archive' | 'restore',
    fallback: string,
    success: string,
  ) =>
    mutate(
      { intent: 'restaurant-status', status },
      { fallback, success, onSuccess: onBack },
    );

  const saveProfile = () =>
    mutate(
      {
        intent: 'update-restaurant',
        payload: {
          ...address,
          phone: profile.phone.trim() || null,
          bannerImageUrl: profile.bannerImageUrl.trim() || null,
          platformLinks: profile.platformLinks.map(
            ({ platform, label, url }) => ({ platform, label, url }),
          ),
        },
      },
      {
        fallback:
          locale === 'vi'
            ? 'Không thể cập nhật hồ sơ địa điểm.'
            : 'Could not update the restaurant profile.',
        success:
          locale === 'vi'
            ? 'Đã cập nhật hồ sơ địa điểm.'
            : 'Restaurant profile updated.',
        onSuccess: () => setEditingProfile(false),
      },
    );

  return (
    <div className="mx-auto w-full max-w-2xl py-2">
      <BackButton onClick={onBack} label={t('nav.restaurants')} />

      <section className="panel p-6">
        <RestaurantBanner
          name={restaurant.name}
          url={restaurant.bannerImageUrl}
        />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[22px] font-bold text-ink">
              {restaurant.name}
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {restaurant.type} / {restaurant.cuisineType}
            </p>
            <p className="mt-1 text-[14px]">{restaurant.address}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${
              restaurant.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
            }`}
          >
            {restaurant.status}
          </span>
        </div>

        {canChef(user) && !editingProfile && (
          <button
            className="btn btn-soft mb-4 flex items-center gap-2"
            onClick={() => setEditingProfile(true)}
          >
            <Pencil size={13} />
            {locale === 'vi' ? 'Sửa hồ sơ' : 'Edit profile'}
          </button>
        )}

        {editingProfile && (
          <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <VietnamAddressFields value={address} onChange={setAddress} />
            <RestaurantProfileFields value={profile} onChange={setProfile} />
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-soft"
                onClick={() => setEditingProfile(false)}
              >
                {locale === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary"
                disabled={
                  !isVietnamAddressComplete(address) ||
                  !isRestaurantProfileValid(profile)
                }
                onClick={() => void saveProfile()}
              >
                {locale === 'vi' ? 'Lưu hồ sơ' : 'Save profile'}
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all ${
              restaurant.isFavoritedByMe
                ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950 dark:text-red-400'
                : 'border-border text-slate-500 hover:text-ink'
            }`}
            onClick={toggleFavorite}
          >
            <Heart
              size={14}
              fill={restaurant.isFavoritedByMe ? 'currentColor' : 'none'}
            />
            {restaurant.isFavoritedByMe
              ? '♥ ' + t('restaurants.favorite')
              : t('restaurants.favorite')}
          </button>
          {restaurant.isRecommended && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <ThumbsUp size={14} /> {t('restaurants.recommended')}
            </span>
          )}
        </div>

        {restaurant.phone && (
          <a
            className="mb-4 flex w-fit items-center gap-2 text-sm font-semibold text-ink hover:underline"
            href={`tel:${restaurant.phone}`}
          >
            <Phone aria-hidden="true" size={14} /> {restaurant.phone}
          </a>
        )}

        {(restaurant.platformLinks?.length ?? 0) > 0 && (
          <div className="mb-4">
            <h3 className="label mb-2">Links</h3>
            <div className="flex flex-wrap gap-2">
              {restaurant.platformLinks?.map((link) => (
                <a
                  key={link.id ?? `${link.platform}:${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-muted"
                >
                  <ExternalLink aria-hidden="true" size={12} />{' '}
                  {link.label || platformLabel(link.platform)}
                </a>
              ))}
            </div>
          </div>
        )}

        {isHead(user) && (
          <div className="flex gap-3 border-t border-muted pt-4">
            {restaurant.status === 'ACTIVE' && (
              <button
                className="btn btn-soft flex-1 hover:border-red-300 hover:text-red-500"
                onClick={() =>
                  runAction(
                    'archive',
                    t('toast.restaurantArchiveFailed'),
                    t('toast.restaurantArchived'),
                  )
                }
              >
                {t('bills.archive')}
              </button>
            )}
            {restaurant.status === 'ARCHIVED' && (
              <button
                className="btn btn-soft flex-1 hover:border-emerald-300 hover:text-emerald-500"
                onClick={() =>
                  runAction(
                    'restore',
                    t('toast.restaurantRestoreFailed'),
                    t('toast.restaurantRestored'),
                  )
                }
              >
                {t('bills.restore')}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
