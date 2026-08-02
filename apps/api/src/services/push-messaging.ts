import type { Messaging, SendResponse } from 'firebase-admin/messaging';

import { loadConfig } from '../config/config.js';
import { prisma } from '../lib/prisma.js';

type PushPayload = { title: string; body: string; url: string };
type PushResult = { sent: number; pruned: number };
export type PushDeliveryResult = PushResult & {
  attempted: boolean;
  successfulTokens: string[];
};
type PushLogger = { warn: (...args: unknown[]) => void };

type ReminderPushDependencies = {
  findTokens: (userIds: string[]) => Promise<string[]>;
  send: (
    tokens: string[],
    payload: PushPayload,
    logger?: PushLogger,
  ) => Promise<PushResult>;
};

export const tokensToPrune = (
  tokens: string[],
  responses: Array<
    Pick<SendResponse, 'success'> & {
      error?: { code?: string };
    }
  >,
): string[] =>
  tokens.filter((_, index) => {
    const result = responses[index];
    return (
      !result?.success &&
      result?.error?.code === 'messaging/registration-token-not-registered'
    );
  });

let messaging: Messaging | null = null;

const getMessagingClient = async (): Promise<Messaging | null> => {
  const config = loadConfig();
  if (!config.firebaseProjectId) return null;
  if (!messaging) {
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    const app =
      getApps()[0] ?? initializeApp({ projectId: config.firebaseProjectId });
    messaging = getMessaging(app);
  }
  return messaging;
};

export const sendReminderPush = async (
  tokens: string[],
  payload: PushPayload,
  logger?: PushLogger,
): Promise<PushDeliveryResult> => {
  if (tokens.length === 0) {
    return { sent: 0, pruned: 0, attempted: false, successfulTokens: [] };
  }
  let attempted = false;
  try {
    const client = await getMessagingClient();
    if (!client) {
      return { sent: 0, pruned: 0, attempted: false, successfulTokens: [] };
    }
    attempted = true;
    const response = await client.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url },
    });
    const staleTokens = tokensToPrune(tokens, response.responses);
    if (staleTokens.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { fcmToken: { in: staleTokens } },
      });
    }
    return {
      sent: response.successCount,
      pruned: staleTokens.length,
      attempted: true,
      successfulTokens: tokens.filter(
        (_, index) => response.responses[index]?.success,
      ),
    };
  } catch (error) {
    logger?.warn({ err: error, event: 'push_send_failed' }, 'Push send failed');
    return { sent: 0, pruned: 0, attempted, successfulTokens: [] };
  }
};

const reminderPushDependencies: ReminderPushDependencies = {
  findTokens: async (userIds) =>
    (
      await prisma.pushSubscription.findMany({
        where: { userId: { in: userIds } },
        select: { fcmToken: true },
      })
    ).map(({ fcmToken }) => fcmToken),
  send: sendReminderPush,
};

export const sendReminderPushForUsers = async (
  userIds: string[],
  payload: PushPayload,
  logger: PushLogger,
  dependencies: ReminderPushDependencies = reminderPushDependencies,
): Promise<PushResult> => {
  try {
    const tokens = await dependencies.findTokens(userIds);
    const result = await dependencies.send(tokens, payload, logger);
    return { sent: result.sent, pruned: result.pruned };
  } catch (error) {
    logger.warn(
      { err: error, event: 'push_fanout_failed' },
      'Push fan-out failed',
    );
    return { sent: 0, pruned: 0 };
  }
};
