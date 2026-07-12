import { useCallback } from 'react';
import { useFetcher } from 'react-router';

interface MutateOptions {
  /** Error message used when the thrown value is not an Error. */
  fallback: string;
  /** Clear the error state before submitting (default true). */
  clearFirst?: boolean;
  /** Route to submit to; defaults to the current route's action. */
  action?: string;
  /** Runs after a successful submit. */
  onSuccess?: () => void;
}

/**
 * Wraps a fetcher submit to the router's mutationAction with the shared
 * clear-error / submit / set-error-on-failure flow used across pages.
 * `setError` may be the app context error setter or a page-local one.
 */
export function useMutation(setError: (error: string | null) => void) {
  const fetcher = useFetcher();

  const mutate = useCallback(
    async (
      body: Record<string, unknown>,
      { fallback, clearFirst = true, action, onSuccess }: MutateOptions,
    ) => {
      if (clearFirst) setError(null);
      try {
        await fetcher.submit(body as never, {
          method: 'post',
          encType: 'application/json',
          ...(action ? { action } : {}),
        });
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : fallback);
      }
    },
    [fetcher, setError],
  );

  return { fetcher, mutate };
}
