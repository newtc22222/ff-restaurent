// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import FilterBar from './FilterBar';

afterEach(cleanup);

describe('FilterBar', () => {
  it('provides a labelled landmark and a mobile-safe responsive control grid', () => {
    render(
      <FilterBar
        label="Filters"
        busy
        actions={<button type="button">Clear filters</button>}
      >
        <input aria-label="Search catalog" />
        <button type="button">Sort</button>
      </FilterBar>,
    );

    const region = screen.getByRole('region', { name: 'Filters' });
    expect(region.getAttribute('aria-busy')).toBe('true');
    const controls = screen.getByLabelText('Search catalog').parentElement;
    expect(controls?.classList.contains('min-w-0')).toBe(true);
    expect(controls?.classList.contains('sm:grid-cols-2')).toBe(true);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });
});
