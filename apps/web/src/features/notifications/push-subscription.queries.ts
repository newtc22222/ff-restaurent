import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { pushSubscriptionEndpoints } from '@/api/endpoints';
import { requestPushToken } from '@/lib/push';
import { session } from '@/lib/session';

type Locale = 'vi' | 'en';

export const usePushSubscription = (locale: Locale) => {
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const registerMutation = useMutation({
    mutationFn: async ({ prompt }: { prompt: boolean }) => {
      const result = await requestPushToken({ prompt });
      if (result.status !== 'registered') return result;
      const subscription = await pushSubscriptionEndpoints.register(
        session.api(),
        { fcmToken: result.token, locale },
      );
      return { ...result, subscriptionId: subscription.id };
    },
    retry: 1,
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      pushSubscriptionEndpoints.remove(session.api(), id),
  });
  const silentRegister = registerMutation.mutate;

  useEffect(() => {
    silentRegister(
      { prompt: false },
      {
        onSuccess: (result) => {
          if (result.status === 'registered') {
            setSubscriptionId(result.subscriptionId);
          }
        },
      },
    );
  }, [locale, silentRegister]);

  const register = async () => {
    const result = await registerMutation.mutateAsync({ prompt: true });
    if (result.status === 'registered') {
      setSubscriptionId(result.subscriptionId);
    }
    return result;
  };

  const remove = async () => {
    if (!subscriptionId) return;
    await removeMutation.mutateAsync(subscriptionId);
    setSubscriptionId(null);
  };

  return {
    subscriptionId,
    register,
    remove,
    busy: registerMutation.isPending || removeMutation.isPending,
  };
};
