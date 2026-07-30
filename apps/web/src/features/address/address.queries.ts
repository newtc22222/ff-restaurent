import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { AddressDirectoryResult } from '@/api/types';
import { session } from '@/lib/session';

export type DirectoryLoader = (path: string) => Promise<AddressDirectoryResult>;

export const defaultDirectoryLoader: DirectoryLoader = (path) =>
  session.api().request<AddressDirectoryResult>(path);

export const addressQueryKeys = {
  all: ['address-directory'] as const,
  provinces: () => [...addressQueryKeys.all, 'provinces'] as const,
  wards: (provinceCode: string) =>
    [...addressQueryKeys.all, 'wards', provinceCode] as const,
};

export const useAddressDirectory = (loadDirectory: DirectoryLoader) => {
  const queryClient = useQueryClient();
  const loadProvinces = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: addressQueryKeys.provinces(),
        queryFn: () => loadDirectory('/address/provinces'),
        staleTime: 5 * 60_000,
        retry: false,
      }),
    [loadDirectory, queryClient],
  );
  const loadWards = useCallback(
    (provinceCode: string) =>
      queryClient.fetchQuery({
        queryKey: addressQueryKeys.wards(provinceCode),
        queryFn: () =>
          loadDirectory(
            `/address/provinces/${encodeURIComponent(provinceCode)}/wards`,
          ),
        staleTime: 5 * 60_000,
        retry: false,
      }),
    [loadDirectory, queryClient],
  );

  return { loadProvinces, loadWards };
};
