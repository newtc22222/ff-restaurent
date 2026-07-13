import { ExternalLink, Heart, ThumbsUp } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { isHead } from '../lib/helpers';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import FullPageLayout, {
  BackButton,
} from '../components/layout/FullPageLayout';
import ScrollArea from '../components/ui/ScrollArea';

/**
 * RestaurantDetailPage displays comprehensive information about a restaurant including its links,
 * and enables managers to archive/restore entries.
 */
export default function RestaurantDetailPage() {
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const { user, restaurants, setError } = useAppContext();
  const { t } = useI18n();
  const { mutate } = useMutation(setError);

  const restaurant = restaurants.find(
    (candidate) => candidate.id === restaurantId,
  );
  if (!restaurant) return <Navigate to="/restaurants" replace />;

  const onBack = () => navigate('/restaurants');

  const toggleFavorite = () =>
    mutate(
      { intent: 'restaurant-favorite' },
      { fallback: 'Could not toggle favorite', clearFirst: false },
    );

  const runAction = (status: 'archive' | 'restore', fallback: string) =>
    mutate(
      { intent: 'restaurant-status', status },
      { fallback, onSuccess: onBack }, // Go back after archiving/restoring
    );

  return (
    <FullPageLayout onProfile={onBack}>
      <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-hidden">
        <ScrollArea className="h-full" contentClassName="px-4 py-8">
          <BackButton onClick={onBack} label={t('nav.restaurants')} />

          <section className="panel p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[22px] font-bold text-ink">
                  {restaurant.name}
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {restaurant.type} / {restaurant.cuisineType}
                </p>
                <p className="mt-1 text-[14px]">{restaurant.address}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${
                  restaurant.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                }`}
              >
                {restaurant.status}
              </span>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all ${
                  restaurant.isFavoritedByMe
                    ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950 dark:text-red-400'
                    : 'border-border text-slate-500 hover:text-ink'
                }`}
                onClick={toggleFavorite}
              >
                <Heart
                  size={14}
                  fill={restaurant.isFavoritedByMe ? 'currentColor' : 'none'}
                />
                {restaurant.isFavoritedByMe
                  ? '♥ ' + t('restaurants.favorite')
                  : t('restaurants.favorite')}
              </button>
              {restaurant.isRecommended && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <ThumbsUp size={14} /> {t('restaurants.recommended')}
                </span>
              )}
            </div>

            {restaurant.links && restaurant.links.length > 0 && (
              <div className="mb-4">
                <h3 className="label mb-2">Links</h3>
                <div className="flex flex-wrap gap-2">
                  {restaurant.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-muted"
                    >
                      <ExternalLink size={12} /> {link.label || link.url}
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
                    onClick={() => runAction('archive', 'Could not archive')}
                  >
                    {t('bills.archive')}
                  </button>
                )}
                {restaurant.status === 'ARCHIVED' && (
                  <button
                    className="btn btn-soft flex-1 hover:border-emerald-300 hover:text-emerald-500"
                    onClick={() => runAction('restore', 'Could not restore')}
                  >
                    {t('bills.restore')}
                  </button>
                )}
              </div>
            )}
          </section>
        </ScrollArea>
      </main>
    </FullPageLayout>
  );
}
