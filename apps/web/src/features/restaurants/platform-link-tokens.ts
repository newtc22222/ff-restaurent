import { RESTAURANT_PLATFORM_VALUES } from '@ff-restaurent/shared';

import type { RestaurantPlatform } from '@/api/types';

type PlatformColorVariables = {
  background: string;
  text: string;
};

export type PlatformBadgeToken = {
  className: string;
  light: PlatformColorVariables;
  dark: PlatformColorVariables;
};

const platformBadgeToken = (name: string): PlatformBadgeToken => ({
  className: `platform-badge-${name}`,
  light: {
    background: `--color-platform-${name}-bg`,
    text: `--color-platform-${name}-text`,
  },
  dark: {
    background: `--color-platform-${name}-dark-bg`,
    text: `--color-platform-${name}-dark-text`,
  },
});

/** Presentation-only labels and theme tokens for normalized platform links. */
export const PLATFORM_LABELS: Record<RestaurantPlatform, string> = {
  GRAB: 'Grab',
  SHOPEE_FOOD: 'ShopeeFood',
  BE_FOOD: 'beFood',
  GOJEK: 'Gojek',
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  OTHER: 'Other',
};

export const PLATFORM_BADGE_TOKENS = {
  GRAB: platformBadgeToken('grab'),
  SHOPEE_FOOD: platformBadgeToken('shopee-food'),
  BE_FOOD: platformBadgeToken('be-food'),
  GOJEK: platformBadgeToken('gojek'),
  WEBSITE: platformBadgeToken('website'),
  FACEBOOK: platformBadgeToken('facebook'),
  OTHER: platformBadgeToken('other'),
} satisfies Record<RestaurantPlatform, PlatformBadgeToken>;

export const platformLabel = (platform: RestaurantPlatform) =>
  PLATFORM_LABELS[platform];

export const platformBadgeClassName = (platform: RestaurantPlatform) =>
  PLATFORM_BADGE_TOKENS[platform].className;

export const supportedPlatformValues = RESTAURANT_PLATFORM_VALUES;
