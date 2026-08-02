import {
  Globe2,
  LockKeyhole,
  Plus,
  Share2,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';

import type { CollectionDetailData } from '@/api/types';
import { useAppContext } from '@/app/providers/app-context';
import { useI18n } from '@/app/providers/i18n';
import BackButton from '@/components/ui/BackButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Dropdown from '@/components/ui/Dropdown';
import EmptyState from '@/components/ui/EmptyState';
import FilterBar from '@/components/ui/FilterBar';
import { useRouteMutation } from '@/hooks/useRouteMutation';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { canChef } from '@/lib/permissions';

import RestaurantCard from '../restaurants/RestaurantCard';

export default function CollectionDetailPage() {
  const { collection, restaurants, shares } =
    useLoaderData() as CollectionDetailData;
  const { user, users, restaurants: allRestaurants } = useAppContext();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { mutate } = useRouteMutation();
  const { searchValue, setSearchValue, setPage } = useUrlFilters();
  const [restaurantId, setRestaurantId] = useState('');
  const [shareUserId, setShareUserId] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    name: collection.name,
    description: collection.description ?? '',
    isPublic: collection.isPublic,
  });

  useEffect(() => {
    setForm({
      name: collection.name,
      description: collection.description ?? '',
      isPublic: collection.isPublic,
    });
  }, [collection]);

  const isOwner = collection.ownerId === user.id;
  const canManageRestaurants =
    isOwner || (collection.systemType === 'RECOMMENDED' && canChef(user));
  const canEdit = isOwner && collection.systemType === null;
  const existingRestaurantIds = new Set(
    restaurants.items.map((restaurant) => restaurant.id),
  );
  const restaurantOptions = allRestaurants
    .filter(
      (restaurant) =>
        restaurant.status === 'ACTIVE' &&
        !existingRestaurantIds.has(restaurant.id),
    )
    .map((restaurant) => ({
      value: restaurant.id,
      label: restaurant.name,
      description: restaurant.address,
    }));
  const sharedUserIds = new Set(shares?.items.map((share) => share.id) ?? []);
  const shareOptions = users
    .filter(
      (candidate) =>
        candidate.id !== user.id && !sharedUserIds.has(candidate.id),
    )
    .map((candidate) => ({
      value: candidate.id,
      label: candidate.name,
      description: `@${candidate.username}`,
    }));

  const addRestaurant = () => {
    if (!restaurantId) return;
    void mutate(
      {
        intent: 'add-collection-restaurant',
        collectionId: collection.id,
        restaurantId,
      },
      {
        fallback: t('toast.collectionRestaurantAddFailed'),
        success: t('toast.collectionRestaurantAdded'),
        onSuccess: () => setRestaurantId(''),
      },
    );
  };

  const save = () =>
    mutate(
      {
        intent: 'update-collection',
        collectionId: collection.id,
        payload: form,
      },
      {
        fallback: t('toast.collectionUpdateFailed'),
        success: t('toast.collectionUpdated'),
        onSuccess: () => setEditing(false),
      },
    );

  const visibility = collection.isPublic
    ? t('collections.public')
    : collection._count.shares > 0
      ? t('collections.shared')
      : t('collections.private');
  const VisibilityIcon = collection.isPublic
    ? Globe2
    : collection._count.shares > 0
      ? Share2
      : LockKeyhole;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <BackButton
        onClick={() => navigate('/collections')}
        label={t('nav.collections')}
      />
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{collection.name}</h2>
              <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-slate-500">
                <VisibilityIcon size={12} /> {visibility}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {collection.description || t('collections.noDescription')}
            </p>
            {collection.owner && (
              <p className="mt-1 text-xs text-slate-400">
                {t('collections.owner')}: {collection.owner.name}
              </p>
            )}
          </div>
          {canEdit && !editing && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => setEditing((current) => !current)}
              >
                {t('collections.edit')}
              </button>
              <button
                type="button"
                className="btn btn-soft text-red-500"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={13} /> {t('collections.delete')}
              </button>
            </div>
          )}
        </div>

        {editing && (
          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="label">{t('collections.name')}</span>
              <input
                className="field w-full"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="label">{t('collections.description')}</span>
              <input
                className="field w-full"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isPublic: event.target.checked,
                  }))
                }
              />
              {t('collections.makePublic')}
            </label>
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-soft"
                type="button"
                onClick={() => setEditing(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={!form.name.trim()}
                onClick={() => void save()}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <section className="space-y-3">
          <FilterBar label={t('common.filters')} controlsClassName="block">
            <input
              className="field h-9 w-full min-w-0 py-0 text-sm"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              aria-label={t('collections.searchRestaurants')}
              placeholder={t('collections.searchRestaurants')}
            />
          </FilterBar>
          {canManageRestaurants && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Dropdown
                label={t('collections.addRestaurant')}
                value={restaurantId}
                onChange={setRestaurantId}
                options={restaurantOptions}
                searchable
                searchPlaceholder={t('bills.searchRestaurants')}
                emptyMessage={t('bills.noFilterResults')}
                variant="field"
                fullWidth={false}
              />
              <button
                type="button"
                className="btn btn-primary h-9"
                disabled={!restaurantId}
                onClick={addRestaurant}
              >
                <Plus size={13} /> {t('common.add')}
              </button>
            </div>
          )}

          {restaurants.items.length === 0 && (
            <EmptyState
              icon={LockKeyhole}
              title={t('collections.noRestaurants')}
              description={t('collections.noRestaurantsHint')}
              steps={[]}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {restaurants.items.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                collectionType={collection.systemType}
                onOpen={() => navigate(`/restaurants/${restaurant.id}`)}
                actions={
                  canManageRestaurants ? (
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-muted hover:text-red-500"
                      aria-label={t('collections.removeRestaurant')}
                      onClick={() =>
                        void mutate(
                          {
                            intent: 'remove-collection-restaurant',
                            collectionId: collection.id,
                            restaurantId: restaurant.id,
                          },
                          {
                            fallback: t(
                              'toast.collectionRestaurantRemoveFailed',
                            ),
                            success: t('toast.collectionRestaurantRemoved'),
                          },
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
          {restaurants.pageInfo.hasNextPage &&
            restaurants.pageInfo.endCursor && (
              <button
                type="button"
                className="btn btn-soft w-full justify-center"
                onClick={() =>
                  setPage(restaurants.pageInfo.endCursor as string)
                }
              >
                {t('common.nextPage')}
              </button>
            )}
        </section>

        {isOwner &&
          collection.systemType === null &&
          !collection.isPublic &&
          shares && (
            <aside className="panel h-fit p-4">
              <h3 className="font-bold">{t('collections.sharing')}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {t('collections.sharingHint')}
              </p>
              <div className="mt-3 space-y-2">
                <Dropdown
                  fullWidth
                  label={t('collections.chooseMember')}
                  value={shareUserId}
                  onChange={setShareUserId}
                  options={shareOptions}
                  searchable
                  searchPlaceholder={t('bills.searchMembers')}
                  emptyMessage={t('bills.noFilterResults')}
                />
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={!shareUserId}
                  onClick={() =>
                    void mutate(
                      {
                        intent: 'share-collection',
                        collectionId: collection.id,
                        userId: shareUserId,
                      },
                      {
                        fallback: t('toast.collectionShareFailed'),
                        success: t('toast.collectionShared'),
                        onSuccess: () => setShareUserId(''),
                      },
                    )
                  }
                >
                  <Share2 size={13} /> {t('collections.share')}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {shares.items.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {share.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        @{share.username}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-500"
                      aria-label={t('collections.removeShare')}
                      onClick={() =>
                        void mutate(
                          {
                            intent: 'unshare-collection',
                            collectionId: collection.id,
                            userId: share.id,
                          },
                          {
                            fallback: t('toast.collectionUnshareFailed'),
                            success: t('toast.collectionUnshared'),
                          },
                        )
                      }
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('collections.delete')}
          message={t('collections.confirmDelete')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void mutate(
              { intent: 'delete-collection', collectionId: collection.id },
              {
                fallback: t('toast.collectionDeleteFailed'),
                success: t('toast.collectionDeleted'),
                onSuccess: () => navigate('/collections'),
              },
            );
          }}
        />
      )}
    </div>
  );
}
