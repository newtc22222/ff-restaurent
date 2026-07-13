# FF RESTaurent 1.0.0

Release date: 2026-07-11

## Overview

Version 1.0.0 completes the Phase 1 launch scope for FF RESTaurent. The release
hardens authentication and authorization, protects settlement integrity,
completes the shared bill and payment journey, exposes in-app reminders, and
adds the automated release gates needed for a controlled deployment.

## Highlights

### Secure group access

- Registration requires a private group invite code.
- JWT sessions have explicit expiry and production secret validation.
- Production CORS uses an explicit origin allowlist.
- Login and registration are rate-limited.
- Demo credentials and automatic demo seeding are disabled in production.
- The final Head Chef and role-administration boundaries are protected.

### Trustworthy bills and settlement

- Bill and payment responses never serialize password hashes.
- Bill edits preserve payment state for unchanged participants.
- Financial or participant changes are blocked after payment begins.
- Participant changes and payment corrections are audited.
- Payment updates support both `PAID` and `WAITING` with optimistic conflict
  protection.
- Bill previews use the authoritative shared calculation and reconcile every
  participant share before submission.
- Multiple fixed or percentage discounts and coded vouchers are supported.

### Complete payment and notification journey

- Bill managers can provide a validated HTTPS payment link.
- Customers can open the payment target directly from bill detail.
- Users can correct payment mistakes through a confirmed, audited action.
- The notification bell shows unread reminders and navigates to the bill.
- Reminder delivery excludes settled participants and applies a 15-minute
  per-recipient cooldown.
- Transient data failures no longer sign users out or discard loaded data.

### Release readiness

- CI uses deterministic installation and requires lint, typecheck, tests,
  production builds, PostgreSQL integration coverage, and Playwright smoke
  journeys.
- Customer, Sous Chef, and Head Chef launch journeys are covered in Chromium,
  with an additional 390px mobile overflow check.
- `/ready` verifies database connectivity separately from `/health`.
- Staging smoke and scheduled backup/restore-drill workflows are included.
- Structured launch events cover login, bill creation, payment changes, and
  request failures.
- The production deployment and rollback procedure is documented in
  `docs/03_PRODUCTION_RUNBOOK.md`.

## API changes

- Registration payloads now require `inviteCode`.
- Payment updates use:

  ```text
  PATCH /bills/:id/participants/:memberId/payment
  ```

  with `status` and `expectedStatus` in the JSON body.

- Expected client failures return stable error codes and 4xx responses.
- `GET /ready` returns `503` when PostgreSQL is unavailable.
- Bill responses include an optional `paymentUrl`.

## Database migration

Migration `20260711000000_add_payment_url` adds the nullable `Bill.paymentUrl`
column. Apply it before starting the 1.0.0 API:

```bash
npm run prisma:migrate:deploy -w @ff-restaurent/api
```

Production migrations are a separate release step. Application startup does
not seed demo accounts in production.

## Required production configuration

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/ff_restaurent?schema=public
JWT_SECRET=use-a-random-secret-with-at-least-32-characters
JWT_EXPIRES_IN=8h
CORS_ORIGINS=https://app.example.com
REGISTRATION_INVITE_CODE=use-a-private-group-invite
API_PORT=4000
VITE_API_URL=https://api.example.com
```

## Verification record

- Lint: passed across all workspaces.
- Typecheck: passed across all workspaces.
- API contract and PostgreSQL integration tests: 7 passed.
- Shared bill-calculation tests: 4 passed.
- Chromium journeys: Customer, Sous Chef, Head Chef, and mobile layout passed.
- Production builds: API, web, and shared packages passed.
- Authenticated staging smoke: passed against the disposable release database.
- Prisma schema validation and all three migrations: passed.

## Deployment checklist

1. Configure protected staging and production environments and secrets.
2. Back up PostgreSQL and record the current image digests.
3. Apply `prisma migrate deploy` as a one-time release job.
4. Deploy the API and verify `/health` and `/ready`.
5. Deploy the web build with the production `VITE_API_URL`.
6. Run the staging smoke workflow with a least-privileged account.
7. Run and record the backup/restore drill before production promotion.
8. Monitor authentication, bill creation, payment, readiness, and 5xx events.

## Known follow-up

The production backup/restore workflow requires protected
`PRODUCTION_DATABASE_URL` and staging secrets after these changes are merged.
The first successful drill must be recorded before the release is promoted.

The web bundle still emits Vite's advisory chunk-size warning; route-level code
splitting remains a post-MVP optimization and does not block this release.
