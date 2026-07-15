---
name: ff-restaurent-app
description: Work on the FF RESTaurent monorepo, a React/Vite web app plus Fastify/Prisma API for restaurant bill splitting. Use when Codex is asked to implement, debug, test, or explain features in this app, especially bills, restaurants, notifications, stats, auth, roles, Prisma schema, API endpoints, shared bill-splitting math, or workspace commands.
---

# FF RESTaurent App

## Workflow

1. Locate the repository root before acting. Expected root: `ff-restaurent` with `apps/web`, `apps/api`, and `packages/shared`.
2. Read the relevant current files before editing. Prefer app-local patterns over new abstractions.
3. For domain behavior, read `references/app-reference.md` when the task touches API routes, permissions, schema, bill splitting, commands, or data contracts.
4. Keep money as integer cents end to end. Do not introduce float math for persisted or API values.
5. Preserve role semantics:
   - CUSTOMER: own participant bills, own stats, own notifications, own payment status.
   - SOUS_CHEF: create restaurants and manage owned bills.
   - HEAD_CHEF: global bill visibility and archive/restore admin actions.
   - ROOT_ADMIN: singleton highest role, member role governance, and system administration.
6. Validate at the narrowest useful scope, then broaden when shared behavior changes.

## Common Commands

Use these from the repo root unless a package-local command is more appropriate:

```powershell
npm run typecheck --workspaces --if-present
npm run lint --workspaces --if-present
npm run build
npm test
```

For web-only changes:

```powershell
npm run typecheck --workspace @ff-restaurent/web
npm run lint --workspace @ff-restaurent/web
npm run build --workspace @ff-restaurent/web
```

For API or shared bill math changes:

```powershell
npm run typecheck --workspace @ff-restaurent/api
npm run typecheck --workspace @ff-restaurent/shared
npm test --workspace @ff-restaurent/shared
```

## Local Runtime

Use Docker when the API/database must be exercised:

```powershell
docker compose up --build
```

Expected URLs:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- API docs: `http://localhost:4000/api/docs`

Demo logins all use `password123`: `customer@ff.test`, `sous@ff.test`, `head@ff.test`.

## Editing Guidance

- Keep shared calculations in `packages/shared/src/bill-splitting.ts` and update its tests for math changes.
- Keep Fastify request validation in `apps/api/src/schemas.ts`; do not duplicate validation ad hoc inside handlers.
- Keep web API types in `apps/web/src/api.ts` aligned with API responses and Prisma-shaped includes.
- When adding API fields, update Prisma schema, route include/select shape, web type definitions, and UI rendering together.
- For frontend design work, also use `$ff-restaurent-ux`.
