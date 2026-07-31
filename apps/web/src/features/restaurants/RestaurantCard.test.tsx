// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RestaurantCard from './RestaurantCard';

vi.mock('@/app/providers/i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'restaurants.favorite': 'Favorite',
        'restaurants.recommended': 'Recommended',
      })[key] ?? key,
  }),
}));

const restaurant = {
  id: 'restaurant-1',
  name: 'Bánh & Bill',
  address: '4 Đường Buổi Sáng',
  type: 'Tiệm bánh',
  status: 'ACTIVE',
  avatarUrl: null,
  platformLinks: [],
  cuisines: [],
  isFavorite: false,
  isFavoritedByMe: false,
  isRecommended: false,
} as never;

afterEach(cleanup);

describe('RestaurantCard collection tones', () => {
  it('uses Chili styling for Favorites and Basil styling for Recommended', () => {
    const { rerender } = render(
      <RestaurantCard
        restaurant={restaurant}
        collectionType="FAVORITES"
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('article').className).toContain('border-chili/40');
    expect(screen.getByRole('article').className).toContain(
      'ticket-edge-chili',
    );

    rerender(
      <RestaurantCard
        restaurant={restaurant}
        collectionType="RECOMMENDED"
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('article').className).toContain('border-basil/40');
    expect(screen.getByRole('article').className).toContain(
      'ticket-edge-basil',
    );
  });
});
