# Push Notifications via Firebase Cloud Messaging — Design

Status: Approved
Date: 2026-07-26
Author: Claude (with Phi Vo)
Implementation plan: `.agents/plans/2026-07-26-push-notifications-fcm.md`

## Context

FF RESTaurent's notification feature today is entirely in-app: a `Notification`
table (`apps/api/prisma/schema.prisma`, `model Notification`), populated by the
payment-reminder flow in `apps/api/src/routes/bill-routes.ts`, and read by the
client via polling `GET /notifications` (`apps/api/src/routes/notification-routes.ts`).
The web app's service worker (`apps/web/public/sw.js`) exists only for asset
caching — it has no `push` event listener, and there is no subscription
storage, VAPID keypair, or FCM integration anywhere in the codebase.

Linear's Phase 2.5 milestone ("GCP Migration & Architecture Foundations",
FF-54 → FF-71) has migrated production onto GCP (Cloud Run, Cloud SQL) and is
mid-flight on a GCS storage migration (FF-71). There is no existing ticket for
push notifications in that milestone or anywhere else in the backlog — this is
new scope.

The GCP project `ff-restaurent` (account `phi.vo.tech@gmail.com`) already has
Cloud Run, Cloud SQL, IAM, Secret Manager, etc. enabled, but Firebase has not
been added to it — `firebase.googleapis.com` / `fcm.googleapis.com` are absent
from `gcloud services list --enabled`.

## Goal

Split the work across two releases:

- **Phase 2.5 (before/alongside 2.1.0):** lay the groundwork for push —
  subscription storage, registration endpoints, and a dormant service-worker
  push handler. No server ever sends a push yet.
- **2.2.0:** turn delivery on for the single highest-value trigger — payment
  reminders — using Firebase Cloud Messaging (FCM), reusing the GCP project
  and Cloud Run's existing Application Default Credentials.

Out of scope: a general notification-type/event taxonomy, push for events
other than payment reminders, native mobile apps (this is a PWA only).

## Architecture

### Data model

New Prisma model in `apps/api/prisma/schema.prisma`:

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

One row per browser/device that has granted notification permission and
registered an FCM token. `paymentRemindersEnabled` (already on `User`)
remains the single on/off switch for whether a user receives reminder
notifications at all, in-app or push.

### Phase 2.5 — groundwork, no delivery

**API** (`apps/api/src/routes/notification-routes.ts`), both behind
`requireAuthenticatedUser`:

- `POST /me/push-subscriptions` — body `{ fcmToken: string }` (validated via a
  new Zod schema in `schemas.ts`). Upserts by `fcmToken`, associating it with
  `request.currentUser.id` and bumping `lastSeenAt`.
- `DELETE /me/push-subscriptions/:id` — scoped to the current user (same
  ownership pattern as `PATCH /notifications/:id/read`), for explicit
  unsubscribe (e.g. user disables browser notifications in-app).

**Web:**

- Extend `apps/web/public/sw.js` with a `push` event listener that shows a
  `Notification` from the push payload, and a `notificationclick` listener
  that focuses/opens the relevant bill. This is fully testable in isolation
  even though nothing sends a push yet in this phase.
- On notification-permission grant (new opt-in UI, e.g. in notification
  preferences), request an FCM token via the Firebase Web SDK and register it
  through `POST /me/push-subscriptions`. Follows the existing
  `canRegisterServiceWorker` pattern in `apps/web/src/lib/pwa.ts`: no-op
  silently if unsupported or permission denied.
- New public env vars: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`,
  `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
  `VITE_FIREBASE_VAPID_KEY`. These are Firebase's public web-app config
  values, safe to ship in the client bundle.

### 2.2.0 — turn on delivery for payment reminders

- Add `firebase-admin` to `apps/api`.
- In the reminder flow (`apps/api/src/routes/bill-routes.ts`, the
  `tx.notification.createMany` block), after creating the in-app
  `Notification` rows, look up `PushSubscription` rows for the same eligible,
  opted-in participants and send via `messaging().sendEachForMulticast()`.
- Push send is **best-effort and non-blocking**: the in-app `Notification` row
  remains the source of truth. A push failure must never fail or roll back
  the reminder request.
- Tokens FCM reports as unregistered (`messaging/registration-token-not-registered`
  or equivalent) are pruned from `PushSubscription`.
- Auth: Cloud Run's existing Application Default Credentials (provisioned in
  FF-56) cover FCM Admin SDK auth — no separate service-account key to
  generate or store.

## Manual setup (operator, not code)

Before Phase 2.5's client registration code can succeed (it will silently
no-op until this is done):

1. Add Firebase to the `ff-restaurent` GCP project via the Firebase console.
2. Enable Cloud Messaging.
3. Register a Web app in the Firebase project; copy its config values into
   the `VITE_FIREBASE_*` env vars.
4. Generate a Web Push VAPID keypair in the Firebase console; set
   `VITE_FIREBASE_VAPID_KEY`.

## Error handling

- Token registration (client) is best-effort — mirrors
  `canRegisterServiceWorker`'s silent-no-op-on-unsupported pattern.
- Push send (server, 2.2.0) never blocks or fails the reminder request; only
  the in-app `Notification` write is transactional.
- Invalid/expired tokens are pruned reactively from FCM send responses, not
  via a separate cleanup job.

## Testing

- Unit tests for the eligibility filter reused for push fan-out (mirrors the
  existing reminder-cooldown/dedup tests in `bill-routes.ts`'s test suite).
- Unit test for token-pruning logic on a simulated FCM "not registered"
  response.
- Integration test proving a push-send failure does not block or roll back
  reminder creation (in-app `Notification` rows still get created).
- `sw.js`'s `push`/`notificationclick` handlers get the same kind of pure-function
  extraction/test treatment as `cacheStrategyFor` already has, so they're
  testable without a real service worker runtime.

## Rollout

1. **Phase 2.5:** `PushSubscription` migration, registration endpoints, `sw.js`
   push/notificationclick handlers, client registration flow, Firebase Web SDK
   wiring. Ship dark — no server ever calls FCM.
2. **Manual:** Firebase added to the GCP project, VAPID key generated (can
   happen any time before 2.2.0 work starts).
3. **2.2.0:** `firebase-admin` added to the API, reminder flow fans out to FCM,
   token pruning on send failures.
