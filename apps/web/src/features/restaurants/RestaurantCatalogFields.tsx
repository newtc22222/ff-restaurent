import { ChefHat } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '../../app/providers/i18n';
import type { CatalogPage, Cuisine, DiningArea } from '../../lib/api';
import { session } from '../../lib/session';
import Dropdown from '../../components/ui/Dropdown';

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

type CatalogLoader = (
  path: string,
) => Promise<CatalogPage<Cuisine | DiningArea>>;

const defaultLoader: CatalogLoader = (path) =>
  session.api().request<CatalogPage<Cuisine | DiningArea>>(path);

export default function RestaurantCatalogFields({
  value,
  onChange,
  onPrimaryCuisineNameChange,
  initialCuisines = [],
  initialDiningArea,
  loadCatalog = defaultLoader,
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
  const [cuisines, setCuisines] = useState<Cuisine[]>(initialCuisines);
  const [areas, setAreas] = useState<DiningArea[]>(
    initialDiningArea ? [initialDiningArea] : [],
  );
  const [cuisinePage, setCuisinePage] = useState<
    CatalogPage<Cuisine>['pageInfo']
  >({ endCursor: null, hasNextPage: false });
  const [areaPage, setAreaPage] = useState<CatalogPage<DiningArea>['pageInfo']>(
    { endCursor: null, hasNextPage: false },
  );
  const [loadingCuisines, setLoadingCuisines] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [catalogError, setCatalogError] = useState(false);

  const mergeById = <T extends { id: string }>(current: T[], next: T[]) => [
    ...new Map([...current, ...next].map((item) => [item.id, item])).values(),
  ];

  const loadCuisines = useCallback(
    async (append = false) => {
      setLoadingCuisines(true);
      setCatalogError(false);
      try {
        const query = new URLSearchParams({
          search: cuisineQuery,
          limit: '25',
        });
        if (append && cuisinePage.endCursor)
          query.set('cursor', cuisinePage.endCursor);
        const result = (await loadCatalog(
          `/cuisines?${query}`,
        )) as CatalogPage<Cuisine>;
        setCuisines((current) =>
          mergeById(
            append
              ? current
              : [
                  ...initialCuisines,
                  ...current.filter((item) =>
                    value.cuisineIds.includes(item.id),
                  ),
                ],
            result.items,
          ),
        );
        setCuisinePage(result.pageInfo);
      } catch {
        setCatalogError(true);
        toast.error(t('restaurants.catalogLoadError'), {
          id: 'restaurant-catalog-error',
        });
      } finally {
        setLoadingCuisines(false);
      }
    },
    [
      cuisinePage.endCursor,
      cuisineQuery,
      initialCuisines,
      loadCatalog,
      t,
      value.cuisineIds,
    ],
  );

  const loadAreas = useCallback(
    async (append = false) => {
      setLoadingAreas(true);
      setCatalogError(false);
      try {
        const query = new URLSearchParams({ search: areaQuery, limit: '25' });
        if (append && areaPage.endCursor)
          query.set('cursor', areaPage.endCursor);
        const result = (await loadCatalog(
          `/dining-areas?${query}`,
        )) as CatalogPage<DiningArea>;
        setAreas((current) =>
          mergeById(
            append
              ? current
              : [
                  ...(initialDiningArea ? [initialDiningArea] : []),
                  ...current.filter((item) => item.id === value.diningAreaId),
                ],
            result.items,
          ),
        );
        setAreaPage(result.pageInfo);
      } catch {
        setCatalogError(true);
      } finally {
        setLoadingAreas(false);
      }
    },
    [
      areaPage.endCursor,
      areaQuery,
      initialDiningArea,
      loadCatalog,
      value.diningAreaId,
    ],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCuisines(false), 200);
    return () => window.clearTimeout(timer);
  }, [cuisineQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAreas(false), 200);
    return () => window.clearTimeout(timer);
  }, [areaQuery]);

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
            loadingCuisines
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
        {cuisinePage.hasNextPage && (
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:underline"
            onClick={() => void loadCuisines(true)}
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
            loadingAreas
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
        {areaPage.hasNextPage && (
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:underline"
            onClick={() => void loadAreas(true)}
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
            void loadCuisines(false);
            void loadAreas(false);
          }}
        >
          {t('restaurants.retryCatalogLoading')}
        </button>
      )}
    </fieldset>
  );
}
