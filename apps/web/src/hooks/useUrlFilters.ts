import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

type QueryValue = string | null | undefined;

type UseUrlFiltersOptions = {
  searchKey?: string;
  debounceMs?: number;
  paginationKeys?: string[];
};

const DEFAULT_PAGINATION_KEYS = ['cursor', 'direction'];

const applyValue = (
  params: URLSearchParams,
  key: string,
  value: QueryValue,
) => {
  if (value) params.set(key, value);
  else params.delete(key);
};

/**
 * Keeps free-text route search responsive locally while treating the URL as
 * the authoritative, shareable filter state.
 *
 * Text commits replace the current history entry after a short delay.
 * Discrete filters commit immediately, include any pending text, and reset
 * cursor pagination. A URL change (including browser history) cancels stale
 * work and synchronizes the local input immediately.
 */
export const useUrlFilters = ({
  searchKey = 'search',
  debounceMs = 300,
  paginationKeys = DEFAULT_PAGINATION_KEYS,
}: UseUrlFiltersOptions = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const serializedParams = searchParams.toString();
  const paramsRef = useRef(new URLSearchParams(searchParams));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const [searchValue, setSearchValueState] = useState(
    searchParams.get(searchKey) ?? '',
  );
  const searchValueRef = useRef(searchValue);

  const cancelPending = useCallback(() => {
    generationRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetPagination = useCallback(
    (params: URLSearchParams) => {
      paginationKeys.forEach((key) => params.delete(key));
    },
    [paginationKeys],
  );

  const includeLocalSearch = useCallback(
    (params: URLSearchParams) => {
      applyValue(params, searchKey, searchValueRef.current);
    },
    [searchKey],
  );

  useEffect(() => {
    cancelPending();
    const next = new URLSearchParams(serializedParams);
    paramsRef.current = next;
    const nextSearch = next.get(searchKey) ?? '';
    searchValueRef.current = nextSearch;
    setSearchValueState(nextSearch);
  }, [cancelPending, searchKey, serializedParams]);

  useEffect(() => cancelPending, [cancelPending]);

  const setSearchValue = useCallback(
    (value: string) => {
      cancelPending();
      searchValueRef.current = value;
      setSearchValueState(value);
      const generation = generationRef.current;
      timerRef.current = setTimeout(() => {
        if (generation !== generationRef.current) return;
        const next = new URLSearchParams(paramsRef.current);
        resetPagination(next);
        applyValue(next, searchKey, value);
        paramsRef.current = next;
        timerRef.current = null;
        setSearchParams(next, { replace: true });
      }, debounceMs);
    },
    [cancelPending, debounceMs, resetPagination, searchKey, setSearchParams],
  );

  const setQuery = useCallback(
    (key: string, value?: string) => {
      cancelPending();
      const next = new URLSearchParams(paramsRef.current);
      includeLocalSearch(next);
      resetPagination(next);
      applyValue(next, key, value);
      paramsRef.current = next;
      setSearchParams(next);
    },
    [cancelPending, includeLocalSearch, resetPagination, setSearchParams],
  );

  const setPage = useCallback(
    (cursor: string, direction?: 'forward' | 'backward') => {
      cancelPending();
      const next = new URLSearchParams(paramsRef.current);
      includeLocalSearch(next);
      next.set('cursor', cursor);
      applyValue(next, 'direction', direction);
      paramsRef.current = next;
      setSearchParams(next);
    },
    [cancelPending, includeLocalSearch, setSearchParams],
  );

  const replaceParams = useCallback(
    (
      nextParams:
        URLSearchParams | ((current: URLSearchParams) => URLSearchParams),
    ) => {
      cancelPending();
      const current = new URLSearchParams(paramsRef.current);
      const resolved =
        typeof nextParams === 'function' ? nextParams(current) : nextParams;
      const next = new URLSearchParams(resolved);
      includeLocalSearch(next);
      resetPagination(next);
      paramsRef.current = next;
      setSearchParams(next);
    },
    [cancelPending, includeLocalSearch, resetPagination, setSearchParams],
  );

  const clearFilters = useCallback(() => {
    cancelPending();
    searchValueRef.current = '';
    setSearchValueState('');
    const next = new URLSearchParams();
    paramsRef.current = next;
    setSearchParams(next);
  }, [cancelPending, setSearchParams]);

  return {
    searchParams,
    searchValue,
    setSearchValue,
    setQuery,
    setPage,
    replaceParams,
    clearFilters,
  };
};
