import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export default function RestaurantBanner({
  name,
  url,
  logoUrl,
  overlay,
  onBannerClick,
  onLogoClick,
  bannerAriaLabel,
  logoAriaLabel,
}: {
  name: string;
  url?: string | null;
  logoUrl?: string | null;
  /** Optional identity block (name/meta/badges) rendered over the banner gradient. */
  overlay?: ReactNode;
  /** When provided, renders a transparent overlay button that opens a full-size banner preview. */
  onBannerClick?: () => void;
  /** When provided, makes the logo clickable to open a full-size logo preview. */
  onLogoClick?: () => void;
  bannerAriaLabel?: string;
  logoAriaLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  return (
    <div
      className="ticket-edge relative mb-5 flex h-48 items-end overflow-hidden rounded-xl bg-gradient-to-br from-orange-100 via-amber-50 to-emerald-100 bg-cover bg-center dark:from-orange-950 dark:via-slate-900 dark:to-emerald-950"
      style={url && !failed ? { backgroundImage: `url(${url})` } : undefined}
    >
      {url && !failed ? (
        <img
          alt={`${name} banner`}
          className="sr-only"
          src={url}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          data-testid="restaurant-banner-fallback"
          className="flex h-full items-center justify-center text-slate-400"
        >
          <ImageOff aria-hidden="true" size={32} />
          <span className="sr-only">Banner unavailable</span>
        </div>
      )}
      {url && !failed && onBannerClick && (
        <button
          type="button"
          className="absolute inset-0 z-[5] h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron"
          aria-label={bannerAriaLabel ?? `${name} banner`}
          onClick={onBannerClick}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
      <div className="relative z-10 flex w-full items-end justify-between gap-3 p-4">
        <div className="flex items-end gap-3">
          {logoUrl &&
            (onLogoClick ? (
              <button
                type="button"
                className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                aria-label={logoAriaLabel ?? `${name} logo`}
                onClick={onLogoClick}
              >
                <img
                  src={logoUrl}
                  alt={`${name} logo`}
                  className="h-16 w-16 shrink-0 rounded-xl border-2 border-white bg-white object-cover shadow-lg"
                />
              </button>
            ) : (
              <img
                src={logoUrl}
                alt={`${name} logo`}
                className="h-16 w-16 shrink-0 rounded-xl border-2 border-white bg-white object-cover shadow-lg"
              />
            ))}
          {overlay}
        </div>
      </div>
    </div>
  );
}
