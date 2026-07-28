import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileMediaEndpoints } from '@/api/endpoints';
import { session } from '@/lib/session';

export const profileMediaQueryKeys = {
  paymentQrImages: (ownerId: string, billId?: string) =>
    ['profile', 'payment-qr-images', ownerId, billId ?? 'me'] as const,
};

export const usePaymentQrImages = (
  enabled: boolean,
  ownerId: string,
  billId?: string,
) =>
  useQuery({
    queryKey: profileMediaQueryKeys.paymentQrImages(ownerId, billId),
    queryFn: () => profileMediaEndpoints.paymentQrImages(session.api(), billId),
    enabled,
    retry: false,
  });

export const useProfileMediaMutations = () => {
  const queryClient = useQueryClient();
  const refreshPaymentQrImages = () =>
    queryClient.invalidateQueries({
      queryKey: ['profile', 'payment-qr-images'],
    });

  return {
    uploadAvatar: useMutation({
      mutationFn: (file: File) =>
        profileMediaEndpoints.uploadAvatar(session.api(), file),
    }),
    removeAvatar: useMutation({
      mutationFn: () => profileMediaEndpoints.removeAvatar(session.api()),
    }),
    savePaymentQr: useMutation({
      mutationFn: ({
        id,
        label,
        file,
      }: {
        id?: string;
        label: string;
        file?: File | null;
      }) => {
        const api = session.api();
        if (!id && file)
          return profileMediaEndpoints.createPaymentQr(api, label, file);
        if (id && file)
          return profileMediaEndpoints.replacePaymentQr(api, id, label, file);
        if (id) return profileMediaEndpoints.renamePaymentQr(api, id, label);
        return Promise.reject(new Error('A payment QR image is required'));
      },
      onSuccess: refreshPaymentQrImages,
    }),
    removePaymentQr: useMutation({
      mutationFn: (id: string) =>
        profileMediaEndpoints.removePaymentQr(session.api(), id),
      onSuccess: refreshPaymentQrImages,
    }),
  };
};
