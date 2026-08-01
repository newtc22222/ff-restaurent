# Push Notifications via Firebase Cloud Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay push-notification groundwork (subscription storage, dormant service-worker handler, client opt-in) now, then turn on real Firebase Cloud Messaging delivery for payment reminders.

**Architecture:** A new `PushSubscription` Prisma model stores one FCM token per browser/device. Phase 2.5 tasks (1-5) add registration endpoints, a dormant `push`/`notificationclick` service-worker handler, and a client opt-in flow — nothing sends a push yet. Phase 2.2.0 tasks (6-7) add `firebase-admin` on the API and wire it into the existing payment-reminder flow, reusing Cloud Run's Application Default Credentials.

**Tech Stack:** Fastify + Zod + Prisma (API), React + react-router v7 + Vite (web), `firebase` (Web SDK) + `firebase-admin` (Admin SDK), Node's built-in `node:test` (API tests) + Vitest (web tests).

## Global Constraints

- All money/business logic in this plan is unaffected — this feature only adds notification delivery, per [`.agents/specs/2026-07-26-push-notifications-fcm-design.md`](../specs/2026-07-26-push-notifications-fcm-design.md).
- Push send must never block or fail the reminder request — the in-app `Notification` row stays the source of truth (spec: "Error handling").
- `paymentRemindersEnabled` on `User` remains the single on/off switch for reminder notifications, in-app or push — no new preference field.
- Client registration and server push-send must silently no-op (not throw) when unsupported/unconfigured, matching the existing `canRegisterServiceWorker` (`apps/web/src/lib/pwa.ts:1`) and `storage()` "not configured" patterns.
- API integration tests run only with `RUN_INTEGRATION_TESTS=1` (see `apps/api/src/phase1.integration.test.ts:21-22`) and use `integrationTest(...)`, not `test(...)`.
- Follow existing code style: no comments except where a non-obvious constraint needs explaining.

---

## Phase 2.5 — Groundwork (no delivery)

### Task 1: `PushSubscription` Prisma model and migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260727000000_add_push_subscriptions/migration.sql`

**Interfaces:**

- Produces: Prisma model `PushSubscription { id, userId, fcmToken, createdAt, lastSeenAt }`, unique on `fcmToken`, cascade-deletes with `User`.

- [ ] **Step 1: Add the model to the schema**

Add this block to `apps/api/prisma/schema.prisma`, immediately after the closing `}` of `model Notification` (around line 324):

```prisma
model PushSubscription {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  fcmToken   String   @unique
  createdAt  DateTime @default(now())
  lastSeenAt DateTime @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Generate the migration**

Run: `npm run prisma:migrate -w @ff-restaurent/api -- --name add_push_subscriptions`
Expected: Prisma creates `apps/api/prisma/migrations/<timestamp>_add_push_subscriptions/migration.sql` containing a `CREATE TABLE "PushSubscription"` statement, applies it to the dev database, and regenerates the Prisma client with no errors.

- [ ] **Step 3: Verify the client picks up the new model**

Run: `npm run typecheck -w @ff-restaurent/api`
Expected: no errors (confirms `prisma.pushSubscription` is now a valid client property).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add PushSubscription model for FCM token storage"
```

---

### Task 2: API — push subscription registration and unregistration endpoints

**Files:**

- Modify: `apps/api/src/schemas.ts`
- Modify: `apps/api/src/routes/notification-routes.ts`
- Modify: `apps/api/src/phase1.integration.test.ts` (append new `integrationTest` block at end of file, after line 2080)

**Interfaces:**

- Consumes: `prisma.pushSubscription` (Task 1), `requireAuthenticatedUser` (`apps/api/src/http/auth-guards.ts:11`).
- Produces: `POST /me/push-subscriptions` → `{ id: string }`; `DELETE /me/push-subscriptions/:id` → 204. Both auth-guarded and user-scoped.

- [ ] **Step 1: Write the failing integration test**

Append to the end of `apps/api/src/phase1.integration.test.ts` (after the final `);` on line 2080):

```ts
integrationTest(
  'push subscriptions are registered, upserted by token, and owner-scoped to delete',
  async () => {
    const freshTokenFor = async (id: string) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id } });
      return tokenFor(id, '8h', user.sessionVersion);
    };
    const [customerAToken, customerBToken] = await Promise.all([
      freshTokenFor(customerAId),
      freshTokenFor(customerBId),
    ]);

    const registered = await app.inject({
      method: 'POST',
      url: '/me/push-subscriptions',
      headers: auth(customerAToken),
      payload: { fcmToken: 'fcm-token-integration-1' },
    });
    assert.equal(registered.statusCode, 200);
    const subscriptionId = registered.json().id;
    assert.ok(subscriptionId);
    assert.equal(
      await prisma.pushSubscription.count({
        where: { userId: customerAId, fcmToken: 'fcm-token-integration-1' },
      }),
      1,
    );

    const reRegistered = await app.inject({
      method: 'POST',
      url: '/me/push-subscriptions',
      headers: auth(customerAToken),
      payload: { fcmToken: 'fcm-token-integration-1' },
    });
    assert.equal(reRegistered.statusCode, 200);
    assert.equal(
      await prisma.pushSubscription.count({
        where: { fcmToken: 'fcm-token-integration-1' },
      }),
      1,
    );

    const foreignDelete = await app.inject({
      method: 'DELETE',
      url: `/me/push-subscriptions/${subscriptionId}`,
      headers: auth(customerBToken),
    });
    assert.equal(foreignDelete.statusCode, 404);
    assert.equal(
      await prisma.pushSubscription.count({
        where: { id: subscriptionId },
      }),
      1,
    );

    const ownerDelete = await app.inject({
      method: 'DELETE',
      url: `/me/push-subscriptions/${subscriptionId}`,
      headers: auth(customerAToken),
    });
    assert.equal(ownerDelete.statusCode, 204);
    assert.equal(
      await prisma.pushSubscription.count({
        where: { id: subscriptionId },
      }),
      0,
    );
  },
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `RUN_INTEGRATION_TESTS=1 npm test -w @ff-restaurent/api`
Expected: FAIL — `404` on `POST /me/push-subscriptions` (route doesn't exist yet).

- [ ] **Step 3: Add the Zod schema**

Add to `apps/api/src/schemas.ts`, immediately after `notificationPreferenceSchema` (around line 453):

```ts
export const pushSubscriptionSchema = z.object({
  fcmToken: z.string().trim().min(1).max(4096),
});
```

- [ ] **Step 4: Add the routes**

In `apps/api/src/routes/notification-routes.ts`, add `pushSubscriptionSchema` to the existing import from `../schemas.js` (line 4):

```ts
import {
  notificationPreferenceSchema,
  pushSubscriptionSchema,
} from '../schemas.js';
```

Then add these two routes inside `registerNotificationRoutes`, after the `PATCH /notifications/:id/read` route (after line 77, before the closing `};`):

```ts
app.post(
  '/me/push-subscriptions',
  { preHandler: requireAuthenticatedUser },
  async (request) => {
    const body = pushSubscriptionSchema.parse(request.body);
    return prisma.pushSubscription.upsert({
      where: { fcmToken: body.fcmToken },
      create: { userId: request.currentUser.id, fcmToken: body.fcmToken },
      update: { userId: request.currentUser.id, lastSeenAt: new Date() },
      select: { id: true },
    });
  },
);

app.delete(
  '/me/push-subscriptions/:id',
  { preHandler: requireAuthenticatedUser },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const subscription = await prisma.pushSubscription.findFirst({
      where: { id, userId: request.currentUser.id },
    });
    if (!subscription) {
      return reply.code(404).send({
        code: 'NOT_FOUND',
        message: 'Push subscription not found',
      });
    }
    await prisma.pushSubscription.delete({ where: { id: subscription.id } });
    return reply.code(204).send();
  },
);
```

The upsert-by-`fcmToken` is intentional: an FCM token identifies one browser/device instance, so if it re-registers under a different signed-in user (shared device), ownership transfers rather than erroring.

- [ ] **Step 5: Run the test to verify it passes**

Run: `RUN_INTEGRATION_TESTS=1 npm test -w @ff-restaurent/api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/schemas.ts apps/api/src/routes/notification-routes.ts apps/api/src/phase1.integration.test.ts
git commit -m "feat(api): add push subscription registration endpoints"
```

---

### Task 3: Web — dormant service-worker push handler

**Files:**

- Modify: `apps/web/public/sw.js`
- Modify: `apps/web/src/lib/service-worker-policy.test.js`

**Interfaces:**

- Produces: `parsePushPayload(event): { title: string; body: string; url: string }`, exported for testing, same pattern as the existing `cacheStrategyFor`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/lib/service-worker-policy.test.js`, after the existing `import` line (line 4) add `parsePushPayload` to it:

```js
import { cacheStrategyFor, parsePushPayload } from '../../public/sw.js';
```

Then append this new `describe` block after the closing `});` of the existing `describe('service worker cache policy', ...)` (after line 47):

```js
describe('push payload parsing', () => {
  it('extracts title, body, and target url from a JSON push payload', () => {
    const event = {
      data: {
        json: () => ({
          title: 'Payment reminder',
          body: 'You owe 50,000 VND',
          url: '/bills/abc',
        }),
      },
    };
    expect(parsePushPayload(event)).toEqual({
      title: 'Payment reminder',
      body: 'You owe 50,000 VND',
      url: '/bills/abc',
    });
  });

  it('falls back to defaults when the payload is missing or malformed', () => {
    expect(parsePushPayload({ data: null })).toEqual({
      title: 'FF RESTaurent',
      body: '',
      url: '/',
    });
    expect(
      parsePushPayload({
        data: {
          json: () => {
            throw new Error('bad json');
          },
        },
      }),
    ).toEqual({ title: 'FF RESTaurent', body: '', url: '/' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @ff-restaurent/web -- service-worker-policy`
Expected: FAIL — `parsePushPayload` is not exported from `sw.js`.

- [ ] **Step 3: Add the handler to the service worker**

Append to `apps/web/public/sw.js`, after the existing `fetch` listener (after line 74):

```js
export const parsePushPayload = (event) => {
  const fallback = { title: 'FF RESTaurent', body: '', url: '/' };
  if (!event.data) return fallback;
  try {
    const data = event.data.json();
    return {
      title: data.title ?? fallback.title,
      body: data.body ?? fallback.body,
      url: data.url ?? fallback.url,
    };
  } catch {
    return fallback;
  }
};

self.addEventListener('push', (event) => {
  const { title, body, url } = parsePushPayload(event);
  event.waitUntil(
    self.registration.showNotification(title, { body, data: { url } }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => client.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      }),
  );
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @ff-restaurent/web -- service-worker-policy`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/sw.js apps/web/src/lib/service-worker-policy.test.js
git commit -m "feat(web): add dormant push and notificationclick handlers to the service worker"
```

---

### Task 4: Web — Firebase Web SDK client module

**Files:**

- Create: `apps/web/src/lib/push.ts`
- Create: `apps/web/src/lib/push.test.ts`
- Modify: `apps/web/package.json`
- Modify: `.env.example`

**Interfaces:**

- Produces: `canRequestPushPermission(serviceWorkerSupported: boolean, notificationSupported: boolean): boolean` (pure, tested); `requestPushToken(): Promise<string | null>` (impure, not unit tested — same split as `pwa.ts`'s `canRegisterServiceWorker`/`registerServiceWorker`).
- Consumes later by: Task 5 (`ProfilePage.tsx`).

- [ ] **Step 1: Add the `firebase` dependency**

Run: `npm install firebase@^11.0.0 -w @ff-restaurent/web`
Expected: `apps/web/package.json` gains a `"firebase"` entry under `dependencies`; `package-lock.json` updates.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/lib/push.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { canRequestPushPermission } from './push';

describe('push permission policy', () => {
  it('requires both service worker and Notification API support', () => {
    expect(canRequestPushPermission(true, true)).toBe(true);
    expect(canRequestPushPermission(false, true)).toBe(false);
    expect(canRequestPushPermission(true, false)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w @ff-restaurent/web -- push.test`
Expected: FAIL — `apps/web/src/lib/push.ts` does not exist.

- [ ] **Step 4: Create the module**

Create `apps/web/src/lib/push.ts`:

```ts
export const canRequestPushPermission = (
  serviceWorkerSupported: boolean,
  notificationSupported: boolean,
) => serviceWorkerSupported && notificationSupported;

export async function requestPushToken(): Promise<string | null> {
  if (
    !canRequestPushPermission(
      'serviceWorker' in window.navigator,
      'Notification' in window,
    )
  ) {
    return null;
  }
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
  } else if (Notification.permission !== 'granted') {
    return null;
  }
  try {
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
    const messaging = getMessaging(app);
    const registration = await window.navigator.serviceWorker.ready;
    return await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    console.warn('Push token request failed', error);
    return null;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @ff-restaurent/web -- push.test`
Expected: PASS.

- [ ] **Step 6: Document the new env vars**

Add to `.env.example`, after the `VITE_API_URL` line:

```
# Firebase Cloud Messaging (Web) — from the Firebase console's Web app config
VITE_FIREBASE_API_KEY=replace-with-firebase-web-api-key
VITE_FIREBASE_PROJECT_ID=ff-restaurent
VITE_FIREBASE_MESSAGING_SENDER_ID=replace-with-messaging-sender-id
VITE_FIREBASE_APP_ID=replace-with-firebase-web-app-id
VITE_FIREBASE_VAPID_KEY=replace-with-web-push-vapid-key
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/push.ts apps/web/src/lib/push.test.ts apps/web/package.json package-lock.json .env.example
git commit -m "feat(web): add Firebase Web SDK push-token client module"
```

---

### Task 5: Web — profile opt-in toggle

**Files:**

- Modify: `apps/web/src/app/router.ts`
- Modify: `apps/web/src/pages/ProfilePage.tsx`
- Modify: `apps/web/src/pages/ProfilePage.test.tsx`
- Modify: `apps/web/src/lib/translations.ts`

**Interfaces:**

- Consumes: `requestPushToken` (Task 4), `mutate` from `useMutation()` (`apps/web/src/hooks/useMutation.ts:39`).
- Produces: router action intents `push-subscribe` (body: `{ fcmToken: string }` → `{ id: string }`) and `push-unsubscribe` (body: `{ subscriptionId: string }`).

- [ ] **Step 1: Write the failing component test**

In `apps/web/src/pages/ProfilePage.test.tsx`, add a mock for the push module after the existing `vi.mock('../hooks/useMutation', ...)` block (after line 31):

```ts
const { requestPushToken } = vi.hoisted(() => ({
  requestPushToken: vi.fn(),
}));

vi.mock('../lib/push', () => ({ requestPushToken }));
```

Then add `requestPushToken.mockReset();` to the `beforeEach` block (alongside `mutate.mockClear();` on line 36).

Add this test inside `describe('ProfilePage account forms', ...)`, after the `'updates payment reminder preferences from the profile'` test (after line 143):

```ts

  it('subscribes to push notifications when permission and a token are granted', async () => {
    requestPushToken.mockResolvedValue('fcm-token-abc');
    render(
      <I18nProvider>
        <ProfilePage />
      </I18nProvider>,
    );

    const pushToggle = screen.getByRole('checkbox', {
      name: 'Push notifications',
    });
    fireEvent.click(pushToggle);

    await vi.waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        { intent: 'push-subscribe', fcmToken: 'fcm-token-abc' },
        expect.objectContaining({
          success: 'Push notifications enabled.',
        }),
      );
    });
  });

  it('shows an error toast when push permission is denied', async () => {
    requestPushToken.mockResolvedValue(null);
    render(
      <I18nProvider>
        <ProfilePage />
      </I18nProvider>,
    );

    const pushToggle = screen.getByRole('checkbox', {
      name: 'Push notifications',
    });
    fireEvent.click(pushToggle);

    await vi.waitFor(() => {
      expect(mutate).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @ff-restaurent/web -- ProfilePage`
Expected: FAIL — no checkbox named "Push notifications" exists yet.

- [ ] **Step 3: Add the translations**

In `apps/web/src/lib/translations.ts`, add to the Vietnamese block, near `'profile.paymentReminders'` (around line 493):

```ts
    'profile.pushNotifications': 'Thông báo đẩy',
```

and to the toast block near `'toast.notificationPreferencesFailed'` (around line 422):

```ts
    'toast.pushSubscribeUpdated': 'Đã bật thông báo đẩy.',
    'toast.pushUnsubscribeUpdated': 'Đã tắt thông báo đẩy.',
    'toast.pushSubscribeFailed': 'Không thể cập nhật thông báo đẩy.',
    'toast.pushPermissionDenied':
      'Trình duyệt đã từ chối quyền gửi thông báo.',
```

Add the matching English entries near `'profile.paymentReminders'` (around line 891):

```ts
    'profile.pushNotifications': 'Push notifications',
```

and near `'toast.notificationPreferencesFailed'` (around line 988):

```ts
    'toast.pushSubscribeUpdated': 'Push notifications enabled.',
    'toast.pushUnsubscribeUpdated': 'Push notifications disabled.',
    'toast.pushSubscribeFailed': 'Could not update push notifications.',
    'toast.pushPermissionDenied': 'The browser denied notification permission.',
```

- [ ] **Step 4: Add the router action intents**

In `apps/web/src/app/router.ts`, add these two cases to the `switch` inside `mutationAction`, after the existing `case 'notification-preferences':` block (after line 590):

```ts
      case 'push-subscribe':
        return await api.request('/me/push-subscriptions', {
          method: 'POST',
          body: JSON.stringify({ fcmToken: body.fcmToken }),
        });
      case 'push-unsubscribe':
        return await api.request(
          `/me/push-subscriptions/${body.subscriptionId}`,
          { method: 'DELETE' },
        );
```

- [ ] **Step 5: Add the UI toggle**

In `apps/web/src/pages/ProfilePage.tsx`, add the import after line 9:

```tsx
import { requestPushToken } from '../lib/push';
```

Add state after the existing `mediaBusy` state (after line 38):

```tsx
const [pushSubscriptionId, setPushSubscriptionId] = useState<string | null>(
  null,
);
const [pushBusy, setPushBusy] = useState(false);
```

Add the handler near the top of the component body, after the state declarations:

```tsx
const handlePushToggle = async (enabled: boolean) => {
  setPushBusy(true);
  try {
    if (enabled) {
      const fcmToken = await requestPushToken();
      if (!fcmToken) {
        toast.error(t('toast.pushPermissionDenied'));
        return;
      }
      await mutate(
        { intent: 'push-subscribe', fcmToken },
        {
          fallback: t('toast.pushSubscribeFailed'),
          success: t('toast.pushSubscribeUpdated'),
          onSuccess: (data) =>
            setPushSubscriptionId((data as { id: string }).id),
        },
      );
    } else if (pushSubscriptionId) {
      await mutate(
        { intent: 'push-unsubscribe', subscriptionId: pushSubscriptionId },
        {
          fallback: t('toast.pushSubscribeFailed'),
          success: t('toast.pushUnsubscribeUpdated'),
          onSuccess: () => setPushSubscriptionId(null),
        },
      );
    }
  } finally {
    setPushBusy(false);
  }
};
```

Add the toggle markup inside the notification-preferences `<section>`, immediately after the closing `</label>` of the existing payment-reminders toggle (after line 268):

```tsx
<label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-4">
  <span className="text-sm font-semibold text-ink">
    {t('profile.pushNotifications')}
  </span>
  <input
    type="checkbox"
    checked={pushSubscriptionId !== null}
    disabled={pushBusy}
    onChange={(event) => void handlePushToggle(event.target.checked)}
  />
</label>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -w @ff-restaurent/web -- ProfilePage`
Expected: PASS.

- [ ] **Step 7: Run the full web test suite and typecheck**

Run: `npm test -w @ff-restaurent/web && npm run typecheck -w @ff-restaurent/web`
Expected: all pass (confirms the translation keys and router changes didn't break other pages).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/router.ts apps/web/src/pages/ProfilePage.tsx apps/web/src/pages/ProfilePage.test.tsx apps/web/src/lib/translations.ts
git commit -m "feat(web): add push notification opt-in toggle to the profile page"
```

---

## Manual setup (operator, before Phase 2.2.0 work — no code)

Phase 2.5's client code (Tasks 4-5) will run and no-op safely without this, per the "silently no-op when unconfigured" constraint. Before turning on real delivery in Phase 2.2.0:

1. Add Firebase to the `ff-restaurent` GCP project via the Firebase console.
2. Enable Cloud Messaging for the project.
3. Register a Web app in the Firebase project; copy its config into the `VITE_FIREBASE_*` env vars (Task 4, Step 6).
4. Generate a Web Push VAPID keypair in the Firebase console; set `VITE_FIREBASE_VAPID_KEY`.

---

## Phase 2.2.0 — Turn on delivery for payment reminders

### Task 6: API — FCM Admin SDK send module

**Files:**

- Modify: `apps/api/src/config.ts`
- Create: `apps/api/src/push-messaging.ts`
- Create: `apps/api/src/push-messaging.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**

- Produces: `sendReminderPush(tokens: string[], payload: { title: string; body: string; url: string }): Promise<{ sent: number; pruned: number }>` (never throws); `tokensToPrune(tokens: string[], responses: Array<{ success: boolean; error?: { code?: string } }>): string[]` (pure, tested).
- Consumes: `loadConfig().firebaseProjectId` (this task), `prisma.pushSubscription` (Task 1).

- [ ] **Step 1: Add the `firebase-admin` dependency**

Run: `npm install firebase-admin@^13.0.0 -w @ff-restaurent/api`
Expected: `apps/api/package.json` gains a `"firebase-admin"` entry under `dependencies`.

- [ ] **Step 2: Write the failing unit test**

Create `apps/api/src/push-messaging.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { tokensToPrune } from './push-messaging.js';

test('tokensToPrune keeps only unregistered tokens for removal', () => {
  const tokens = ['token-ok', 'token-stale', 'token-other-error'];
  const responses = [
    { success: true },
    {
      success: false,
      error: { code: 'messaging/registration-token-not-registered' },
    },
    { success: false, error: { code: 'messaging/internal-error' } },
  ];
  assert.deepEqual(tokensToPrune(tokens, responses), ['token-stale']);
});

test('tokensToPrune returns an empty array when nothing is stale', () => {
  assert.deepEqual(tokensToPrune(['token-ok'], [{ success: true }]), []);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w @ff-restaurent/api -- push-messaging`
Expected: FAIL — `apps/api/src/push-messaging.ts` does not exist.

- [ ] **Step 4: Add the config field**

In `apps/api/src/config.ts`, add to the `AppConfig` type (after `supabaseSignedUrlTtlSeconds: number;`, line 13):

```ts
  firebaseProjectId?: string;
```

Add to the returned object in `loadConfig` (after `supabaseSignedUrlTtlSeconds: positiveInteger(...)`, before the closing `};`):

```ts
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
```

- [ ] **Step 5: Create the send module**

Create `apps/api/src/push-messaging.ts`:

```ts
import type { Messaging, SendResponse } from 'firebase-admin/messaging';

import { loadConfig } from './config.js';
import { prisma } from './prisma.js';

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
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -w @ff-restaurent/api -- push-messaging`
Expected: PASS.

- [ ] **Step 7: Document the new env var**

Add to `.env.example`, after the `VITE_FIREBASE_VAPID_KEY` line added in Task 4:

```
# Firebase Cloud Messaging (API) — omit to leave push delivery disabled (safe no-op)
FIREBASE_PROJECT_ID=ff-restaurent
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/config.ts apps/api/src/push-messaging.ts apps/api/src/push-messaging.test.ts apps/api/package.json .env.example
git commit -m "feat(api): add FCM Admin SDK send module with stale-token pruning"
```

---

### Task 7: API — wire push send into the payment-reminder flow

**Files:**

- Modify: `apps/api/src/routes/bill-routes.ts`
- Modify: `apps/api/src/phase1.integration.test.ts`

**Interfaces:**

- Consumes: `sendReminderPush` (Task 6), `prisma.pushSubscription` (Task 1).

- [ ] **Step 1: Write the failing integration test**

In `apps/api/src/phase1.integration.test.ts`, inside the `'notification controls, private repeat groups, and duplicate override are enforced'` test, insert this block immediately after the existing reminder assertions (after line 2031, before the `const duplicatePayload = {` line):

```ts
await prisma.pushSubscription.create({
  data: { userId: customerAId, fcmToken: 'fcm-token-reminder-test' },
});
const secondReminderBill = await prisma.bill.create({
  data: {
    restaurantId,
    createdById: sousId,
    baseCost: 5000,
    vat: 0,
    shippingFee: 0,
    totalCost: 5000,
    participants: {
      create: [
        {
          memberId: customerAId,
          originCost: 5000,
          allocatedVat: 0,
          allocatedShipping: 0,
          discountApplied: 0,
          finalPrice: 5000,
        },
      ],
    },
  },
});
const remindersWithPushSubscriber = await app.inject({
  method: 'POST',
  url: `/bills/${secondReminderBill.id}/reminders`,
  headers: auth(sousToken),
});
assert.equal(remindersWithPushSubscriber.statusCode, 200);
assert.equal(remindersWithPushSubscriber.json().sent, 1);
```

This proves the reminder endpoint still succeeds when a recipient has a `PushSubscription` row and `FIREBASE_PROJECT_ID` is unset (the CI/integration-test environment) — `sendReminderPush` must no-op safely rather than error.

- [ ] **Step 2: Run the test to verify it fails**

Run: `RUN_INTEGRATION_TESTS=1 npm test -w @ff-restaurent/api`
Expected: This specific assertion actually already passes before the code change (nothing calls push yet), which is fine — re-run after Step 3 to confirm it still passes once wired in. If it fails at this step, something else broke; investigate before proceeding.

- [ ] **Step 3: Wire the send call into the reminder route**

In `apps/api/src/routes/bill-routes.ts`, add the import after the existing `import { signedQrUrl } from '../storage.js';` (line 25):

```ts
import { sendReminderPush } from '../push-messaging.js';
```

Then, inside the `/bills/:id/reminders` handler, after the `await prisma.$transaction(...)` block and before `return result;` (after line 973), add:

```ts
const subscriptions = await prisma.pushSubscription.findMany({
  where: {
    userId: { in: eligible.map((participant) => participant.memberId) },
  },
  select: { fcmToken: true },
});
if (subscriptions.length > 0) {
  await sendReminderPush(
    subscriptions.map((subscription) => subscription.fcmToken),
    {
      title: 'Payment reminder',
      body: `Payment reminder for ${bill.restaurant.name}`,
      url: `/bills/${bill.id}`,
    },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `RUN_INTEGRATION_TESTS=1 npm test -w @ff-restaurent/api`
Expected: PASS.

- [ ] **Step 5: Run the full API test suite and typecheck**

Run: `npm run typecheck -w @ff-restaurent/api && RUN_INTEGRATION_TESTS=1 npm test -w @ff-restaurent/api`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/bill-routes.ts apps/api/src/phase1.integration.test.ts
git commit -m "feat(api): send FCM push on payment reminders alongside in-app notifications"
```

---

## Self-Review Notes

- **Spec coverage:** `PushSubscription` model (Task 1), registration/unregistration endpoints (Task 2), dormant SW handler (Task 3), client token acquisition (Task 4), profile opt-in (Task 5), manual Firebase setup (documented between phases), FCM Admin send + pruning (Task 6), reminder-flow wiring (Task 7) — all design sections covered.
- **Non-blocking guarantee:** enforced structurally — `sendReminderPush` catches all errors internally (Task 6, Step 5) and the reminder route's `result` is computed and returned independently of the push call (Task 7, Step 3).
- **Type consistency:** `sendReminderPush`'s signature (`tokens: string[]`, `payload: { title, body, url }`) is identical between its definition (Task 6) and call site (Task 7). `parsePushPayload`'s return shape (`{ title, body, url }`) is identical between `sw.js` (Task 3) and the push payload sent server-side (Task 7) — the `data: { url }` field on the FCM message matches what `parsePushPayload` reads.
