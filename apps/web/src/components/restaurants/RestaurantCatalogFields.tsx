import { ChefHat } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '../../app/providers/i18n';
import type { CatalogPage, Cuisine, DiningArea } from '../../lib/api';
import { session } from '../../lib/session';
import Dropdown from '../ui/Dropdown';

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
  const { locale } = useI18n();
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
        toast.error(
          locale === 'vi'
            ? 'Không thể tải danh mục địa điểm.'
            : 'Could not load restaurant catalogs.',
          { id: 'restaurant-catalog-error' },
        );
      } finally {
        setLoadingCuisines(false);
      }
    },
    [
      cuisinePage.endCursor,
      cuisineQuery,
      initialCuisines,
      loadCatalog,
      locale,
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
        {locale === 'vi' ? 'Danh mục địa điểm' : 'Restaurant catalogs'}
      </legend>
      <div className="space-y-1">
        <span className="label">
          {locale === 'vi' ? 'Loại ẩm thực' : 'Cuisines'}
        </span>
        <Dropdown
          multiple
          fullWidth
          searchable
          label={
            loadingCuisines
              ? locale === 'vi'
                ? 'Đang tải...'
                : 'Loading...'
              : locale === 'vi'
                ? 'Chọn loại ẩm thực...'
                : 'Choose cuisines...'
          }
          ariaLabel={locale === 'vi' ? 'Loại ẩm thực' : 'Cuisines'}
          values={value.cuisineIds}
          onChange={selectCuisines}
          onSearchChange={setCuisineQuery}
          options={cuisineOptions}
          searchPlaceholder={
            locale === 'vi' ? 'Tìm loại ẩm thực...' : 'Search cuisines...'
          }
          emptyMessage={locale === 'vi' ? 'Không có kết quả' : 'No results'}
          formatSelection={(selected) =>
            selected.length === 1
              ? (selected[0]?.label ?? '')
              : `${selected.length} ${locale === 'vi' ? 'đã chọn' : 'selected'}`
          }
        />
        {cuisinePage.hasNextPage && (
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:underline"
            onClick={() => void loadCuisines(true)}
          >
            {locale === 'vi' ? 'Tải thêm loại ẩm thực' : 'Load more cuisines'}
          </button>
        )}
        {value.cuisineIds.length === 0 && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {locale === 'vi'
              ? 'Chọn ít nhất một loại ẩm thực.'
              : 'Choose at least one cuisine.'}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <span className="label">
          {locale === 'vi' ? 'Ẩm thực chính' : 'Primary cuisine'}
        </span>
        <Dropdown
          fullWidth
          disabled={selectedCuisineOptions.length === 0}
          label={
            locale === 'vi' ? 'Chọn ẩm thực chính' : 'Choose primary cuisine'
          }
          ariaLabel={locale === 'vi' ? 'Ẩm thực chính' : 'Primary cuisine'}
          value={value.primaryCuisineId}
          onChange={selectPrimary}
          options={selectedCuisineOptions}
        />
      </div>
      <div className="space-y-1">
        <span className="label">
          {locale === 'vi'
            ? 'Khu ăn uống (không bắt buộc)'
            : 'Dining Area (optional)'}
        </span>
        <Dropdown
          fullWidth
          searchable
          allowClear
          label={
            loadingAreas
              ? locale === 'vi'
                ? 'Đang tải...'
                : 'Loading...'
              : locale === 'vi'
                ? 'Chọn khu ăn uống...'
                : 'Choose a Dining Area...'
          }
          ariaLabel={locale === 'vi' ? 'Khu ăn uống' : 'Dining Area'}
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
          searchPlaceholder={
            locale === 'vi' ? 'Tìm khu ăn uống...' : 'Search Dining Areas...'
          }
          emptyMessage={locale === 'vi' ? 'Không có kết quả' : 'No results'}
        />
        {areaPage.hasNextPage && (
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:underline"
            onClick={() => void loadAreas(true)}
          >
            {locale === 'vi'
              ? 'Tải thêm khu ăn uống'
              : 'Load more Dining Areas'}
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
          {locale === 'vi' ? 'Thử tải lại danh mục' : 'Retry catalog loading'}
        </button>
      )}
    </fieldset>
  );
}
