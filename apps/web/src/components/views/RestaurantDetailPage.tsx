import { ArrowLeft, ExternalLink, Heart, ThumbsUp } from 'lucide-react';
import { useFetcher } from 'react-router';
import type { RestaurantEntry, User } from '../../api.js';
import type { Locale } from '../../i18n.js';
import type { Theme } from '../../theme.js';
import { isHead } from '../../utils/helpers.js';
import AppHeader from '../layout/AppHeader.js';
import ScrollArea from '../ui/ScrollArea.js';

interface RestaurantDetailPageProps {
  /**
   * The API client instance.
   */
  /**
   * The current logged-in user.
   */
  user: User;
  /**
   * The restaurant entry to display.
   */
  restaurant: RestaurantEntry;
  /**
   * Function to refresh application data.
   */
  /**
   * Action trigger to go back.
   */
  onBack: () => void;
  /**
   * Action trigger to sign out.
   */
  onSignOut: () => void;
  /**
   * Function to update global error state.
   */
  setError: (error: string | null) => void;
  /**
   * Translation utility function.
   */
  t: (key: string) => string;
  /**
   * Current active locale.
   */
  locale: Locale;
  /**
   * Callback to set locale.
   */
  setLocale: (locale: Locale) => void;
  /**
   * Current active theme.
   */
  theme: Theme;
  /**
   * Callback to set theme.
   */
  setTheme: (theme: Theme) => void;
}

/**
 * RestaurantDetailPage displays comprehensive information about a restaurant including its links,
 * and enables managers to archive/restore entries.
 */
export default function RestaurantDetailPage({
  user,
  restaurant,
  onBack,
  onSignOut,
  setError,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
}: RestaurantDetailPageProps) {
  const fetcher = useFetcher();
  const toggleFavorite = async () => {
    try {
      await fetcher.submit(
        { intent: 'restaurant-favorite' },
        { method: 'post', encType: 'application/json' },
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not toggle favorite',
      );
    }
  };

  const runAction = async (status: 'archive' | 'restore', fallback: string) => {
    setError(null);
    try {
      await fetcher.submit(
        { intent: 'restaurant-status', status },
        { method: 'post', encType: 'application/json' },
      );
      onBack(); // Go back after archiving/restoring
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppHeader
        user={user}
        onSignOut={onSignOut}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
        onProfile={onBack}
      />
      <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-hidden">
        <ScrollArea className="h-full" contentClassName="px-4 py-8">
          <button
            className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
            onClick={onBack}
          >
            <ArrowLeft size={14} /> {t('nav.restaurants')}
          </button>

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
    </div>
  );
}
