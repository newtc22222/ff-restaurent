// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RestaurantBanner from './RestaurantBanner';

afterEach(cleanup);

describe('RestaurantBanner', () => {
  it('renders a clickable overlay button over the banner when onBannerClick is given', () => {
    const onBannerClick = vi.fn();
    render(
      <RestaurantBanner
        name="Lunch Place"
        url="https://example.com/banner.jpg"
        onBannerClick={onBannerClick}
        bannerAriaLabel="View banner for Lunch Place"
      />,
    );

    fireEvent.click(screen.getByLabelText('View banner for Lunch Place'));
    expect(onBannerClick).toHaveBeenCalledTimes(1);
  });

  it('does not render a banner overlay button when onBannerClick is omitted', () => {
    render(
      <RestaurantBanner
        name="Lunch Place"
        url="https://example.com/banner.jpg"
      />,
    );

    expect(screen.queryByLabelText('Lunch Place banner')).toBeNull();
  });

  it('does not render a banner overlay button when there is no banner url', () => {
    const onBannerClick = vi.fn();
    render(
      <RestaurantBanner name="Lunch Place" onBannerClick={onBannerClick} />,
    );

    expect(screen.queryByLabelText('Lunch Place banner')).toBeNull();
  });

  it('makes the logo clickable when onLogoClick is given', () => {
    const onLogoClick = vi.fn();
    render(
      <RestaurantBanner
        name="Lunch Place"
        logoUrl="https://example.com/logo.png"
        onLogoClick={onLogoClick}
        logoAriaLabel="View logo for Lunch Place"
      />,
    );

    fireEvent.click(screen.getByLabelText('View logo for Lunch Place'));
    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });

  it('renders a non-interactive logo image when onLogoClick is omitted', () => {
    render(
      <RestaurantBanner
        name="Lunch Place"
        logoUrl="https://example.com/logo.png"
      />,
    );

    expect(screen.getByAltText('Lunch Place logo')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
