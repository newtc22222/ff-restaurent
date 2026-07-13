import { useCallback, useEffect, useRef } from 'react';
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

type MutationResult = {
  error?: unknown;
};

const hasMutationError = (data: unknown): data is { error: string } =>
  typeof data === 'object' &&
  data !== null &&
  'error' in data &&
  typeof (data as MutationResult).error === 'string';

/**
 * Wraps a fetcher submit to the router's mutationAction with the shared
 * clear-error / submit / set-error-on-failure flow used across pages.
 * `setError` may be the app context error setter or a page-local one.
 */
export function useMutation(setError: (error: string | null) => void) {
  const fetcher = useFetcher();
  const pendingResult = useRef<{
    fallback: string;
    onSuccess?: () => void;
  } | null>(null);

  useEffect(() => {
    if (fetcher.state !== 'idle' || !pendingResult.current) return;

    const { fallback, onSuccess } = pendingResult.current;
    pendingResult.current = null;

    if (hasMutationError(fetcher.data)) {
      setError(fetcher.data.error);
      return;
    }

    if (fetcher.data instanceof Error) {
      setError(fetcher.data.message || fallback);
      return;
    }

    onSuccess?.();
  }, [fetcher.data, fetcher.state, setError]);

  const mutate = useCallback(
    async (
      body: Record<string, unknown>,
      { fallback, clearFirst = true, action, onSuccess }: MutateOptions,
    ) => {
      if (clearFirst) setError(null);
      pendingResult.current = { fallback, onSuccess };
      try {
        await fetcher.submit(body as never, {
          method: 'post',
          encType: 'application/json',
          ...(action ? { action } : {}),
        });
      } catch (err) {
        pendingResult.current = null;
        setError(err instanceof Error ? err.message : fallback);
      }
    },
    [fetcher, setError],
  );

  return { fetcher, mutate };
}
