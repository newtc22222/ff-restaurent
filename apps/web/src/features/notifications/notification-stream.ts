import { API_URL } from '@/api/client';

type NotificationInvalidationEvent = {
  notificationId: string;
  cursor: string;
};

type NotificationStreamOptions = {
  token: string;
  signal: AbortSignal;
  onConnected: () => void | Promise<void>;
  onNotification: (
    event: NotificationInvalidationEvent,
  ) => void | Promise<void>;
};

type StreamResponse = {
  ok: boolean;
  status: number;
  body: ReadableStream<Uint8Array> | null;
};

type NotificationStreamDependencies = {
  fetcher: (input: string, init: RequestInit) => Promise<StreamResponse>;
  wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
};

const HEALTHY_CONNECTION_MS = 30_000;
const reconnectDelay = (attempt: number) =>
  Math.min(1_000 * 2 ** attempt, 30_000);

const abortableWait = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });

const defaultDependencies: NotificationStreamDependencies = {
  fetcher: fetch,
  wait: abortableWait,
  now: Date.now,
};

const readEventStream = async (
  body: ReadableStream<Uint8Array>,
  initialCursor: string | null,
  options: NotificationStreamOptions,
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let cursor = initialCursor;

  while (!options.signal.aborted) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder
      .decode(chunk.value, { stream: true })
      .replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = 'message';
      let id: string | null = null;
      const data: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trimStart();
        if (line.startsWith('id:')) id = line.slice(3).trimStart();
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (id) cursor = id;
      if (event === 'notification' && data.length > 0) {
        try {
          const value = JSON.parse(
            data.join('\n'),
          ) as Partial<NotificationInvalidationEvent>;
          if (
            typeof value.notificationId === 'string' &&
            typeof value.cursor === 'string'
          ) {
            await options.onNotification({
              notificationId: value.notificationId,
              cursor: value.cursor,
            });
          }
        } catch {
          // Ignore malformed invalidation frames and keep the last snapshot.
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }

  return cursor;
};

export const connectNotificationStream = async (
  options: NotificationStreamOptions,
  dependencies: NotificationStreamDependencies = defaultDependencies,
) => {
  let cursor: string | null = null;
  let attempt = 0;
  const now = dependencies.now ?? Date.now;

  while (!options.signal.aborted) {
    let connectedAt: number | null = null;
    try {
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${options.token}`,
      };
      if (cursor) headers['Last-Event-ID'] = cursor;
      const response = await dependencies.fetcher(
        `${API_URL}/notifications/stream`,
        { headers, signal: options.signal },
      );
      if (response.status === 401 || response.status === 403) return;
      if (!response.ok) throw new Error('Notification stream unavailable');
      if (!response.body) return;

      connectedAt = now();
      await options.onConnected();
      cursor = await readEventStream(response.body, cursor, options);
      if (options.signal.aborted) return;
    } catch (error) {
      if (
        options.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        return;
      }
    }

    if (connectedAt !== null && now() - connectedAt >= HEALTHY_CONNECTION_MS) {
      attempt = 0;
    }

    const delay = reconnectDelay(attempt);
    attempt += 1;
    await dependencies.wait(delay, options.signal);
  }
};
