import { useMutation } from '@tanstack/react-query';

import { restaurantMediaEndpoints } from '@/api/endpoints';
import { session } from '@/lib/session';

type RestaurantMediaMutation =
  | {
      action: 'upload';
      restaurantId: string;
      kind: 'logo' | 'banner';
      file: File;
    }
  | {
      action: 'remove';
      restaurantId: string;
      kind: 'logo' | 'banner';
    };

export const useRestaurantMediaMutation = () =>
  useMutation({
    mutationFn: (input: RestaurantMediaMutation) =>
      input.action === 'upload'
        ? restaurantMediaEndpoints.upload(
            session.api(),
            input.restaurantId,
            input.kind,
            input.file,
          )
        : restaurantMediaEndpoints.remove(
            session.api(),
            input.restaurantId,
            input.kind,
          ),
  });
