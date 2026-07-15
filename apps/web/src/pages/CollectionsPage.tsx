import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  FolderHeart,
  Globe2,
  Heart,
  LockKeyhole,
  Plus,
  Share2,
  Sparkles,
} from 'lucide-react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { CatalogPage, Collection } from '../lib/api';
import { useI18n } from '../app/providers/i18n';
import { useAppContext } from '../app/providers/app-context';
import { useMutation } from '../hooks/useMutation';
import EmptyState from '../components/ui/EmptyState';
import SectionTitle from '../components/ui/SectionTitle';

const collectionIcon = (collection: Collection) =>
  collection.systemType === 'FAVORITES'
    ? Heart
    : collection.systemType === 'RECOMMENDED'
      ? Sparkles
      : FolderHeart;

export default function CollectionsPage() {
  const page = useLoaderData() as CatalogPage<Collection>;
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAppContext();
  const { mutate } = useMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  const [form, setForm] = useState({
    name: '',
    description: '',
    isPublic: false,
  });

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const setQuery = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParamsRef.current);
    next.delete('cursor');
    if (value) next.set(key, value);
    else next.delete(key);
    searchParamsRef.current = next;
    setSearchParams(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void mutate(
      { intent: 'create-collection', payload: form },
      {
        fallback: t('toast.collectionCreateFailed'),
        success: t('toast.collectionCreated'),
        onSuccess: () =>
          setForm({ name: '', description: '', isPublic: false }),
      },
    );
  };

  const visibility = searchParams.get('visibility') ?? 'all';
  const search = searchParams.get('search') ?? '';

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <SectionTitle
          title={t('collections.title')}
          subtitle={t('collections.subtitle')}
        />
        <div className="flex flex-wrap gap-2">
          <input
            className="field h-9 min-w-56 flex-1 py-0 text-sm"
            type="search"
            value={search}
            onChange={(event) => setQuery('search', event.target.value)}
            placeholder={t('collections.search')}
            aria-label={t('collections.search')}
          />
          <select
            className="field h-9 py-0 text-sm"
            value={visibility}
            onChange={(event) => setQuery('visibility', event.target.value)}
            aria-label={t('collections.visibility')}
          >
            <option value="all">{t('collections.all')}</option>
            <option value="owned">{t('collections.owned')}</option>
            <option value="shared">{t('collections.shared')}</option>
            <option value="public">{t('collections.public')}</option>
          </select>
        </div>

        {page.items.length === 0 && (
          <EmptyState
            icon={FolderHeart}
            title={t('collections.empty')}
            description={t('collections.emptyHint')}
            steps={[]}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((collection) => {
            const Icon = collectionIcon(collection);
            const visibilityLabel = collection.isPublic
              ? t('collections.public')
              : collection.ownerId === user.id
                ? collection._count.shares > 0
                  ? t('collections.sharedByMe')
                  : t('collections.private')
                : t('collections.shared');
            const VisibilityIcon = collection.isPublic
              ? Globe2
              : collection._count.shares > 0
                ? Share2
                : LockKeyhole;
            return (
              <button
                key={collection.id}
                type="button"
                className="panel group min-h-44 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate(`/collections/${collection.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300">
                    <Icon size={19} />
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <VisibilityIcon size={11} /> {visibilityLabel}
                  </span>
                </div>
                <h3 className="mt-4 truncate font-bold text-ink">
                  {collection.name}
                </h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">
                  {collection.description || t('collections.noDescription')}
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {collection._count.restaurants} {t('collections.restaurants')}
                </p>
              </button>
            );
          })}
        </div>

        {page.pageInfo.hasNextPage && page.pageInfo.endCursor && (
          <button
            type="button"
            className="btn btn-soft w-full justify-center"
            onClick={() => setQuery('cursor', page.pageInfo.endCursor!)}
          >
            {t('common.nextPage')}
          </button>
        )}
      </section>

      <form className="panel h-fit space-y-4 p-4" onSubmit={submit}>
        <SectionTitle
          title={t('collections.create')}
          subtitle={t('collections.createHint')}
        />
        <label className="block space-y-1">
          <span className="label">{t('collections.name')}</span>
          <input
            className="field w-full"
            value={form.name}
            maxLength={100}
            required
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <label className="block space-y-1">
          <span className="label">{t('collections.description')}</span>
          <textarea
            className="field min-h-24 w-full resize-y py-2"
            value={form.description}
            maxLength={500}
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
        <button className="btn btn-primary w-full" disabled={!form.name.trim()}>
          <Plus size={14} /> {t('collections.create')}
        </button>
      </form>
    </div>
  );
}
