import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function RestaurantBanner({
  name,
  url,
}: {
  name: string;
  url?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  return (
    <div className="mb-5 h-44 overflow-hidden rounded-xl bg-gradient-to-br from-orange-100 via-amber-50 to-emerald-100 dark:from-orange-950 dark:via-slate-900 dark:to-emerald-950">
      {url && !failed ? (
        <img
          alt={`${name} banner`}
          className="h-full w-full object-cover"
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
    </div>
  );
}
