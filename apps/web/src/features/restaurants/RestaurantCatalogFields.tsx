import { ChefHat } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '@/app/providers/i18n';
import type { Cuisine, DiningArea } from '@/api/types';
import Dropdown from '@/components/ui/Dropdown';
import {
  defaultCatalogLoader,
  useCuisineCatalog,
  useDiningAreaCatalog,
  type CatalogLoader,
} from './restaurant-catalog.queries';

export type RestaurantCatalogValue = {
  cuisineIds: string[];
  primaryCuisineId: string;
  diningAreaId: string | null;
};

export const emptyRestaurantCatalogs = (): RestaurantCatalogValue => ({
  cuisineIds: [],
  primaryCuisineId: '',
  diningAreaId: null,
});

const noInitialCuisines: Cuisine[] = [];

export default function RestaurantCatalogFields({
  value,
  onChange,
  onPrimaryCuisineNameChange,
  initialCuisines = noInitialCuisines,
  initialDiningArea,
  loadCatalog = defaultCatalogLoader,
}: {
  value: RestaurantCatalogValue;
  onChange: (value: RestaurantCatalogValue) => void;
  onPrimaryCuisineNameChange?: (name: string) => void;
  initialCuisines?: Cuisine[];
  initialDiningArea?: DiningArea | null;
  loadCatalog?: CatalogLoader;
}) {
  const { t } = useI18n();
  const [cuisineQuery, setCuisineQuery] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [debouncedCuisineQuery, setDebouncedCuisineQuery] = useState('');
  const [debouncedAreaQuery, setDebouncedAreaQuery] = useState('');
  const [cuisines, setCuisines] = useState<Cuisine[]>(initialCuisines);
  const [areas, setAreas] = useState<DiningArea[]>(
    initialDiningArea ? [initialDiningArea] : [],
  );
  const cuisineCatalog = useCuisineCatalog(debouncedCuisineQuery, loadCatalog);
  const diningAreaCatalog = useDiningAreaCatalog(
    debouncedAreaQuery,
    loadCatalog,
  );

  const mergeById = <T extends { id: string }>(current: T[], next: T[]) => [
    ...new Map([...current, ...next].map((item) => [item.id, item])).values(),
  ];

  useEffect(() => {
    const items = cuisineCatalog.data?.pages.flatMap((page) => page.items);
    if (!items) return;
    setCuisines((current) =>
      mergeById(
        [
          ...initialCuisines,
          ...current.filter((item) => value.cuisineIds.includes(item.id)),
        ],
        items,
      ),
    );
  }, [cuisineCatalog.data, initialCuisines, value.cuisineIds]);

  useEffect(() => {
    const items = diningAreaCatalog.data?.pages.flatMap((page) => page.items);
    if (!items) return;
    setAreas((current) =>
      mergeById(
        [
          ...(initialDiningArea ? [initialDiningArea] : []),
          ...current.filter((item) => item.id === value.diningAreaId),
        ],
        items,
      ),
    );
  }, [diningAreaCatalog.data, initialDiningArea, value.diningAreaId]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCuisineQuery(cuisineQuery),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [cuisineQuery]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedAreaQuery(areaQuery),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [areaQuery]);

  const catalogError = cuisineCatalog.isError || diningAreaCatalog.isError;
  useEffect(() => {
    if (!catalogError) return;
    toast.error(t('restaurants.catalogLoadError'), {
      id: 'restaurant-catalog-error',
    });
  }, [catalogError, t]);

  const cuisineOptions = useMemo(
    () =>
      cuisines.map((cuisine) => ({
        value: cuisine.id,
        label: cuisine.name,
        description: cuisine.type,
        searchText: `${cuisine.name} ${cuisine.type}`,
      })),
    [cuisines],
  );
  const selectedCuisineOptions = cuisineOptions.filter((option) =>
    value.cuisineIds.includes(option.value),
  );

  const selectCuisines = (cuisineIds: string[]) => {
    const primaryCuisineId = cuisineIds.includes(value.primaryCuisineId)
      ? value.primaryCuisineId
      : (cuisineIds[0] ?? '');
    onChange({ ...value, cuisineIds, primaryCuisineId });
    onPrimaryCuisineNameChange?.(
      cuisines.find((cuisine) => cuisine.id === primaryCuisineId)?.name ?? '',
    );
  };

  const selectPrimary = (primaryCuisineId: string) => {
    onChange({ ...value, primaryCuisineId });
    onPrimaryCuisineNameChange?.(
      cuisines.find((cuisine) => cuisine.id === primaryCuisineId)?.name ?? '',
    );
  };

  return (
    <fieldset className="field-group">
      <legend className="field-group-title">
        <ChefHat size={13} aria-hidden="true" />
        {t('restaurants.catalogs')}
      </legend>
      <div className="space-y-1">
        <span className="label">{t('restaurants.cuisines')}</span>
        <Dropdown
          multiple
          fullWidth
          searchable
          label={
            cuisineCatalog.isFetching
              ? t('restaurants.loading')
              : t('restaurants.chooseCuisines')
          }
          ariaLabel={t('restaurants.cuisines')}
          values={value.cuisineIds}
          onChange={selectCuisines}
          onSearchChange={setCuisineQuery}
          options={cuisineOptions}
          searchPlaceholder={t('restaurants.searchCuisine')}
          emptyMessage={t('restaurants.noResults')}
          formatSelection={(selected) =>
            selected.length === 1
              ? (selected[0]?.label ?? '')
              : `${selected.length} ${t('restaurants.selected')}`
          }
        />
        {cuisineCatalog.hasNextPage && (
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:underline"
            onClick={() => void cuisineCatalog.fetchNextPage()}
          >
            {t('restaurants.loadMoreCuisines')}
          </button>
        )}
        {value.cuisineIds.length === 0 && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {t('restaurants.cuisineRequired')}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <span className="label">{t('restaurants.primaryCuisine')}</span>
        <Dropdown
          fullWidth
          disabled={selectedCuisineOptions.length === 0}
          label={t('restaurants.choosePrimaryCuisine')}
          ariaLabel={t('restaurants.primaryCuisine')}
          value={value.primaryCuisineId}
          onChange={selectPrimary}
          options={selectedCuisineOptions}
        />
      </div>
      <div className="space-y-1">
        <span className="label">{t('restaurants.diningAreaOptional')}</span>
        <Dropdown
          fullWidth
          searchable
          allowClear
          label={
            diningAreaCatalog.isFetching
              ? t('restaurants.loading')
              : t('restaurants.chooseDiningArea')
          }
          ariaLabel={t('restaurants.diningArea')}
          value={value.diningAreaId ?? ''}
          onChange={(diningAreaId) =>
            onChange({ ...value, diningAreaId: diningAreaId || null })
          }
          onSearchChange={setAreaQuery}
          options={areas.map((area) => ({
            value: area.id,
            label: area.name,
            description: area.address,
            searchText: `${area.name} ${area.address}`,
          }))}
          searchPlaceholder={t('restaurants.catalogSearchDiningArea')}
          emptyMessage={t('restaurants.noResults')}
        />
        {diningAreaCatalog.hasNextPage && (
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:underline"
            onClick={() => void diningAreaCatalog.fetchNextPage()}
          >
            {t('restaurants.loadMoreDiningAreas')}
          </button>
        )}
      </div>
      {catalogError && (
        <button
          type="button"
          className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
          onClick={() => {
            void Promise.all([
              cuisineCatalog.refetch(),
              diningAreaCatalog.refetch(),
            ]);
          }}
        >
          {t('restaurants.retryCatalogLoading')}
        </button>
      )}
    </fieldset>
  );
}
