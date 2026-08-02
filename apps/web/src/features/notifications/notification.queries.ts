import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import type { Notification } from '@/api/types';
import { session } from '@/lib/session';

import { connectNotificationStream } from './notification-stream';

export const notificationQueryKeys = {
  all: ['notifications'] as const,
  list: (userId: string) => ['notifications', userId] as const,
};

export const useNotifications = (
  userId: string,
  initialData: Notification[],
) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => notificationQueryKeys.list(userId), [userId]);
  const query = useQuery({
    queryKey,
    queryFn: () => session.api().request<Notification[]>('/notifications'),
    initialData,
  });

  useEffect(() => {
    queryClient.setQueryData(queryKey, initialData);
  }, [initialData, queryClient, queryKey]);

  return query;
};

export const useNotificationStream = (userId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = session.getToken();
    if (!token) return;
    const controller = new AbortController();
    const invalidate = () =>
      queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.list(userId),
        refetchType: 'active',
      });
    void connectNotificationStream({
      token,
      signal: controller.signal,
      onConnected: invalidate,
      onNotification: invalidate,
    }).catch(() => undefined);

    return () => controller.abort();
  }, [queryClient, userId]);
};
