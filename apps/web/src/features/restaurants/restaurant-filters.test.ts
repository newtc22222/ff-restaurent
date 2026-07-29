import { describe, expect, it } from 'vitest';

import {
  readCuisineFilter,
  updateCuisineFilter,
  updateCuisineMatch,
} from './restaurant-filters';

describe('restaurant Cuisine filters', () => {
  it('reads direct links for all and primary Cuisine matching', () => {
    expect(
      readCuisineFilter(new URLSearchParams('cuisineId=all-cuisine')),
    ).toEqual({
      cuisineId: 'all-cuisine',
      match: 'all',
    });
    expect(
      readCuisineFilter(
        new URLSearchParams('primaryCuisineId=primary-cuisine'),
      ),
    ).toEqual({
      cuisineId: 'primary-cuisine',
      match: 'primary',
    });
  });

  it('replaces conflicting Cuisine keys and resets pagination atomically', () => {
    const next = updateCuisineFilter(
      new URLSearchParams(
        'search=pho&cuisineId=old&primaryCuisineId=stale&cursor=entry-1&direction=forward',
      ),
      'canonical',
      'all',
    );

    expect(next.get('search')).toBe('pho');
    expect(next.get('cuisineId')).toBe('canonical');
    expect(next.has('primaryCuisineId')).toBe(false);
    expect(next.has('cursor')).toBe(false);
    expect(next.has('direction')).toBe(false);
  });

  it('moves the active Cuisine between match modes and clears both keys', () => {
    const switched = updateCuisineMatch(
      new URLSearchParams(
        'primaryCuisineId=canonical&cursor=entry-1&direction=backward',
      ),
      'all',
    );
    expect(switched.get('cuisineId')).toBe('canonical');
    expect(switched.has('primaryCuisineId')).toBe(false);
    expect(switched.has('cursor')).toBe(false);
    expect(switched.has('direction')).toBe(false);

    const cleared = updateCuisineFilter(switched, '', 'all');
    expect(cleared.has('cuisineId')).toBe(false);
    expect(cleared.has('primaryCuisineId')).toBe(false);
  });
});
