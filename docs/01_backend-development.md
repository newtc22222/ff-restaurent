# Backend Development Guide

This guide explains how to develop the FF RESTaurent backend in `apps/api`. It focuses on simple component boundaries, direct data flow, descriptive naming, and the minimum structure needed to keep the API maintainable.

---

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **HTTP Framework**: Fastify
- **Authentication**: JWT bearer tokens with `@fastify/jwt`
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod schemas
- **API Docs**: Swagger UI at `http://localhost:4000/api/docs`
- **Shared Logic**: `@ff-restaurent/shared` for bill-splitting calculations and shared enums

---

## Folder Structure

The backend follows the KISS principle: keep files grouped by responsibility, avoid unnecessary layers, and keep route behavior easy to trace.

```text
apps/api/
├── prisma/
│   ├── schema.prisma              # Database models, enums, and relations
│   ├── seed.ts                    # Demo data seeding
│   ├── seed-if-empty.ts           # Docker startup seeding helper
│   └── migrations/                # Prisma migration history
│
└── src/
    ├── app.ts                     # Fastify plugin setup and route registration
    ├── server.ts                  # Runtime entry point and graceful shutdown
    ├── prisma.ts                  # Shared Prisma client instance
    ├── roles.ts                   # Role helpers and safe user response shaping
    ├── schemas.ts                 # Zod request validation schemas
    ├── types.d.ts                 # Fastify request type augmentation
    │
    ├── http/
    │   └── auth-guards.ts         # Authentication and role pre-handlers
    │
    └── routes/
        ├── auth-routes.ts         # Login and registration
        ├── profile-routes.ts      # Current user profile read/update
        ├── member-routes.ts       # Members and HEAD_CHEF role administration
        ├── restaurant-routes.ts   # Restaurant directory, favorites, archive state
        ├── bill-routes.ts         # Bills, participants, payment state, reminders
        ├── notification-routes.ts # User-scoped notification endpoints
        └── stats-routes.ts        # Current user spending summaries
```

---

## Component Responsibilities

### `src/app.ts`

`app.ts` should stay composition-only. It creates the Fastify instance, registers core plugins, exposes `/health`, and attaches route modules.

Do not put business logic here. If a new endpoint is needed, add it to the route module that owns that resource.

### `src/server.ts`

`server.ts` is the production/dev process entry point. It builds the app, starts listening, and disconnects Prisma during shutdown.

Keep runtime concerns here instead of mixing them into route modules.

### `src/http/auth-guards.ts`

Auth guards are Fastify `preHandler` functions:

- `requireAuthenticatedUser` verifies JWTs and populates `request.currentUser`.
- `requireSousChefOrHeadChef` protects manager actions.
- `requireHeadChef` protects administrative actions.

These guards should only answer the question "can this request continue?" Route-specific ownership checks, such as "can this user edit this bill?", should stay in the route module that has the needed data.

### `src/routes/*`

Each route file owns one API area. Route modules may contain small local helper functions when those helpers are only useful for that resource.

Examples:

- Bill include shapes and bill ownership checks stay in `bill-routes.ts`.
- Restaurant query filters stay in `restaurant-routes.ts`.
- Spending bucket aggregation stays in `stats-routes.ts`.

Avoid creating a service layer until logic is reused by multiple route modules or becomes difficult to test in place.

### `src/schemas.ts`

All request body validation belongs in Zod schemas here. Route handlers should parse inputs through these schemas instead of manually validating fields.

When adding or changing request fields:

1. Update the Zod schema.
2. Update the route handler.
3. Update frontend API types in `apps/web/src/api.ts` if the response contract changes.
4. Update Swagger expectations if explicit schemas are added later.

### `src/roles.ts`

Role helpers define the permission hierarchy:

- `CUSTOMER`: represented by `chefRole: null`
- `SOUS_CHEF`: manager-level permissions
- `HEAD_CHEF`: administrative permissions

Use `sanitizeUser()` for API responses so password hashes and internal fields are never returned.

### `src/prisma.ts`

Use the shared Prisma client from this file. Do not instantiate additional Prisma clients inside route modules.

---

## Request Data Flow

The backend request flow should remain direct:

```text
HTTP request
  -> Fastify route
  -> auth/role preHandler when required
  -> Zod schema parse for request body
  -> Prisma query or shared package calculation
  -> response object
```

Keep data transformations close to the route when they are route-specific. Move logic to `packages/shared` only when both API and web need the same business rule, or when it is domain logic that must be tested independently.

---

## Permissions

Permissions cascade upward:

- `CUSTOMER` can view their own bill shares, mark their own shares as paid, view restaurants, view their own notifications, and view their own stats.
- `SOUS_CHEF` can create restaurants, edit restaurants, create bills, edit bills they own, and send payment reminders.
- `HEAD_CHEF` can view all bills, include archived data, archive or restore bills/restaurants, and change member roles.

Use route pre-handlers for broad role checks. Use local route checks for ownership rules.

Example:

```ts
const canManageBill = (
  bill: { createdById: string },
  request: FastifyRequest,
) =>
  isHeadChef(request.currentUser) ||
  bill.createdById === request.currentUser.id;
```

---

## Money and Bill Splitting

All money values are stored as integer cents. Never use floats for persisted money or bill-splitting logic.

Bill splitting is calculated in:

```text
packages/shared/src/bill-splitting.ts
```

The API should call `calculateBillSplit()` and persist the returned integer-cent values. If bill math changes, update shared package tests first or alongside the change:

```powershell
npm test --workspace @ff-restaurent/shared
```

After changing the shared package, rebuild it before API or web verification:

```powershell
npm run build --workspace @ff-restaurent/shared
```

---

## Database Changes

Database models and enums live in:

```text
apps/api/prisma/schema.prisma
```

For schema changes:

1. Update `schema.prisma`.
2. Create and apply a Prisma migration.
3. Regenerate the Prisma client.
4. Update route include/select shapes.
5. Update frontend API response types if any response changes.
6. Update seed data when demo coverage should include the new field or relation.

Common commands:

```powershell
npm run prisma:migrate --workspace @ff-restaurent/api
npm run prisma:generate --workspace @ff-restaurent/api
npm run prisma:seed --workspace @ff-restaurent/api
```

---

## Local Development

Run the full stack with Docker:

```powershell
docker compose up --build
```

Run only the API:

```powershell
npm run dev --workspace @ff-restaurent/api
```

Expected local endpoints:

- API health: `http://localhost:4000/health`
- Swagger UI: `http://localhost:4000/api/docs`

Required environment variables when running outside Docker:

```env
DATABASE_URL=postgresql://ff:ff@localhost:5432/ff_restaurent?schema=public
JWT_SECRET=replace-with-a-long-random-secret
API_PORT=4000
```

---

## Verification

Run backend-focused checks after API changes:

```powershell
npm run typecheck --workspace @ff-restaurent/api
npm run lint --workspace @ff-restaurent/api
npm run build --workspace @ff-restaurent/api
```

Run shared tests when bill math or shared types change:

```powershell
npm test --workspace @ff-restaurent/shared
```

Run broader workspace checks before large changes are submitted:

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

---

## Backend Change Checklist

Use this checklist to keep backend changes small and consistent:

- Add request validation in `src/schemas.ts`.
- Put the endpoint in the route module that owns the resource.
- Use `requireAuthenticatedUser` before reading `request.currentUser`.
- Use `requireSousChefOrHeadChef` or `requireHeadChef` for role-gated actions.
- Keep ownership checks local to the route that loads the record.
- Store money as integer cents.
- Use Prisma for database reads and writes.
- Return sanitized users with `sanitizeUser()`.
- Update Prisma migrations for schema changes.
- Update frontend API types when response contracts change.
- Run the narrowest useful verification command, then broaden when shared behavior changes.
