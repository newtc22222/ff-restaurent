import type { Messaging, SendResponse } from 'firebase-admin/messaging';
import { loadConfig } from './config/config.js';
import { prisma } from './lib/prisma.js';

export const tokensToPrune = (
  tokens: string[],
  responses: Array<Pick<SendResponse, 'success'> & {
    error?: { code?: string };
  }>,
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
  payload: { title: string; body: string; url: string },
): Promise<{ sent: number; pruned: number }> => {
  if (tokens.length === 0) return { sent: 0, pruned: 0 };
  try {
    const client = await getMessagingClient();
    if (!client) return { sent: 0, pruned: 0 };
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
    return { sent: response.successCount, pruned: staleTokens.length };
  } catch (error) {
    console.warn('Push send failed', error);
    return { sent: 0, pruned: 0 };
  }
};
