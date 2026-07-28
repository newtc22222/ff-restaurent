import type { ApiClient } from '@/api/client';

export type MutationBody = {
  intent: string;
  payload?: unknown;
  toastSuccess?: unknown;
  billId?: string;
  memberId?: string;
  status?: string;
  expectedStatus?: string;
  restaurantId?: string;
  collectionId?: string;
  collectionIds?: string[];
  feedbackId?: string;
  groupId?: string;
  userId?: string;
  chefRole?: string | null;
  accountStatus?: string;
  requestId?: string;
  notificationId?: string;
  billsReturnTo?: string;
};

export type IntentContext = {
  api: ApiClient;
  body: MutationBody;
  params: Record<string, string | undefined>;
};

export type IntentHandler = (
  context: IntentContext,
) => unknown | Promise<unknown>;
export type IntentMap = Record<string, IntentHandler>;
