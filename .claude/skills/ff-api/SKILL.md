---
name: ff-api
description: >-
  Use whenever a task touches the FF RESTaurent **backend** (`apps/api`) — the
  Fastify REST service: routes/endpoints, Zod request validation, Prisma schema
  and migrations, JWT auth guards and the chef/root-admin role system, Supabase
  storage (images / payment QR), pagination, or anything server-side. Fire this
  even when the user only names an endpoint, a database model, a migration, or
  "the API" / "the server" without saying `apps/api`. Prefer it for
  backend/database/auth questions over the frontend skill.
---

# ff-api — the Fastify + Prisma backend (`apps/api`)

## Purpose & scope

`apps/api` is the REST backend: Fastify with JWT auth, Swagger docs, a
Prisma/PostgreSQL data layer, and Supabase-backed file storage. It serves
`apps/web` and imports shared types/math from `@ff-restaurent/shared`
(see [[ff-shared]]). Swagger UI runs at `http://localhost:4000/api/docs`.

## Structure

- `src/server.ts` — process entry point.
- `src/app.ts` — **composition only.** Registers core plugins (CORS, JWT, rate
  limit in production, Swagger) then calls one `register*Routes` function per
  domain module. Add nothing business-logical here.
- `src/routes/` — one `*-routes.ts` per domain: `auth`, `address`, `catalog`,
  `collection`, `feedback`, `media`, `member`, `notification`,
  `participant-group`, `password-reset`, `profile`, `restaurant`, `bill`,
  `stats`. `media-routes.ts` handles Supabase image/QR upload/list/delete.
- `src/http/` — `auth-guards.ts` (`requireAuth`, `requireSousChef`,
  `requireHeadChef`) and `error-handler.ts` (global error mapping).
- `src/*.ts` (top level) — services & helpers: `schemas.ts` (Zod), `config.ts`
  (`loadConfig()`), `prisma.ts` (client singleton), `roles.ts` (`isRootAdmin`,
  `isSousChefOrAbove`, `isHeadChef`), `restaurant-contract.ts`,
  `collection-service.ts`, `root-admin-service.ts`, `address-directory.ts`,
  `pagination.ts`, `storage.ts`, `catalog-normalization.ts`,
  `search-normalization.ts`, plus colocated `*.test.ts`.
- `src/data/` — bundled datasets (e.g. the validated Vietnam province/ward
  directory backing `address-directory.ts`).
- `prisma/` — `schema.prisma`, `migrations/`, seeds (`seed.ts`,
  `seed-popular-cuisines.ts`, …), and operational scripts
  (`bootstrap-root-admin.ts`, `recover-root-admin.ts`, `backfill-user-phones.ts`,
  `verify-phase2-contract.ts`, `verify-final-query-indexes.ts`).

## Core patterns — where to add code

- **New endpoint** → add/extend the matching `src/routes/<domain>-routes.ts`, and
  register the module in `src/app.ts` if it's new. Keep `app.ts` composition-only.
- **Request validation** → define/extend a **Zod** schema in `src/schemas.ts`;
  parse at the route boundary. Don't hand-roll validation in handlers.
- **Auth** → the `preHandler` chain is `requireAuth` (populates
  `request.currentUser`) → optional `requireSousChef` / `requireHeadChef`. Use the
  `roles.ts` helpers for permission checks rather than comparing role strings.
- **Config** → read only through `loadConfig()` in `config.ts`; never touch
  `process.env` directly in handlers.
- **DB schema change** → edit `prisma/schema.prisma`, then run
  `npm run prisma:migrate -w @ff-restaurent/api` to generate a migration and
  regenerate the client.

## Dependencies & build

- Imports `@ff-restaurent/shared` (aliased to source via tsconfig — no shared
  build needed for dev/typecheck; see [[ff-shared]]).
- Dev: `npm run dev -w @ff-restaurent/api` → `tsx watch src/server.ts`
  (`http://localhost:4000`). Build: esbuild bundle to `dist/server.js`.
- ESM module style — internal imports use **`.js` extensions on `.ts` files**
  (`import { restaurantSchema } from './schemas.js'`). Match this.

## Role system (two independent fields on `User`)

- `chefRole`: `null | 'SOUS_CHEF' | 'HEAD_CHEF'`; implicit base is CUSTOMER.
  Permissions cascade (CUSTOMER → SOUS_CHEF → HEAD_CHEF).
- `systemRole`: `null | 'ROOT_ADMIN'` — exactly one holder (unique constraint);
  passes every chef check and handles audited root-admin transfer and
  password-reset approval.
- Login accepts username **or** phone; `sessionVersion` on `User` invalidates old
  JWTs. Registration requires `REGISTRATION_INVITE_CODE`.

## Gotchas

1. **Prisma client is generated code.** After any `schema.prisma` edit you must
   re-run `prisma:migrate` (or `prisma generate`). Applied migrations are
   **immutable** — never edit a migration that has run; checksum drift breaks
   `prisma migrate deploy` in CI/prod. Write a new migration instead.
2. **Phase 2 is complete (shipped v1.1.0).** The legacy `UserFavorite` table and
   `RestaurantEntry.cuisineType` / `links` / `isFavorite` / `isRecommended`
   columns are **dropped**; Collections + normalized `Cuisine`/
   `RestaurantPlatformLink` relations are the sole persistence authority.
   **However**, the API boundary still *serves* the legacy response aliases
   (`cuisineType`, `isFavorite`, `isRecommended`, `isFavoritedByMe`, derived in
   `restaurant-contract.ts`) and still *accepts* the deprecated `links` write
   input (translated to `platformLinks`) for client compatibility. Don't remove
   that compat surface, and don't try to write the dropped columns.
3. **Global error handling.** `src/http/error-handler.ts` maps `ZodError` → 400
   and Prisma `P2002`/`P2003`/`P2025` to appropriate statuses; anything else logs
   `Unhandled request failure` and returns 500. Throw typed errors and let it map.
4. **Money is integer cents** throughout (matches [[ff-shared]]).
5. **Supabase service-role key is API-only** — it lives in this package's config
   and must never be exposed to the web/Vite side.
6. Denormalized `searchText` columns back list search; keep them updated on write.
