import { describe, expect, it } from 'vitest';

import {
  PLATFORM_BADGE_TOKENS,
  PLATFORM_LABELS,
  platformBadgeClassName,
  supportedPlatformValues,
} from './platform-link-tokens';

describe('platform badge tokens', () => {
  it('defines one light and dark token pair for every supported platform', () => {
    expect(Object.keys(PLATFORM_BADGE_TOKENS).sort()).toEqual(
      [...supportedPlatformValues].sort(),
    );

    for (const platform of supportedPlatformValues) {
      const token = PLATFORM_BADGE_TOKENS[platform];
      const name = platform.toLocaleLowerCase().replaceAll('_', '-');

      expect(token.className).toBe(`platform-badge-${name}`);
      expect(token.light).toEqual({
        background: `--color-platform-${name}-bg`,
        text: `--color-platform-${name}-text`,
      });
      expect(token.dark).toEqual({
        background: `--color-platform-${name}-dark-bg`,
        text: `--color-platform-${name}-dark-text`,
      });
      expect(platformBadgeClassName(platform)).toBe(token.className);
      expect(PLATFORM_LABELS[platform]).toBeTruthy();
    }
  });

  it('keeps each platform badge class canonical and distinct', () => {
    const classes = supportedPlatformValues.map(platformBadgeClassName);

    expect(new Set(classes).size).toBe(supportedPlatformValues.length);
  });
});
