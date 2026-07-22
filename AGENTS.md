# AGENTS.md

This document provides guidance for AI coding agents working in this repository.

## Current Project State

Phase 2 is complete and FF RESTaurent `v1.1.0` is published. Read
`.codex/PHASE_2_HANDOFF.md` and `releases/Release_1-1-0.md` before release,
production, migration, or roadmap work. They record the shipped schema
contracts, production verification and recovery evidence, and the branch
boundary for later development.

The active milestone is **Phase 2.5 - GCP Migration & Architecture
Foundations**. Before starting new work, refresh Git and Linear, select the next
unblocked Phase 2.5 issue, and branch from the latest `origin/develop`. Do not
reopen Phase 2 or restore its removed legacy restaurant/favorites storage unless
a production regression is demonstrated. Phase 3 begins only after the Phase
2.5 foundation milestone is complete.

## Project Overview

FF RESTaurent is a group bill-splitting and restaurant tracker for a shared team.

This repository is an **npm workspaces monorepo** containing three packages:

- `apps/api` — Fastify REST API with JWT authentication, Swagger documentation, and Prisma/PostgreSQL
- `apps/web` — React single-page application built with Vite and Tailwind CSS
- `packages/shared` — Shared TypeScript types, enums, and bill-splitting logic used by both applications

---

## Development Commands

### Initial Setup

```bash
# Run the full stack with Docker (recommended for first-time setup)
docker compose up --build

# Install workspace dependencies
npm install
```

### Shared Package

The shared package must be built before the API or web application can consume it.

```bash
npm run build -w @ff-restaurent/shared
```

### Development Servers

```bash
# API
npm run dev -w @ff-restaurent/api
# http://localhost:4000

# Web
npm run dev -w @ff-restaurent/web
# http://localhost:5173
```

### Database

```bash
# Apply Prisma migrations
npm run prisma:migrate -w @ff-restaurent/api

# Seed demo data
npm run prisma:seed -w @ff-restaurent/api
```

### Verification

Run these before submitting significant changes.

```bash
npm run typecheck
npm test
npm run build
```

Shared package tests:

```bash
npm test -w @ff-restaurent/shared
```

### Formatting

```bash
npm run lint
npm run format
```

### API Documentation

Swagger UI is available at:

```
http://localhost:4000/api/docs
```

---

# Architecture

## Role System

Users have an optional backward-compatible `chefRole` field:

```ts
null | 'SOUS_CHEF' | 'HEAD_CHEF';
```

A `null` value represents the default **CUSTOMER** role.

One user also has `systemRole: 'ROOT_ADMIN'`. `ROOT_ADMIN` is the singleton
highest-level system role and is independent from `chefRole`.

Permissions cascade upward:

### CUSTOMER (`chefRole: null`)

- View restaurant list
- View their own bill shares
- Mark their own shares as paid

### SOUS_CHEF

Includes CUSTOMER permissions, plus:

- Create bills
- Edit bills they own
- Create restaurants
- Edit restaurant entries
- Send payment reminders

### HEAD_CHEF

Includes SOUS_CHEF permissions, plus:

- Archive and restore bills
- Archive and restore restaurants
- View all bills regardless of participation

### ROOT_ADMIN

Includes HEAD_CHEF permissions, plus:

- Change member chef roles
- Transfer ROOT_ADMIN ownership
- Manage password-recovery requests and future system controls

HEAD_CHEF users cannot change any member role. Only ROOT_ADMIN can access member
administration.

Backend permission helpers are located in:

```
apps/api/src/roles.ts
```

Frontend equivalents are currently duplicated in:

```
apps/web/src/App.tsx
```

using:

- `canChef`
- `isHead`
- `isRootAdmin`

---

## Bill Splitting

All monetary values are stored as **integer cents** throughout the application.

Core calculation logic lives in:

```
packages/shared/src/bill-splitting.ts
```

This is the primary area covered by unit tests:

```
packages/shared/src/bill-splitting.test.ts
```

`calculateBillSplit()` accepts a `BillSplitInput` and distributes:

- VAT
- Shipping
- Discounts

proportionally across participants.

### Important

The shared package compiles to `dist/`.

Both the API and web application import from the compiled output.

Always rebuild the shared package after modifying it:

```bash
npm run build -w @ff-restaurent/shared
```

The API development server (`tsx`) can often consume fresh builds automatically, but the Vite frontend expects the compiled output.

---

## API Structure

All routes are registered inside:

```
apps/api/src/app.ts
```

There are no separate route modules.

Authentication middleware order:

```
requireAuth
    ↓
request.currentUser populated
    ↓
requireSousChef (optional)
    ↓
requireHeadChef (optional)
```

Validation is performed with Zod schemas defined in:

```
apps/api/src/schemas.ts
```

Database models are generated from:

```
apps/api/prisma/schema.prisma
```

Whenever the Prisma schema changes:

1. Create and apply a migration.
2. Regenerate the Prisma client.

```bash
npm run prisma:migrate -w @ff-restaurent/api
```

---

## Web Structure

The frontend is intentionally simple.

Most application logic resides in:

```
apps/web/src/App.tsx
```

There is currently:

- no router
- one primary application component

Navigation is controlled by state:

```ts
tab;
```

and

```ts
screen;
```

where `screen` is one of:

- `dashboard`
- `create-bill`
- `bill-detail`

All HTTP requests are made through:

```
apps/web/src/api.ts
```

using the `ApiClient` class.

The backend URL is configured via:

```
VITE_API_URL
```

---

## Shared Package Exports

The shared package exports:

### Enums

- `ChefRole`
- `EntryStatus`
- `PaymentStatus`
- `AdjustmentType`

### Types

- `BillSplitInput`
- `BillSplitResult`
- related shared types

### Functions

- `calculateBillSplit`

The frontend also defines local API response types inside:

```
apps/web/src/api.ts
```

These mirror the Prisma-backed API responses.

---

# Environment Variables

Copy `.env.example` to `.env` when running locally without Docker.

```env
DATABASE_URL=postgresql://ff:ff@localhost:5432/ff_restaurent?schema=public
JWT_SECRET=replace-with-a-long-random-secret
API_PORT=4000
VITE_API_URL=http://localhost:4000
```

---

# Agent Guidelines

When working in this repository:

- Prefer minimal, targeted changes over broad refactors.
- Preserve the existing architecture unless explicitly instructed otherwise.
- Keep all money values as integer cents.
- Reuse logic from `packages/shared` rather than duplicating business rules.
- Keep backend validation in Zod schemas.
- Use Prisma for database access.
- Ensure permission checks match the established role hierarchy.
- Run relevant tests after modifying shared business logic.
- Rebuild `packages/shared` after any changes before testing the API or frontend.
- Avoid introducing new architectural patterns (such as routing libraries or additional state management) unless specifically requested.
