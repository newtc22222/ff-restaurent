import { useMutation } from '@tanstack/react-query';

import { diningAreaEndpoints } from '@/api/endpoints';
import { session } from '@/lib/session';

type DiningAreaMediaMutation =
  | { action: 'upload'; diningAreaId: string; file: File }
  | { action: 'default'; diningAreaId: string; imageId: string }
  | { action: 'remove'; diningAreaId: string; imageId: string };

export const useDiningAreaMediaMutation = () =>
  useMutation({
    mutationFn: (input: DiningAreaMediaMutation) => {
      if (input.action === 'upload') {
        return diningAreaEndpoints.uploadImage(
          session.api(),
          input.diningAreaId,
          input.file,
        );
      }
      if (input.action === 'default') {
        return diningAreaEndpoints.setDefaultImage(
          session.api(),
          input.diningAreaId,
          input.imageId,
        );
      }
      return diningAreaEndpoints.removeImage(
        session.api(),
        input.diningAreaId,
        input.imageId,
      );
    },
  });
