# Backend Development Guide

This guide explains how to work on the FF RESTaurent API in `apps/api`. It
reflects the current Fastify/Prisma backend shipped with v1.1.0.

## Technology Stack

- Node.js with TypeScript and native ESM
- Fastify 5
- `@fastify/jwt` for bearer-token authentication
- `@fastify/cors`, `@fastify/rate-limit`, `@fastify/multipart`
- Prisma 6 with PostgreSQL
- Zod request validation
- Swagger UI at `/api/docs`
- Supabase storage for restaurant media and payment QR images
- `@ff-restaurent/shared` for shared enums, phone parsing, and bill-splitting
  math

## Source Layout

```text
apps/api/
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/
|   |-- seed.ts
|   |-- seed-if-empty.ts
|   |-- seed-popular-cuisines.ts
|   |-- backfill-user-phones.ts
|   |-- bootstrap-root-admin.ts
|   |-- recover-root-admin.ts
|   |-- verify-final-query-indexes.ts
|   `-- verify-phase2-contract.ts
`-- src/
    |-- app.ts
    |-- server.ts
    |-- config.ts
    |-- prisma.ts
    |-- roles.ts
    |-- schemas.ts
    |-- types.d.ts
    |-- collection-service.ts
    |-- restaurant-contract.ts
    |-- root-admin-service.ts
    |-- storage.ts
    |-- phone-backfill.ts
    |-- popular-cuisine-seed.ts
    |-- pagination.ts
    |-- search-normalization.ts
    |-- catalog-normalization.ts
    |-- address-directory.ts
    |-- http/
    |   |-- auth-guards.ts
    |   `-- error-handler.ts
    |-- routes/
    |   |-- auth-routes.ts
    |   |-- profile-routes.ts
    |   |-- member-routes.ts
    |   |-- restaurant-routes.ts
    |   |-- catalog-routes.ts
    |   |-- collection-routes.ts
    |   |-- feedback-routes.ts
    |   |-- media-routes.ts
    |   |-- bill-routes.ts
    |   |-- notification-routes.ts
    |   |-- participant-group-routes.ts
    |   |-- stats-routes.ts
    |   `-- address-routes.ts
    `-- data/
        `-- vietnam-wards-full.json
```

Tests are colocated with source files as `*.test.ts`.

## Request Flow

The backend request flow should remain direct:

```text
HTTP request
  -> Fastify route
  -> auth or role preHandler when required
  -> Zod schema parse for request data
  -> Prisma query or shared package calculation
  -> serializer or response object
  -> global error mapper when needed
```

`src/app.ts` is composition-only. It registers core plugins, Swagger, health
routes, the global error handler, and route modules. Do not move domain logic
back into `app.ts`.

`src/server.ts` owns process startup and graceful shutdown. Keep runtime
concerns there.

## Route Modules

Route files under `src/routes` own one API area each. Keep request parsing,
resource ownership checks, Prisma query shape, and response shaping close to the
route when that logic is route-specific.

Use shared services only when logic is reused or has an independent domain
contract:

- `collection-service.ts` owns collection/favorite/recommended behavior.
- `restaurant-contract.ts` derives backward-compatible restaurant response
  aliases from normalized persistence.
- `root-admin-service.ts` owns root transfer behavior.
- `storage.ts` owns Supabase-backed media access.
- `phone-backfill.ts` and `popular-cuisine-seed.ts` support idempotent startup
  operations.

## Validation and Errors

All request validation belongs in `src/schemas.ts` unless the schema has already
been moved into a more focused module. Route handlers should parse with Zod
instead of manually validating request bodies.

When changing request or response fields:

1. Update the Zod schema.
2. Update the route handler and Prisma select/include shape.
3. Update serializers such as `restaurant-contract.ts` when relevant.
4. Update web API types in `apps/web/src/lib/api.ts`.
5. Add or update focused tests.

The global error mapper in `src/http/error-handler.ts` should remain the place
where common API errors become consistent HTTP responses.

## Roles and Authorization

Effective permissions ascend as:

```text
CUSTOMER < SOUS_CHEF < HEAD_CHEF < ROOT_ADMIN
```

- CUSTOMER is represented by `chefRole: null`.
- SOUS_CHEF can create restaurants and bills and manage owned work.
- HEAD_CHEF adds global bill visibility and archive/restore capabilities.
- ROOT_ADMIN is the singleton `systemRole`, inherits Head Chef capabilities, and
  exclusively manages member roles, root transfer, password-recovery
  administration, and other system controls.

`chefRole` and `systemRole` are independent. HEAD_CHEF must never change member
roles or ROOT_ADMIN ownership.

Use auth pre-handlers from `src/http/auth-guards.ts` for broad route access.
Use route-local checks for ownership rules that require loading the target
record, such as bill creator checks or participant payment checks.

Always sanitize users through the role/public-user helpers before returning user
objects. Never serialize password hashes, reset-code hashes, or session-version
internals.

## Money and Bill Splitting

All persisted and API monetary values are integer cents. Never use float math
for bill totals, participant shares, discounts, VAT, shipping, or vouchers.

Core calculation logic lives in:

```text
packages/shared/src/bill-splitting.ts
```

The API should call `calculateBillSplit()` and persist the returned integer-cent
values. Do not duplicate allocation logic inside route handlers. If bill math
changes, update shared tests at the same time:

```powershell
npm test --workspace @ff-restaurent/shared
```

## Database and Phase 2 Contracts

Database models, enums, constraints, and relations live in:

```text
apps/api/prisma/schema.prisma
```

For schema changes:

1. Update `schema.prisma`.
2. Create a Prisma migration.
3. Regenerate the Prisma client.
4. Update route query shapes and serializers.
5. Update web API types.
6. Update seed/backfill scripts when production or demo data needs coverage.
7. Add focused API tests or migration verification as needed.

Use deploy mode for production:

```powershell
npm run prisma:migrate:deploy --workspace @ff-restaurent/api
```

Do not run `prisma migrate dev` against production.

The v1.1.0 Phase 2 contract is complete:

- Collections are the sole persistence authority for Favorites and Recommended
  restaurants.
- `Cuisine` and `RestaurantCuisine` are the cuisine authority.
- `RestaurantPlatformLink` rows are the platform-link authority.
- Legacy restaurant response aliases are derived by `restaurant-contract.ts`.
- The deprecated `links` write input is still accepted and translated to
  normalized platform links.

Verify the normalized restaurant contract against a live database with:

```powershell
npm run prisma:phase2:contract:verify --workspace @ff-restaurent/api
```

## Phone, Password, and Root Operations

Vietnamese phone parsing is shared, but the API is authoritative. Optional phone
numbers persist as canonical E.164 values. Startup runs the idempotent phone
backfill after migrations.

JWTs carry `sessionVersion`. Password changes, assisted password resets, and
root transfers invalidate affected older sessions.

Production root bootstrap uses `ROOT_ADMIN_USERNAME` only when no root exists.
Emergency root recovery is interactive and operator-only:

```powershell
npm run prisma:root:recover --workspace @ff-restaurent/api
```

Do not expose root recovery through HTTP or web UI.

## Local Development

Run the full stack with Docker:

```powershell
docker compose up --build
```

Expected local endpoints:

```text
API:      http://localhost:4000
Health:   http://localhost:4000/health
Ready:    http://localhost:4000/ready
Swagger:  http://localhost:4000/api/docs
Web:      http://localhost:5173
```

Run only the API:

```powershell
npm run dev --workspace @ff-restaurent/api
```

API typecheck, build, and Prisma commands load `apps/api/prisma.config.ts` and
therefore require `DATABASE_URL`, even when they do not query the database.
State clearly when database-backed verification was skipped.

## Verification

For API-only changes:

```powershell
npm run typecheck --workspace @ff-restaurent/api
npm run lint --workspace @ff-restaurent/api
npm test --workspace @ff-restaurent/api
npm run build --workspace @ff-restaurent/api
```

For Prisma or contract changes:

```powershell
npm run prisma:generate --workspace @ff-restaurent/api
npm run prisma:indexes:verify --workspace @ff-restaurent/api
npm run prisma:phase2:contract:verify --workspace @ff-restaurent/api
```

For shared bill math or shared types:

```powershell
npm test --workspace @ff-restaurent/shared
npm run build --workspace @ff-restaurent/shared
```

For broad changes before review:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## Backend Change Checklist

- Put endpoints in the route module that owns the resource.
- Use `requireAuthenticatedUser` before reading `request.currentUser`.
- Use role pre-handlers for broad access gates and route-local checks for
  ownership.
- Parse request data with Zod schemas.
- Use Prisma for persistence.
- Keep money as integer cents and delegate split math to `packages/shared`.
- Return sanitized users only.
- Preserve ROOT_ADMIN-only governance.
- Preserve Phase 2 normalized restaurant persistence contracts.
- Update web API types when API response contracts change.
- Add focused tests before broad verification.
