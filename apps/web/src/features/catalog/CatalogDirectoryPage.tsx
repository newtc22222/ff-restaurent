import {
  Edit3,
  Grid2X2,
  MapPin,
  Plus,
  Table2,
  Trash2,
  Utensils,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';

import type { CatalogPage, Cuisine, DiningArea } from '@/api/types';
import { useAppContext } from '@/app/providers/app-context';
import { useI18n } from '@/app/providers/i18n';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import FilterBar from '@/components/ui/FilterBar';
import Modal from '@/components/ui/Modal';
import ScrollArea from '@/components/ui/ScrollArea';
import SectionTitle from '@/components/ui/SectionTitle';
import { useRouteMutation } from '@/hooks/useRouteMutation';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { canChef } from '@/lib/permissions';

import VietnamAddressFields, {
  emptyVietnamAddress,
  isVietnamAddressComplete,
} from '../address/VietnamAddressFields';

type CatalogKind = 'cuisines' | 'dining-areas';
type CuisineForm = Pick<Cuisine, 'name' | 'type' | 'description'>;
type DiningAreaForm = Pick<
  DiningArea,
  | 'name'
  | 'description'
  | 'address'
  | 'addressLine'
  | 'provinceCode'
  | 'provinceName'
  | 'wardCode'
  | 'wardName'
>;

const emptyCuisine = (): CuisineForm => ({
  name: '',
  type: '',
  description: '',
});

const emptyDiningArea = (): DiningAreaForm => ({
  name: '',
  description: '',
  ...emptyVietnamAddress(),
});

export default function CatalogDirectoryPage({ kind }: { kind: CatalogKind }) {
  const page = useLoaderData() as CatalogPage<Cuisine | DiningArea>;
  const { user } = useAppContext();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { mutate } = useRouteMutation();
  const { searchValue, setSearchValue, setPage } = useUrlFilters();
  const manageable = canChef(user);
  const isCuisine = kind === 'cuisines';
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [cuisineLayout, setCuisineLayout] = useState<'table' | 'card'>(() => {
    if (typeof window === 'undefined') return 'table';
    return window.localStorage.getItem('ff-cuisines-layout') === 'card'
      ? 'card'
      : 'table';
  });
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<CuisineForm | DiningAreaForm>(() =>
    isCuisine ? emptyCuisine() : emptyDiningArea(),
  );

  const title = isCuisine ? t('nav.cuisines') : t('nav.diningAreas');
  const subtitle = isCuisine
    ? t('catalog.cuisines.subtitle')
    : t('catalog.diningAreas.subtitle');
  const searchLabel = isCuisine
    ? t('catalog.cuisines.search')
    : t('catalog.diningAreas.search');

  useEffect(() => {
    if (isCuisine) {
      window.localStorage.setItem('ff-cuisines-layout', cuisineLayout);
    }
  }, [cuisineLayout, isCuisine]);

  const openCreate = () => {
    setEditingId(null);
    setForm(isCuisine ? emptyCuisine() : emptyDiningArea());
    setEditorOpen(true);
  };

  const openEdit = (item: Cuisine | DiningArea) => {
    setEditingId(item.id);
    const diningArea = item as DiningArea;
    setForm(
      isCuisine
        ? {
            name: item.name,
            type: (item as Cuisine).type,
            description: item.description ?? '',
          }
        : {
            name: item.name,
            description: item.description ?? '',
            address: diningArea.address,
            addressLine: diningArea.addressLine ?? null,
            provinceCode: diningArea.provinceCode ?? null,
            provinceName: diningArea.provinceName ?? null,
            wardCode: diningArea.wardCode ?? null,
            wardName: diningArea.wardName ?? null,
          },
    );
    setEditorOpen(true);
  };

  const closeEditor = () => setEditorOpen(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valid = isCuisine
      ? Boolean(
          (form as CuisineForm).name.trim() &&
          (form as CuisineForm).type.trim(),
        )
      : Boolean(
          (form as DiningAreaForm).name.trim() &&
          isVietnamAddressComplete(form as DiningAreaForm),
        );
    if (!valid) return;
    const intent = isCuisine
      ? editingId
        ? 'update-cuisine'
        : 'create-cuisine'
      : editingId
        ? 'update-dining-area'
        : 'create-dining-area';
    void mutate(
      { intent, catalogId: editingId ?? undefined, payload: form },
      {
        fallback: t('toast.catalogSaveFailed'),
        success: editingId
          ? t('toast.catalogUpdated')
          : t('toast.catalogCreated'),
        onSuccess: closeEditor,
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const intent = isCuisine ? 'delete-cuisine' : 'delete-dining-area';
    void mutate(
      { intent, catalogId: deleteTarget.id },
      {
        fallback: t('toast.catalogDeleteFailed'),
        success: t('toast.catalogDeleted'),
        onSuccess: () => setDeleteTarget(null),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle title={title} subtitle={subtitle} />
        <div className="flex flex-wrap items-center gap-2">
          {isCuisine && (
            <div
              className="flex rounded-lg border border-border bg-surface p-1"
              aria-label={t('catalog.layout')}
              role="group"
            >
              {(
                [
                  ['card', Grid2X2, 'catalog.cardLayout'],
                  ['table', Table2, 'catalog.tableLayout'],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`grid h-8 w-9 place-items-center rounded-md transition-colors ${
                    cuisineLayout === value
                      ? 'bg-ink text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-500 hover:bg-muted hover:text-ink'
                  }`}
                  aria-label={t(label)}
                  aria-pressed={cuisineLayout === value}
                  onClick={() => setCuisineLayout(value)}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}
          {manageable && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              <Plus size={14} /> {t('common.add')}
            </button>
          )}
        </div>
      </div>
      <FilterBar label={t('common.filters')} controlsClassName="block">
        <input
          className="field w-full"
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
        />
      </FilterBar>

      {page.items.length === 0 ? (
        <EmptyState
          icon={isCuisine ? Utensils : MapPin}
          title={t('catalog.empty')}
          description={t('catalog.emptyHint')}
          steps={manageable ? [t('common.add')] : []}
        />
      ) : isCuisine && cuisineLayout === 'table' ? (
        <ScrollArea axis="x" className="panel">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('catalog.name')}</th>
                <th className="px-4 py-3 font-semibold">{t('catalog.type')}</th>
                <th className="px-4 py-3 font-semibold">
                  {t('catalog.description')}
                </th>
                {manageable && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {page.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/60">
                  <td className="px-4 py-3 font-semibold text-ink">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {(item as Cuisine).type}
                  </td>
                  <td className="max-w-md px-4 py-3 text-slate-500">
                    {item.description || '—'}
                  </td>
                  {manageable && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-muted hover:text-ink"
                          aria-label={`${t('catalog.edit')} ${item.name}`}
                          onClick={() => openEdit(item)}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-muted hover:text-red-500"
                          aria-label={`${t('catalog.delete')} ${item.name}`}
                          onClick={() =>
                            setDeleteTarget({ id: item.id, name: item.name })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {page.items.map((item) => (
            <article
              key={item.id}
              className={`panel relative min-w-0 overflow-hidden p-4 ${!isCuisine && (item as DiningArea).defaultImage?.imageUrl && !failedImages[item.id] ? 'bg-muted' : ''}`}
            >
              {!isCuisine &&
                (item as DiningArea).defaultImage?.imageUrl &&
                !failedImages[item.id] && (
                  <>
                    <img
                      src={(item as DiningArea).defaultImage!.imageUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover opacity-20"
                      onError={() =>
                        setFailedImages((current) => ({
                          ...current,
                          [item.id]: true,
                        }))
                      }
                    />
                    <div
                      className="absolute inset-0 bg-surface/80"
                      aria-hidden="true"
                    />
                  </>
                )}
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {!isCuisine ? (
                    <button
                      type="button"
                      className="truncate text-left font-bold text-ink hover:underline"
                      onClick={() => navigate(`/dining-areas/${item.id}`)}
                    >
                      {item.name}
                    </button>
                  ) : (
                    <h3 className="truncate font-bold text-ink">{item.name}</h3>
                  )}
                  <p className="mt-1 text-sm text-slate-500">
                    {isCuisine
                      ? (item as Cuisine).type
                      : (item as DiningArea).address}
                  </p>
                </div>
                {manageable && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-muted hover:text-ink"
                      aria-label={`${t('catalog.edit')} ${item.name}`}
                      onClick={() => openEdit(item)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-muted hover:text-red-500"
                      aria-label={`${t('catalog.delete')} ${item.name}`}
                      onClick={() =>
                        setDeleteTarget({ id: item.id, name: item.name })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="relative z-10">
                {isCuisine && item.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-slate-500">
                    {item.description}
                  </p>
                )}
                {!isCuisine && item.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-slate-500">
                    {item.description}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="btn btn-soft"
          disabled={
            !page.pageInfo.hasPreviousPage || !page.pageInfo.startCursor
          }
          onClick={() =>
            page.pageInfo.startCursor &&
            setPage(page.pageInfo.startCursor, 'backward')
          }
        >
          {t('common.previousPage')}
        </button>
        <button
          type="button"
          className="btn btn-soft"
          disabled={!page.pageInfo.hasNextPage || !page.pageInfo.endCursor}
          onClick={() =>
            page.pageInfo.endCursor &&
            setPage(page.pageInfo.endCursor, 'forward')
          }
        >
          {t('common.nextPage')}
        </button>
      </div>

      <Modal
        open={editorOpen}
        title={`${editingId ? t('catalog.edit') : t('common.add')} ${title}`}
        onClose={closeEditor}
        size={isCuisine ? 'md' : 'lg'}
      >
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">{t('catalog.name')}</span>
              <input
                className="field w-full"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
              />
            </label>
            {isCuisine && (
              <label className="space-y-1">
                <span className="label">{t('catalog.type')}</span>
                <input
                  className="field w-full"
                  value={(form as CuisineForm).type}
                  onChange={(event) =>
                    setForm({
                      ...(form as CuisineForm),
                      type: event.target.value,
                    })
                  }
                  required
                />
              </label>
            )}
          </div>
          {!isCuisine && (
            <VietnamAddressFields
              value={form as DiningAreaForm}
              onChange={(value) => setForm({ ...form, ...value })}
            />
          )}
          <label className="block space-y-1">
            <span className="label">{t('catalog.description')}</span>
            <textarea
              className="field min-h-24 w-full resize-y py-2"
              value={form.description ?? ''}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              maxLength={500}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-soft"
              onClick={closeEditor}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {deleteTarget && (
        <ConfirmDialog
          title={t('catalog.delete')}
          message={`${t('catalog.confirmDelete')} ${deleteTarget.name}`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
