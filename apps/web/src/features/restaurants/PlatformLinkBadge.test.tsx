// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PlatformLinkBadge from './PlatformLinkBadge';
import { supportedPlatformValues } from './platform-link-tokens';

afterEach(cleanup);

describe('PlatformLinkBadge', () => {
  it('renders every supported platform with its canonical badge class', () => {
    for (const platform of supportedPlatformValues) {
      const { unmount } = render(
        <PlatformLinkBadge platform={platform} label={null} />,
      );
      const badge = screen.getByText(/.+/);

      expect(badge.className).toContain('platform-badge');
      expect(badge.className).toContain(
        `platform-badge-${platform.toLocaleLowerCase().replaceAll('_', '-')}`,
      );
      unmount();
    }
  });
});
