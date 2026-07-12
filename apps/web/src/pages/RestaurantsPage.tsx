import { FormEvent, useState } from 'react';
import { Heart, Store, ThumbsUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  CUISINE_OPTIONS,
  TYPE_OPTIONS_VI,
  TYPE_OPTIONS_EN,
  canChef,
} from '../lib/helpers.js';
import { useAppContext } from '../app/providers/app-context.js';
import { useI18n } from '../app/providers/i18n.js';
import { useMutation } from '../hooks/useMutation.js';
import SectionTitle from '../components/ui/SectionTitle.js';
import EmptyState from '../components/ui/EmptyState.js';

/**
 * RestaurantsPage displays the list of restaurants, allows filtering by type/favorites/recommendations,
 * and contains the submission form to add new restaurant entries.
 */
export default function RestaurantsPage() {
  const navigate = useNavigate();
  const { user, restaurants, setError } = useAppContext();
  const { locale, t } = useI18n();
  const { mutate } = useMutation(setError);
  const typeOptions = locale === 'vi' ? TYPE_OPTIONS_VI : TYPE_OPTIONS_EN;
  const [sortByName, setSortByName] = useState(false);
  const [filterCuisine, setFilterCuisine] = useState('');
  const [filterFav, setFilterFav] = useState(false);
  const [filterRec, setFilterRec] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    cuisineType: '',
    type: typeOptions[0] ?? 'Restaurant',
    isRecommended: false,
  });

  const filtered = restaurants
    .filter((e) => {
      if (filterCuisine && e.cuisineType !== filterCuisine) return false;
      if (filterFav && !e.isFavoritedByMe) return false;
      if (filterRec && !e.isRecommended) return false;
      return true;
    })
    .sort((a, b) =>
      sortByName
        ? a.name.localeCompare(b.name)
        : (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) ||
          a.name.localeCompare(b.name),
    );

  const cuisineOptions = Array.from(
    new Set(restaurants.map((e) => e.cuisineType).filter(Boolean)),
  ).sort();

  const toggleFavorite = (id: string) =>
    mutate(
      { intent: 'restaurant-favorite', restaurantId: id },
      { fallback: 'Could not toggle favorite', clearFirst: false },
    );

  const toggleRecommend = (id: string) =>
    mutate(
      { intent: 'restaurant-recommend', restaurantId: id },
      { fallback: 'Could not toggle recommend', clearFirst: false },
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void mutate(
      { intent: 'create-restaurant', payload: form },
      {
        fallback: 'Could not save restaurant',
        onSuccess: () =>
          setForm({
            name: '',
            address: '',
            cuisineType: '',
            type: typeOptions[0] ?? 'Restaurant',
            isRecommended: false,
          }),
      },
    );
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <SectionTitle
          title={t('restaurants.title')}
          subtitle={t('restaurants.subtitle')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`btn h-8 px-3 text-[12px] ${sortByName ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => setSortByName(!sortByName)}
          >
            {t('restaurants.sortByName')}
          </button>
          <select
            className="field h-8 text-[12px]"
            value={filterCuisine}
            onChange={(e) => setFilterCuisine(e.target.value)}
          >
            <option value="">{t('restaurants.filterCuisine')}</option>
            {cuisineOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-all ${
              filterFav
                ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950 dark:text-red-400'
                : 'border-border bg-surface text-slate-500 hover:text-ink'
            }`}
            onClick={() => setFilterFav(!filterFav)}
          >
            <Heart size={12} fill={filterFav ? 'currentColor' : 'none'} />{' '}
            {t('restaurants.filterFavorite')}
          </button>
          <button
            className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-all ${
              filterRec
                ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'border-border bg-surface text-slate-500 hover:text-ink'
            }`}
            onClick={() => setFilterRec(!filterRec)}
          >
            <ThumbsUp size={12} /> {t('restaurants.filterRecommended')}
          </button>
        </div>
        {restaurants.length === 0 && (
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
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((entry) => (
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
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(entry.id);
                    }}
                    title={t('restaurants.favorite')}
                  >
                    <Heart
                      size={14}
                      className={
                        entry.isFavoritedByMe
                          ? 'fill-red-500 text-red-500'
                          : 'text-slate-400'
                      }
                    />
                  </button>
                  {canChef(user) && (
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRecommend(entry.id);
                      }}
                      title={t('restaurants.recommended')}
                    >
                      <ThumbsUp
                        size={14}
                        className={
                          entry.isRecommended
                            ? 'fill-emerald-500 text-emerald-500'
                            : 'text-slate-400'
                        }
                      />
                    </button>
                  )}
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
      </div>
      {canChef(user) && (
        <form className="panel h-fit space-y-4 p-4" onSubmit={submit}>
          <SectionTitle
            title={t('restaurants.addEntry')}
            subtitle={t('restaurants.addEntrySubtitle')}
          />
          <label className="block space-y-1">
            <span className="label">{locale === 'vi' ? 'Tên' : 'Name'}</span>
            <input
              className="field w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="label">
              {locale === 'vi' ? 'Địa chỉ' : 'Address'}
            </span>
            <input
              className="field w-full"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="label">
              {locale === 'vi' ? 'Loại ẩm thực' : 'Cuisine type'}
            </span>
            <select
              className="field w-full"
              value={form.cuisineType}
              onChange={(e) =>
                setForm({ ...form, cuisineType: e.target.value })
              }
              required
            >
              <option value="">
                {locale === 'vi' ? 'Chọn...' : 'Choose...'}
              </option>
              {CUISINE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label">
              {locale === 'vi' ? 'Loại hình' : 'Type'}
            </span>
            <select
              className="field w-full"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
            >
              {typeOptions.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isRecommended}
              onChange={(e) =>
                setForm({ ...form, isRecommended: e.target.checked })
              }
            />
            {t('restaurants.recommended')}
          </label>
          <button className="btn btn-primary w-full">
            {t('restaurants.createEntry')}
          </button>
        </form>
      )}
    </div>
  );
}
