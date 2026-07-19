import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { RestaurantDirectoryData } from '../lib/api';
import {
  TYPE_OPTIONS_VI,
  TYPE_OPTIONS_EN,
  canChef,
  isHead,
} from '../lib/helpers';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import SectionTitle from '../components/ui/SectionTitle';
import EmptyState from '../components/ui/EmptyState';
import Dropdown from '../components/ui/Dropdown';
import Modal from '../components/ui/Modal';
import VietnamAddressFields, {
  emptyVietnamAddress,
  isVietnamAddressComplete,
} from '../components/address/VietnamAddressFields';
import RestaurantProfileFields, {
  emptyRestaurantProfile,
  isRestaurantProfileValid,
} from '../components/restaurants/RestaurantProfileFields';
import RestaurantCatalogFields, {
  emptyRestaurantCatalogs,
} from '../components/restaurants/RestaurantCatalogFields';
import ImagePicker from '../components/ui/ImagePicker';
import { session } from '../lib/session';

/**
 * RestaurantsPage displays the list of restaurants, allows filtering by type/favorites/recommendations,
 * and contains the submission form to add new restaurant entries.
 */
export default function RestaurantsPage() {
  const navigate = useNavigate();
  const { user, restaurants: snapshotRestaurants } = useAppContext();
  const page = useLoaderData() as RestaurantDirectoryData;
  const restaurants = page.items;
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);
  const { locale, t } = useI18n();
  const { mutate } = useMutation();
  const typeOptions = locale === 'vi' ? TYPE_OPTIONS_VI : TYPE_OPTIONS_EN;
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'name-asc';
  const filterCuisine =
    searchParams.get('primaryCuisineId') ?? searchParams.get('cuisineId') ?? '';
  const cuisineMatch = searchParams.has('primaryCuisineId') ? 'primary' : 'all';
  const filterDiningArea = searchParams.get('diningAreaId') ?? '';
  const filterCollection = searchParams.get('collectionId') ?? '';
  const filterPlatform = searchParams.get('platform') ?? '';
  const filterArchive = searchParams.get('archive') ?? 'active';
  const limit = searchParams.get('limit') ?? '25';
  const [createOpen, setCreateOpen] = useState(false);
  const [media, setMedia] = useState<{
    logo: File | null;
    banner: File | null;
  }>({ logo: null, banner: null });
  const [form, setForm] = useState({
    name: '',
    ...emptyVietnamAddress(),
    ...emptyRestaurantProfile(),
    ...emptyRestaurantCatalogs(),
    cuisineType: '',
    type: typeOptions[0] ?? 'Restaurant',
    collectionIds: [] as string[],
  });

  const setQuery = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParamsRef.current);
    next.delete('cursor');
    next.delete('direction');
    if (value) next.set(key, value);
    else next.delete(key);
    searchParamsRef.current = next;
    setSearchParams(next);
  };

  const goToPage = (cursor: string, direction: 'forward' | 'backward') => {
    const next = new URLSearchParams(searchParamsRef.current);
    next.set('cursor', cursor);
    next.set('direction', direction);
    searchParamsRef.current = next;
    setSearchParams(next);
  };

  const cuisineOptions = Array.from(
    new Map(
      snapshotRestaurants.flatMap((entry) =>
        (entry.cuisines ?? []).map(({ cuisine }) => [
          cuisine.id,
          { value: cuisine.id, label: cuisine.name },
        ]),
      ),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));

  const activeFilterCount =
    (search ? 1 : 0) +
    (filterCuisine ? 1 : 0) +
    (filterDiningArea ? 1 : 0) +
    (filterCollection ? 1 : 0) +
    (filterPlatform ? 1 : 0) +
    (filterArchive !== 'active' ? 1 : 0) +
    (sort !== 'name-asc' ? 1 : 0);

  const diningAreaOptions = Array.from(
    new Map(
      snapshotRestaurants
        .filter((entry) => entry.diningArea)
        .map((entry) => [
          entry.diningArea!.id,
          {
            value: entry.diningArea!.id,
            label: entry.diningArea!.name,
          },
        ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));
  const platformOptions = Array.from(
    new Set(
      snapshotRestaurants.flatMap((entry) =>
        (entry.platformLinks ?? []).map((link) => link.platform),
      ),
    ),
  ).map((platform) => ({
    value: platform,
    label: platform.replaceAll('_', ' '),
  }));
  const collectionOptions = page.collections.map((collection) => ({
    value: collection.id,
    label: collection.name,
  }));
  const manageableCollectionOptions = page.collections
    .filter(
      (collection) =>
        collection.ownerId === user.id ||
        (canChef(user) && collection.systemType === 'RECOMMENDED'),
    )
    .map((collection) => ({
      value: collection.id,
      label: collection.name,
      description:
        collection.systemType === 'FAVORITES'
          ? t('restaurants.favorite')
          : collection.systemType === 'RECOMMENDED'
            ? t('restaurants.recommended')
            : undefined,
    }));

  const changeCuisineMatch = (match: string) => {
    const next = new URLSearchParams(searchParamsRef.current);
    next.delete('cursor');
    next.delete('cuisineId');
    next.delete('primaryCuisineId');
    if (filterCuisine) {
      next.set(
        match === 'primary' ? 'primaryCuisineId' : 'cuisineId',
        filterCuisine,
      );
    }
    searchParamsRef.current = next;
    setSearchParams(next);
  };

  const finishCreate = async (data: unknown) => {
    const id =
      typeof data === 'object' && data !== null && 'id' in data
        ? String((data as { id: unknown }).id)
        : '';
    if (!id) return;
    try {
      for (const [kind, file] of Object.entries(media) as Array<
        ['logo' | 'banner', File | null]
      >) {
        if (!file) continue;
        const body = new FormData();
        body.append('file', file);
        await session.api().request(`/restaurants/${id}/${kind}`, {
          method: 'PUT',
          body,
        });
      }
    } catch {
      toast.error('Restaurant was created, but an image upload failed. Retry from Edit.');
    }
    setCreateOpen(false);
    setMedia({ logo: null, banner: null });
    setForm({
      name: '',
      ...emptyVietnamAddress(),
      ...emptyRestaurantProfile(),
      ...emptyRestaurantCatalogs(),
      cuisineType: '',
      type: typeOptions[0] ?? 'Restaurant',
      collectionIds: [],
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void mutate(
      { intent: 'create-restaurant', payload: form },
      {
        fallback: t('toast.restaurantCreateFailed'),
        success: t('toast.restaurantCreated'),
        onSuccess: (data) => void finishCreate(data),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            title={t('restaurants.title')}
            subtitle={t('restaurants.subtitle')}
          />
          {canChef(user) && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={14} /> {t('restaurants.addEntry')}
            </button>
          )}
        </div>
        <section className="panel w-full space-y-3 p-3">
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="field w-full"
              type="search"
              value={search}
              onChange={(event) => setQuery('search', event.target.value)}
              placeholder={t('restaurants.search')}
              aria-label={t('restaurants.search')}
            />
            {isHead(user) ? (
              <Dropdown
                label={t('restaurants.archiveFilter')}
                ariaLabel={t('restaurants.archiveFilter')}
                value={filterArchive}
                onChange={(value) => setQuery('archive', value)}
                options={[
                  { value: 'active', label: t('bills.activeOnly') },
                  { value: 'archived', label: t('bills.archivedOnly') },
                  { value: 'all', label: t('bills.allStatuses') },
                ]}
              />
            ) : (
              <div className="hidden md:block" />
            )}
            <Dropdown
              label={t('restaurants.sort')}
              ariaLabel={t('restaurants.sort')}
              value={sort}
              onChange={(value) => setQuery('sort', value)}
              options={[
                { value: 'name-asc', label: t('restaurants.nameAsc') },
                { value: 'name-desc', label: t('restaurants.nameDesc') },
                { value: 'created-desc', label: t('restaurants.newest') },
                { value: 'created-asc', label: t('restaurants.oldest') },
              ]}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Dropdown
              label={t('restaurants.filterDiningArea')}
              value={filterDiningArea}
              onChange={(value) => setQuery('diningAreaId', value)}
              options={diningAreaOptions}
              searchable
              searchPlaceholder={t('restaurants.searchDiningArea')}
              emptyMessage={t('bills.noFilterResults')}
              allowClear
              clearLabel={t('bills.clearAll')}
            />
            <Dropdown
              label={t('restaurants.filterCollection')}
              value={filterCollection}
              onChange={(value) => setQuery('collectionId', value)}
              options={collectionOptions}
              searchable
              searchPlaceholder={t('restaurants.searchCollection')}
              emptyMessage={t('bills.noFilterResults')}
              allowClear
              clearLabel={t('bills.clearAll')}
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Dropdown
                label={t('restaurants.filterCuisine')}
                value={filterCuisine}
                onChange={(value) => {
                  if (cuisineMatch === 'primary') {
                    setQuery('primaryCuisineId', value);
                    if (value) setQuery('cuisineId');
                  } else {
                    setQuery('cuisineId', value);
                    if (value) setQuery('primaryCuisineId');
                  }
                }}
                options={cuisineOptions}
                searchable
                searchPlaceholder={t('restaurants.searchCuisine')}
                emptyMessage={t('bills.noFilterResults')}
                allowClear
                clearLabel={t('bills.clearAll')}
              />
              <Dropdown
                label={t('restaurants.cuisineMatch')}
                value={cuisineMatch}
                onChange={changeCuisineMatch}
                options={[
                  { value: 'all', label: t('restaurants.anyCuisine') },
                  { value: 'primary', label: t('restaurants.primaryCuisine') },
                ]}
                fullWidth={false}
              />
            </div>
            <Dropdown
              label={t('restaurants.filterPlatform')}
              value={filterPlatform}
              onChange={(value) => setQuery('platform', value)}
              options={platformOptions}
              allowClear
              clearLabel={t('bills.clearAll')}
            />
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="text-[12px] text-slate-400 hover:text-red-400"
              onClick={() => setSearchParams({})}
            >
              {t('bills.clearAll')}
            </button>
          )}
        </section>
        {restaurants.length === 0 && activeFilterCount === 0 && (
          <EmptyState
            icon={Store}
            title={t('restaurants.noEntries')}
            description={t('restaurants.noEntriesDesc')}
            steps={[
              t('restaurants.addEntry'),
              t('restaurants.filterCuisine'),
              t('restaurants.favorite'),
            ]}
          />
        )}
        {restaurants.length === 0 && activeFilterCount > 0 && (
          <EmptyState
            icon={Store}
            title={t('restaurants.noMatch')}
            description={t('restaurants.clearFiltersHint')}
            steps={[]}
          />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {restaurants.map((entry) => (
            <article
              key={entry.id}
              className="panel cursor-pointer p-4 transition-shadow hover:shadow-md"
              onClick={() => navigate(`/restaurants/${entry.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{entry.name}</h3>
                  <p className="text-sm text-slate-500">
                    {entry.type} / {entry.cuisineType}
                  </p>
                  <p className="mt-1 truncate text-sm">{entry.address}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {entry.isFavoritedByMe && (
                  <span className="rounded-full bg-red-50 px-2 py-1 text-red-600 dark:bg-red-950 dark:text-red-400">
                    ♥ {t('restaurants.favorite')}
                  </span>
                )}
                {entry.isRecommended && (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {t('restaurants.recommended')}
                  </span>
                )}
                {entry.status === 'ARCHIVED' && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800">
                    ARCHIVED
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-28">
            <Dropdown
              label={t('common.rows')}
              ariaLabel={t('common.rowsPerPage')}
              value={limit}
              onChange={(value) => setQuery('limit', value)}
              options={['10', '25', '50'].map((value) => ({
                value,
                label: `${value} ${t('common.rows')}`,
              }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-soft"
              disabled={
                !page.pageInfo.hasPreviousPage || !page.pageInfo.startCursor
              }
              onClick={() =>
                page.pageInfo.startCursor &&
                goToPage(page.pageInfo.startCursor, 'backward')
              }
            >
              <ChevronLeft size={14} /> {t('common.previousPage')}
            </button>
            <button
              type="button"
              className="btn btn-soft"
              disabled={!page.pageInfo.hasNextPage || !page.pageInfo.endCursor}
              onClick={() =>
                page.pageInfo.endCursor &&
                goToPage(page.pageInfo.endCursor, 'forward')
              }
            >
              {t('common.nextPage')} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
      <Modal
        open={createOpen}
        title={t('restaurants.addEntry')}
        size="lg"
        onClose={() => setCreateOpen(false)}
      >
        <form className="space-y-4" onSubmit={submit}>
          <p className="text-sm text-slate-500">
            {t('restaurants.addEntrySubtitle')}
          </p>
          <label className="block space-y-1">
            <span className="label">{locale === 'vi' ? 'Tên' : 'Name'}</span>
            <input
              className="field w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <VietnamAddressFields
            value={form}
            onChange={(address) => setForm({ ...form, ...address })}
          />
          <RestaurantProfileFields
            value={form}
            onChange={(profile) => setForm({ ...form, ...profile })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <ImagePicker
              label={locale === 'vi' ? 'Logo quán' : 'Restaurant logo'}
              maxSizeMb={5}
              onFile={(logo) => setMedia((current) => ({ ...current, logo }))}
            />
            <ImagePicker
              label={locale === 'vi' ? 'Ảnh bìa' : 'Banner image'}
              maxSizeMb={5}
              onFile={(banner) =>
                setMedia((current) => ({ ...current, banner }))
              }
            />
          </div>
          <RestaurantCatalogFields
            value={form}
            onChange={(catalogs) => setForm({ ...form, ...catalogs })}
            onPrimaryCuisineNameChange={(cuisineType) =>
              setForm((current) => ({ ...current, cuisineType }))
            }
          />
          <div className="block space-y-1">
            <span className="label">
              {locale === 'vi' ? 'Loại hình' : 'Type'}
            </span>
            <Dropdown
              fullWidth
              label={locale === 'vi' ? 'Chọn...' : 'Choose...'}
              ariaLabel={locale === 'vi' ? 'Loại hình' : 'Type'}
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
              options={typeOptions.map((type) => ({
                value: type,
                label: type,
              }))}
            />
          </div>
          <Dropdown
            multiple
            fullWidth
            label={t('restaurants.collections')}
            values={form.collectionIds}
            onChange={(collectionIds) =>
              setForm((current) => ({ ...current, collectionIds }))
            }
            options={manageableCollectionOptions}
            searchable
            searchPlaceholder={t('restaurants.searchCollection')}
            emptyMessage={t('bills.noFilterResults')}
            allowClear
            clearLabel={t('bills.clearAll')}
          />
          <button
            className="btn btn-primary w-full"
            disabled={
              !form.name.trim() ||
              !isVietnamAddressComplete(form) ||
              !isRestaurantProfileValid(form) ||
              form.cuisineIds.length === 0 ||
              !form.primaryCuisineId ||
              !form.cuisineType ||
              !form.type
            }
          >
            {t('restaurants.createEntry')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
