import type { RestaurantPlatform } from '@/api/types';

import { platformBadgeClassName, platformLabel } from './platform-link-tokens';

export default function PlatformLinkBadge({
  platform,
  label,
  className = '',
}: {
  platform: RestaurantPlatform;
  label?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`platform-badge ${platformBadgeClassName(platform)} ${className}`}
    >
      {label?.trim() || platformLabel(platform)}
    </span>
  );
}
