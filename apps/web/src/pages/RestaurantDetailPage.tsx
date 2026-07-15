import { ExternalLink, Heart, Pencil, ThumbsUp } from 'lucide-react';
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
  const [editingAddress, setEditingAddress] = useState(false);
  const [address, setAddress] = useState<VietnamAddress>(() => ({
    address: restaurant?.address ?? '',
    addressLine: restaurant?.addressLine ?? null,
    provinceCode: restaurant?.provinceCode ?? null,
    provinceName: restaurant?.provinceName ?? null,
    wardCode: restaurant?.wardCode ?? null,
    wardName: restaurant?.wardName ?? null,
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

  const saveAddress = () =>
    mutate(
      { intent: 'update-restaurant', payload: address },
      {
        fallback:
          locale === 'vi'
            ? 'Không thể cập nhật địa chỉ.'
            : 'Could not update the address.',
        success: locale === 'vi' ? 'Đã cập nhật địa chỉ.' : 'Address updated.',
        onSuccess: () => setEditingAddress(false),
      },
    );

  return (
    <div className="mx-auto w-full max-w-2xl py-2">
      <BackButton onClick={onBack} label={t('nav.restaurants')} />

      <section className="panel p-6">
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

        {canChef(user) && !editingAddress && (
          <button
            className="btn btn-soft mb-4 flex items-center gap-2"
            onClick={() => setEditingAddress(true)}
          >
            <Pencil size={13} />
            {locale === 'vi' ? 'Sửa địa chỉ' : 'Edit address'}
          </button>
        )}

        {editingAddress && (
          <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <VietnamAddressFields value={address} onChange={setAddress} />
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-soft"
                onClick={() => setEditingAddress(false)}
              >
                {locale === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary"
                disabled={!isVietnamAddressComplete(address)}
                onClick={() => void saveAddress()}
              >
                {locale === 'vi' ? 'Lưu địa chỉ' : 'Save address'}
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

        {restaurant.links && restaurant.links.length > 0 && (
          <div className="mb-4">
            <h3 className="label mb-2">Links</h3>
            <div className="flex flex-wrap gap-2">
              {restaurant.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-muted"
                >
                  <ExternalLink size={12} /> {link.label || link.url}
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
