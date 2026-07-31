import { ImagePlus, MapPin, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router';

import type { DiningAreaDetailData } from '@/api/types';
import { useAppContext } from '@/app/providers/app-context';
import { useI18n } from '@/app/providers/i18n';
import BackButton from '@/components/ui/BackButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import SectionTitle from '@/components/ui/SectionTitle';
import { canChef } from '@/lib/permissions';

import RestaurantCard from '../restaurants/RestaurantCard';
import { useDiningAreaMediaMutation } from './dining-area-media.mutations';

export default function DiningAreaDetailPage() {
  const area = useLoaderData() as DiningAreaDetailData;
  const { user } = useAppContext();
  const { t } = useI18n();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const mediaMutation = useDiningAreaMediaMutation();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const manageable = canChef(user);

  const uploadImages = async (files: File[]) => {
    let uploadedCount = 0;
    try {
      for (const file of files) {
        await mediaMutation.mutateAsync({
          action: 'upload',
          diningAreaId: area.id,
          file,
        });
        uploadedCount += 1;
      }
      toast.success(t('toast.diningAreaImagesUploaded'));
    } catch {
      toast.error(t('toast.diningAreaImagesUploadFailed'));
    } finally {
      if (uploadedCount > 0) void revalidator.revalidate();
    }
  };

  const setDefaultImage = async (imageId: string) => {
    try {
      await mediaMutation.mutateAsync({
        action: 'default',
        diningAreaId: area.id,
        imageId,
      });
      toast.success(t('toast.diningAreaDefaultImageUpdated'));
      void revalidator.revalidate();
    } catch {
      toast.error(t('toast.diningAreaDefaultImageFailed'));
    }
  };

  const removeImage = async () => {
    if (!deleteImageId) return;
    const imageId = deleteImageId;
    setDeleteImageId(null);
    try {
      await mediaMutation.mutateAsync({
        action: 'remove',
        diningAreaId: area.id,
        imageId,
      });
      toast.success(t('toast.diningAreaImageRemoved'));
      void revalidator.revalidate();
    } catch {
      toast.error(t('toast.diningAreaImageRemoveFailed'));
    }
  };

  const defaultImage =
    area.defaultImage && !failedImages[area.defaultImage.id]
      ? area.defaultImage
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 py-2">
      <BackButton
        onClick={() => navigate('/dining-areas')}
        label={t('nav.diningAreas')}
      />

      <section className="panel relative min-h-56 overflow-hidden p-6">
        {defaultImage && (
          <>
            <img
              src={defaultImage.imageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-25"
              onError={() =>
                setFailedImages((current) => ({
                  ...current,
                  [defaultImage.id]: true,
                }))
              }
            />
            <div
              className="absolute inset-0 bg-surface/80"
              aria-hidden="true"
            />
          </>
        )}
        <div className="relative z-10 max-w-3xl">
          <SectionTitle
            title={area.name}
            subtitle={t('catalog.diningAreas.detailSubtitle')}
          />
          <p className="mt-4 flex items-start gap-2 text-sm text-slate-500">
            <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{area.address}</span>
          </p>
          {area.description && (
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {area.description}
            </p>
          )}
        </div>
      </section>

      <section className="panel space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">
              {t('catalog.diningAreas.images')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('catalog.diningAreas.imagesHint')}
            </p>
          </div>
          {manageable && (
            <label className="btn btn-primary cursor-pointer">
              <ImagePlus size={14} /> {t('catalog.diningAreas.addImages')}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  if (files.length > 0) void uploadImages(files);
                }}
              />
            </label>
          )}
        </div>

        {area.images.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title={t('catalog.diningAreas.noImages')}
            description={t('catalog.diningAreas.noImagesHint')}
            steps={manageable ? [t('catalog.diningAreas.addImages')] : []}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {area.images.map((image) => {
              if (failedImages[image.id]) return null;
              const isDefault = area.defaultImage?.id === image.id;
              return (
                <article
                  key={image.id}
                  className="overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <img
                    src={image.imageUrl}
                    alt={area.name}
                    className="aspect-[4/3] w-full object-cover"
                    onError={() =>
                      setFailedImages((current) => ({
                        ...current,
                        [image.id]: true,
                      }))
                    }
                  />
                  <div className="flex items-center justify-between gap-2 p-3">
                    <span
                      className={`chip ${isDefault ? 'chip-saffron' : 'chip-muted'}`}
                    >
                      {isDefault && <Star size={11} aria-hidden="true" />}
                      {isDefault
                        ? t('catalog.diningAreas.defaultImage')
                        : t('catalog.diningAreas.galleryImage')}
                    </span>
                    {manageable && (
                      <div className="flex items-center gap-1">
                        {!isDefault && (
                          <button
                            type="button"
                            className="btn btn-soft h-8 px-2 text-xs"
                            onClick={() => void setDefaultImage(image.id)}
                          >
                            <Star size={12} /> {t('common.setDefault')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-muted hover:text-red-500"
                          aria-label={`${t('media.remove')} ${area.name}`}
                          onClick={() => setDeleteImageId(image.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            title={t('catalog.diningAreas.restaurants')}
            subtitle={t('catalog.diningAreas.restaurantsHint')}
          />
          <button
            type="button"
            className="btn btn-soft"
            onClick={() =>
              navigate(
                `/restaurants?diningAreaId=${encodeURIComponent(area.id)}`,
              )
            }
          >
            {t('catalog.diningAreas.viewAllRestaurants')}
          </button>
        </div>
        {area.restaurants.items.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={t('catalog.diningAreas.noRestaurants')}
            description={t('catalog.diningAreas.noRestaurantsHint')}
            steps={[]}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {area.restaurants.items.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onOpen={() => navigate(`/restaurants/${restaurant.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {deleteImageId && (
        <ConfirmDialog
          title={t('catalog.diningAreas.removeImage')}
          message={t('catalog.diningAreas.confirmRemoveImage')}
          onCancel={() => setDeleteImageId(null)}
          onConfirm={() => void removeImage()}
        />
      )}
    </div>
  );
}
