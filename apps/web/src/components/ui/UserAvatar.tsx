import { useState } from 'react';
import { initials } from '@/lib/user-display';

export interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | number;
  className?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-7 w-7 text-2xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

/** Shared user avatar primitive supporting image loading, error fallback to initials, and flexible sizing. */
export default function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
  alt,
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const isFailed = Boolean(avatarUrl && failedUrl === avatarUrl);
  const showImage = Boolean(avatarUrl && !isFailed);

  const dimensionClass = typeof size === 'string' ? SIZE_CLASSES[size] : '';
  const inlineStyle =
    typeof size === 'number' ? { width: size, height: size } : undefined;

  const displayName = alt !== undefined ? alt : name;
  const isDecorative = displayName === '';

  if (showImage) {
    return (
      <div
        className={`relative inline-flex shrink-0 overflow-hidden rounded-full ${dimensionClass} ${className}`}
        style={inlineStyle}
      >
        <img
          src={avatarUrl!}
          alt={displayName}
          onError={() => setFailedUrl(avatarUrl!)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-bold text-ink select-none ${dimensionClass} ${className}`}
      style={inlineStyle}
      {...(isDecorative
        ? { 'aria-hidden': 'true' }
        : { 'aria-label': displayName, role: 'img' })}
    >
      {initials(name)}
    </div>
  );
}
