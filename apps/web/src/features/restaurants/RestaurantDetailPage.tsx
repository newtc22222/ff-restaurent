import { ExternalLink, Images, Layers, Pencil, Phone } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router';

import type { RestaurantDetailData, VietnamAddress } from '@/api/types';
import { useAppContext } from '@/app/providers/app-context';
import { useI18n } from '@/app/providers/i18n';
import BackButton from '@/components/ui/BackButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Dropdown from '@/components/ui/Dropdown';
import ImagePicker from '@/components/ui/ImagePicker';
import VietnamAddressFields, {
  isVietnamAddressComplete,
} from '@/features/address/VietnamAddressFields';
import { useRouteMutation } from '@/hooks/useRouteMutation';
import { canChef, isHead } from '@/lib/permissions';

import { platformLabel } from './PlatformLinksEditor';
import RestaurantBanner from './RestaurantBanner';
import RestaurantCatalogFields, {
  type RestaurantCatalogValue,
} from './RestaurantCatalogFields';
import RestaurantFeedback from './RestaurantFeedback';
import RestaurantProfileFields, {
  type RestaurantProfileDraft,
  isRestaurantProfileValid,
} from './RestaurantProfileFields';
import { useRestaurantMediaMutation } from './restaurant-media.mutations';

/**
 * RestaurantDetailPage displays comprehensive information about a restaurant including its links,
 * and enables managers to archive/restore entries.
 */
export default function RestaurantDetailPage() {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { user } = useAppContext();
  const { t } = useI18n();
  const { fetcher, mutate } = useRouteMutation();
  const restaurantMediaMutation = useRestaurantMediaMutation();
  const { restaurant, feedback, collections } =
    useLoaderData() as RestaurantDetailData;
  const [editingProfile, setEditingProfile] = useState(false);
  const [media, setMedia] = useState<{
    logo: File | null;
    banner: File | null;
  }>({ logo: null, banner: null });
  const [confirmStatus, setConfirmStatus] = useState<
    'archive' | 'restore' | null
  >(null);
  const [address, setAddress] = useState<VietnamAddress>(() => ({
    address: restaurant.address,
    addressLine: restaurant.addressLine ?? null,
    provinceCode: restaurant.provinceCode ?? null,
    provinceName: restaurant.provinceName ?? null,
    wardCode: restaurant.wardCode ?? null,
    wardName: restaurant.wardName ?? null,
  }));
  const [profile, setProfile] = useState<RestaurantProfileDraft>(() => ({
    phone: restaurant.phone ?? '',
    bannerImageUrl: restaurant.bannerImageUrl ?? '',
    platformLinks: restaurant.platformLinks ?? [],
  }));
  const [catalogs, setCatalogs] = useState<RestaurantCatalogValue>(() => ({
    cuisineIds: restaurant.cuisines?.map((item) => item.cuisine.id) ?? [],
    primaryCuisineId:
      restaurant.cuisines?.find((item) => item.isPrimary)?.cuisine.id ?? '',
    diningAreaId: restaurant.diningAreaId ?? null,
  }));
  const [primaryCuisineName, setPrimaryCuisineName] = useState(
    restaurant.cuisines?.find((item) => item.isPrimary)?.cuisine.name ??
      restaurant.cuisineType ??
      '',
  );
  const manageableCollections = collections.filter(
    (collection) =>
      collection.ownerId === user.id ||
      (canChef(user) && collection.systemType === 'RECOMMENDED'),
  );
  const manageableCollectionIds = new Set(
    manageableCollections.map(({ id }) => id),
  );
  const [collectionIds, setCollectionIds] = useState(() =>
    restaurant.collections
      .map(({ id }) => id)
      .filter((id) => manageableCollectionIds.has(id)),
  );

  const onBack = () => navigate('/restaurants');

  const runAction = (
    status: 'archive' | 'restore',
    fallback: string,
    success: string,
  ) =>
    mutate(
      { intent: 'restaurant-status', status },
      { fallback, success, onSuccess: onBack },
    );

  const finishProfileSave = async () => {
    try {
      for (const [kind, file] of Object.entries(media) as Array<
        ['logo' | 'banner', File | null]
      >) {
        if (!file) continue;
        await restaurantMediaMutation.mutateAsync({
          action: 'upload',
          restaurantId: restaurant.id,
          kind,
          file,
        });
      }
      setMedia({ logo: null, banner: null });
      setEditingProfile(false);
      void revalidator.revalidate();
    } catch {
      toast.error('Profile saved, but an image upload failed. Please retry.');
    }
  };

  const removeMedia = async (kind: 'logo' | 'banner') => {
    try {
      await restaurantMediaMutation.mutateAsync({
        action: 'remove',
        restaurantId: restaurant.id,
        kind,
      });
      void revalidator.revalidate();
    } catch {
      toast.error('Could not remove the image.');
    }
  };

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
          cuisineType: primaryCuisineName,
          cuisineIds: catalogs.cuisineIds,
          primaryCuisineId: catalogs.primaryCuisineId,
          diningAreaId: catalogs.diningAreaId,
          collectionIds,
        },
      },
      {
        fallback: t('restaurants.profileUpdateFailed'),
        success: t('restaurants.profileUpdated'),
        onSuccess: () => void finishProfileSave(),
      },
    );

  return (
    <div className="mx-auto w-full max-w-6xl py-2">
      <BackButton onClick={onBack} label={t('nav.restaurants')} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:items-start">
        <section className="panel p-6">
          <RestaurantBanner
            name={restaurant.name}
            url={restaurant.bannerImageUrl}
            logoUrl={restaurant.avatarUrl}
            overlay={
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-bold text-white [text-shadow:0_1px_6px_rgb(0_0_0_/_45%)]">
                    {restaurant.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wide ${
                      restaurant.status === 'ACTIVE'
                        ? 'bg-basil text-white'
                        : 'bg-white/20 text-white backdrop-blur-sm'
                    }`}
                  >
                    {restaurant.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-compact font-medium text-white/85">
                  {restaurant.type} ·{' '}
                  {restaurant.cuisines
                    ?.filter((item) => item.isPrimary)
                    .map((item) => item.cuisine.name)
                    .join(', ') || restaurant.cuisineType}
                </p>
              </div>
            }
          />
          <p className="mb-4 text-sm">{restaurant.address}</p>

          {canChef(user) && !editingProfile && (
            <button
              className="btn btn-soft mb-4 flex items-center gap-2"
              onClick={() => setEditingProfile(true)}
            >
              <Pencil size={13} />
              {t('restaurants.editProfile')}
            </button>
          )}

          {editingProfile && (
            <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <VietnamAddressFields value={address} onChange={setAddress} />
              <RestaurantProfileFields value={profile} onChange={setProfile} />
              <div className="field-group">
                <p className="field-group-title">
                  <Images size={13} aria-hidden="true" />
                  {t('restaurants.media')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ImagePicker
                    label={t('restaurants.restaurantLogo')}
                    currentUrl={restaurant.avatarUrl}
                    maxSizeMb={5}
                    onFile={(logo) =>
                      setMedia((current) => ({ ...current, logo }))
                    }
                    onRemove={() => void removeMedia('logo')}
                  />
                  <ImagePicker
                    label={t('restaurants.bannerImage')}
                    currentUrl={restaurant.bannerImageUrl}
                    maxSizeMb={5}
                    onFile={(banner) =>
                      setMedia((current) => ({ ...current, banner }))
                    }
                    onRemove={() => void removeMedia('banner')}
                  />
                </div>
              </div>
              <RestaurantCatalogFields
                value={catalogs}
                onChange={setCatalogs}
                onPrimaryCuisineNameChange={setPrimaryCuisineName}
                initialCuisines={
                  restaurant.cuisines?.map((item) => item.cuisine) ?? []
                }
                initialDiningArea={restaurant.diningArea}
              />
              <div className="field-group">
                <p className="field-group-title">
                  <Layers size={13} aria-hidden="true" />
                  {t('restaurants.collections')}
                </p>
                <Dropdown
                  multiple
                  fullWidth
                  label={t('restaurants.collections')}
                  values={collectionIds}
                  onChange={setCollectionIds}
                  options={manageableCollections.map((collection) => ({
                    value: collection.id,
                    label: collection.name,
                  }))}
                  searchable
                  searchPlaceholder={t('restaurants.searchCollection')}
                  emptyMessage={t('bills.noFilterResults')}
                  allowClear
                  clearLabel={t('bills.clearAll')}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="btn btn-soft"
                  onClick={() => setEditingProfile(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={
                    !isVietnamAddressComplete(address) ||
                    !isRestaurantProfileValid(profile) ||
                    catalogs.cuisineIds.length === 0 ||
                    !catalogs.primaryCuisineId
                  }
                  onClick={() => void saveProfile()}
                >
                  {t('restaurants.saveProfile')}
                </button>
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            {restaurant.collections.map((collection) => (
              <span
                key={collection.id}
                className={`chip ${
                  collection.systemType === 'FAVORITES'
                    ? 'chip-chili'
                    : collection.systemType === 'RECOMMENDED'
                      ? 'chip-basil'
                      : 'chip-muted'
                }`}
              >
                {collection.name}
              </span>
            ))}
          </div>

          {restaurant.phone && (
            <a
              className="mb-4 flex w-fit items-center gap-2 text-sm font-semibold text-ink hover:underline"
              href={`tel:${restaurant.phone}`}
            >
              <Phone aria-hidden="true" size={14} /> {restaurant.phone}
            </a>
          )}

          {restaurant.cuisines && restaurant.cuisines.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {restaurant.cuisines.map((item) => (
                <span
                  key={item.cuisine.id}
                  className={`chip ${item.isPrimary ? 'chip-saffron' : 'chip-muted'}`}
                >
                  {item.cuisine.name}
                  {item.isPrimary ? ` · ${t('restaurants.primaryLabel')}` : ''}
                </span>
              ))}
            </div>
          )}

          {restaurant.diningArea && (
            <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">{restaurant.diningArea.name}</p>
              <p className="text-slate-500">{restaurant.diningArea.address}</p>
            </div>
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
                    className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-compact font-medium text-ink transition-colors hover:border-saffron hover:bg-muted"
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
                  onClick={() => setConfirmStatus('archive')}
                >
                  {t('bills.archive')}
                </button>
              )}
              {restaurant.status === 'ARCHIVED' && (
                <button
                  className="btn btn-soft flex-1 hover:border-emerald-300 hover:text-emerald-500"
                  onClick={() => setConfirmStatus('restore')}
                >
                  {t('bills.restore')}
                </button>
              )}
            </div>
          )}
        </section>
        <RestaurantFeedback data={feedback} />
      </div>
      {confirmStatus && (
        <ConfirmDialog
          title={
            confirmStatus === 'archive'
              ? t('bills.archive')
              : t('bills.restore')
          }
          message={`${
            confirmStatus === 'archive'
              ? t('bills.confirmArchive')
              : t('bills.confirmRestore')
          } ${restaurant.name}`}
          pending={fetcher.state !== 'idle'}
          onCancel={() => setConfirmStatus(null)}
          onConfirm={() => {
            const status = confirmStatus;
            void runAction(
              status,
              t(
                status === 'archive'
                  ? 'toast.restaurantArchiveFailed'
                  : 'toast.restaurantRestoreFailed',
              ),
              t(
                status === 'archive'
                  ? 'toast.restaurantArchived'
                  : 'toast.restaurantRestored',
              ),
            );
          }}
        />
      )}
    </div>
  );
}
