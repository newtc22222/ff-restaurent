# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FF RESTaurent is a group bill-splitting and restaurant tracker for a shared team. It is a **npm workspaces monorepo** with three packages:

- `apps/api` — Fastify REST API with JWT auth, Swagger docs, and Prisma/PostgreSQL
- `apps/web` — React SPA (Vite + Tailwind CSS)
- `packages/shared` — TypeScript types, enums, and bill-splitting math shared across both apps

## Commands

```bash
# Run everything with Docker (recommended for first-time setup)
docker compose up --build

# Install all workspace dependencies
npm install

# IMPORTANT: Build shared package before running api or web
npm run build -w @ff-restaurent/shared

# Run dev servers
npm run dev -w @ff-restaurent/api     # http://localhost:4000
npm run dev -w @ff-restaurent/web     # http://localhost:5173

# Database
npm run prisma:migrate -w @ff-restaurent/api   # Run migrations
npm run prisma:seed -w @ff-restaurent/api      # Seed demo data

# Verification (mirrors CI)
npm run typecheck
npm test
npm run build

# Run only shared package tests
npm test -w @ff-restaurent/shared

# Lint and format
npm run lint
npm run format
```

API docs (Swagger UI): `http://localhost:4000/api/docs`

## Architecture

### Role System

Users have an optional `chefRole` field (`null | 'SOUS_CHEF' | 'HEAD_CHEF'`). The implicit base role is CUSTOMER. Permissions cascade:

- **CUSTOMER** (`chefRole: null`): view and mark-paid their own bill shares, view restaurant list
- **SOUS_CHEF**: everything above + create/edit bills they own, create/edit restaurant entries, send reminders
- **HEAD_CHEF**: everything above + archive/restore bills and restaurants, change member roles, view all bills regardless of participation

`isSousChefOrAbove` and `isHeadChef` helpers live in `apps/api/src/roles.ts`. The web frontend duplicates this logic with `canChef` and `isHead` in `App.tsx`.

### Bill Splitting

All money values are **integer cents** throughout the stack. The core math is in `packages/shared/src/bill-splitting.ts` and is the only code with tests (`bill-splitting.test.ts`). `calculateBillSplit` takes `BillSplitInput` and distributes VAT, shipping, and discounts proportionally across participants.

The shared package **must be built before the API or web can import from it** — it compiles TypeScript to `dist/` and the other packages import from that output. In dev the `tsx` runner handles this for the API, but the web Vite dev server needs the built output.

### API Structure

All routes are registered in a single `buildApp()` function in `apps/api/src/app.ts`. There are no separate route files. The `preHandler` chain is: `requireAuth` (populates `request.currentUser`) → optional `requireSousChef` / `requireHeadChef`.

Validation uses **Zod schemas** defined in `apps/api/src/schemas.ts`. Prisma types come from `@prisma/client` (generated from `apps/api/prisma/schema.prisma`). After changing the schema, run `prisma:migrate` to generate a migration and regenerate the client.

### Web Structure

The entire frontend lives in `apps/web/src/App.tsx` (a single large file). There is no router — navigation is driven by `tab` (active section) and `screen` (`dashboard` | `create-bill` | `bill-detail`) state variables. All API calls go through the `ApiClient` class in `apps/web/src/api.ts`. The `VITE_API_URL` env var controls the API base URL.

### Shared Package Exports

`packages/shared` exports enums (`ChefRole`, `EntryStatus`, `PaymentStatus`, `AdjustmentType`), types (`BillSplitInput`, `BillSplitResult`, etc.), and `calculateBillSplit`. The web has its own local types in `api.ts` that mirror the Prisma shape for API responses.

## Environment Variables

Copy `.env.example` to `.env` before running locally without Docker:

```
DATABASE_URL=postgresql://ff:ff@localhost:5432/ff_restaurent?schema=public
JWT_SECRET=replace-with-a-long-random-secret
API_PORT=4000
VITE_API_URL=http://localhost:4000
```
