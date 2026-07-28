// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router';
import { useUrlFilters } from './useUrlFilters';

function FilterProbe() {
  const { searchValue, setSearchValue, setQuery, setPage, clearFilters } =
    useUrlFilters();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  return (
    <>
      <input
        aria-label="Search"
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
      />
      <button type="button" onClick={() => setQuery('visibility', 'owned')}>
        Owned
      </button>
      <button type="button" onClick={() => setPage('next-cursor', 'forward')}>
        Next page
      </button>
      <button type="button" onClick={clearFilters}>
        Clear
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
      <output aria-label="Location">{location.search}</output>
      <output aria-label="Navigation type">{navigationType}</output>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useUrlFilters', () => {
  it('debounces text with replacement history and combines discrete filters immediately', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={['/catalog?cursor=old']}>
        <FilterProbe />
      </MemoryRouter>,
    );

    const search = screen.getByRole('textbox', { name: 'Search' });
    fireEvent.change(search, { target: { value: 'p' } });
    fireEvent.change(search, { target: { value: 'ph' } });
    fireEvent.change(search, { target: { value: 'pho' } });
    expect(screen.getByLabelText('Location').textContent).toBe('?cursor=old');

    act(() => vi.advanceTimersByTime(299));
    expect(screen.getByLabelText('Location').textContent).toBe('?cursor=old');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText('Location').textContent).toBe('?search=pho');
    expect(screen.getByLabelText('Navigation type').textContent).toBe(
      'REPLACE',
    );

    fireEvent.change(search, { target: { value: 'noodles' } });
    fireEvent.click(screen.getByRole('button', { name: 'Owned' }));
    expect(screen.getByLabelText('Location').textContent).toBe(
      '?search=noodles&visibility=owned',
    );
    expect(screen.getByLabelText('Navigation type').textContent).toBe('PUSH');
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByLabelText('Location').textContent).toBe(
      '?search=noodles&visibility=owned',
    );

    fireEvent.change(search, { target: { value: 'stale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('Location').textContent).toBe('');
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByLabelText('Location').textContent).toBe('');
  });

  it('treats browser history as authoritative and cancels stale text', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter
        initialEntries={[
          '/catalog?search=first',
          '/catalog?search=second&visibility=public',
        ]}
        initialIndex={1}
      >
        <FilterProbe />
      </MemoryRouter>,
    );

    const search = screen.getByRole('textbox', { name: 'Search' });
    expect((search as HTMLInputElement).value).toBe('second');
    fireEvent.change(search, { target: { value: 'stale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect((search as HTMLInputElement).value).toBe('first');
    expect(screen.getByLabelText('Location').textContent).toBe('?search=first');
    act(() => vi.advanceTimersByTime(300));
    expect((search as HTMLInputElement).value).toBe('first');
    expect(screen.getByLabelText('Location').textContent).toBe('?search=first');
  });

  it('drops an old-result cursor when pagination races a pending search', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter
        initialEntries={[
          '/catalog?search=old&cursor=old-cursor&direction=forward',
        ]}
      >
        <FilterProbe />
      </MemoryRouter>,
    );

    const search = screen.getByRole('textbox', { name: 'Search' });
    fireEvent.change(search, { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByLabelText('Location').textContent).toBe('?search=new');
    expect(screen.getByLabelText('Navigation type').textContent).toBe(
      'REPLACE',
    );
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByLabelText('Location').textContent).toBe('?search=new');
  });
});
