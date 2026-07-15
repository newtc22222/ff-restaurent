import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useFetcher } from 'react-router';
import { useI18n } from '../app/providers/i18n';
import { resultErrorMessage } from '../lib/result-messages';

interface MutateOptions {
  /** Error message used when the thrown value is not an Error. */
  fallback: string;
  /** Localized success message. Omit for intentionally silent mutations. */
  success?: string;
  /** The route action redirects and owns the success toast. */
  redirects?: boolean;
  /** Route to submit to; defaults to the current route's action. */
  action?: string;
  /** Runs after a successful submit. */
  onSuccess?: (data: unknown) => void;
}

type MutationResult = {
  error?: unknown;
  code?: unknown;
};

const hasMutationError = (
  data: unknown,
): data is { error: string; code?: unknown } =>
  typeof data === 'object' &&
  data !== null &&
  'error' in data &&
  typeof (data as MutationResult).error === 'string';

/**
 * Wraps a fetcher submit to the router's mutationAction with the shared
 * submit / localized-toast result flow used across pages.
 */
export function useMutation() {
  const { t } = useI18n();
  const fetcher = useFetcher();
  const pendingResult = useRef<{
    fallback: string;
    success?: string;
    onSuccess?: (data: unknown) => void;
  } | null>(null);

  useEffect(() => {
    if (fetcher.state !== 'idle' || !pendingResult.current) return;

    const { fallback, success, onSuccess } = pendingResult.current;
    pendingResult.current = null;

    if (hasMutationError(fetcher.data)) {
      toast.error(resultErrorMessage(fetcher.data.code, fallback, t));
      return;
    }

    if (fetcher.data instanceof Error) {
      toast.error(fallback);
      return;
    }

    if (success) toast.success(success);
    onSuccess?.(fetcher.data);
  }, [fetcher.data, fetcher.state, t]);

  const mutate = useCallback(
    async (
      body: Record<string, unknown>,
      {
        fallback,
        success,
        redirects = false,
        action,
        onSuccess,
      }: MutateOptions,
    ) => {
      pendingResult.current = {
        fallback,
        success: redirects ? undefined : success,
        onSuccess,
      };
      try {
        await fetcher.submit(
          {
            ...body,
            ...(redirects && success ? { toastSuccess: success } : {}),
          } as never,
          {
            method: 'post',
            encType: 'application/json',
            ...(action ? { action } : {}),
          },
        );
      } catch {
        pendingResult.current = null;
        toast.error(fallback);
      }
    },
    [fetcher],
  );

  return { fetcher, mutate };
}
