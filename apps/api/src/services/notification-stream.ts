import { prisma } from '../lib/prisma.js';

type NotificationCursor = {
  createdAt: Date;
  id: string;
};

type NotificationStreamHandlers = {
  ready: (cursor: string | null) => void;
  notification: (event: { notificationId: string; cursor: string }) => void;
  heartbeat: () => void;
};

type NotificationStreamDependencies = {
  latest: (userId: string) => Promise<NotificationCursor | null>;
  after: (
    userId: string,
    cursor: NotificationCursor | null,
  ) => Promise<NotificationCursor[]>;
  delay: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  now: () => number;
};

type NotificationStreamOptions = {
  userId: string;
  lastEventId?: string;
  signal: AbortSignal;
  handlers: NotificationStreamHandlers;
};

const POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const BATCH_SIZE = 100;

export const serializeNotificationCursor = (cursor: NotificationCursor) =>
  `${cursor.createdAt.toISOString()}|${cursor.id}`;

export const parseNotificationCursor = (
  value: string | undefined,
): NotificationCursor | null => {
  if (!value) return null;
  const separator = value.indexOf('|');
  if (separator < 1 || separator === value.length - 1) return null;
  const createdAt = new Date(value.slice(0, separator));
  const id = value.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
};

const abortableDelay = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });

const notificationStreamDependencies: NotificationStreamDependencies = {
  latest: (userId) =>
    prisma.notification.findFirst({
      where: { userId, inAppVisible: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true },
    }),
  after: (userId, cursor) =>
    prisma.notification.findMany({
      where: {
        userId,
        inAppVisible: true,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true, createdAt: true },
    }),
  delay: abortableDelay,
  now: Date.now,
};

let activeNotificationStreams = 0;

export const getActiveNotificationStreamCount = () => activeNotificationStreams;

export const streamNotificationEvents = async (
  options: NotificationStreamOptions,
  dependencies: NotificationStreamDependencies = notificationStreamDependencies,
): Promise<void> => {
  if (options.signal.aborted) return;
  activeNotificationStreams += 1;
  try {
    const recoveredCursor = parseNotificationCursor(options.lastEventId);
    let currentCursor =
      recoveredCursor ?? (await dependencies.latest(options.userId));
    let lastHeartbeatAt = dependencies.now();
    options.handlers.ready(
      currentCursor ? serializeNotificationCursor(currentCursor) : null,
    );

    while (!options.signal.aborted) {
      const notifications = await dependencies.after(
        options.userId,
        currentCursor,
      );
      for (const notification of notifications) {
        if (options.signal.aborted) break;
        currentCursor = notification;
        options.handlers.notification({
          notificationId: notification.id,
          cursor: serializeNotificationCursor(notification),
        });
      }
      if (options.signal.aborted) break;

      const now = dependencies.now();
      if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
        options.handlers.heartbeat();
        lastHeartbeatAt = now;
      }
      if (notifications.length < BATCH_SIZE) {
        await dependencies.delay(POLL_INTERVAL_MS, options.signal);
      }
    }
  } finally {
    activeNotificationStreams -= 1;
  }
};
