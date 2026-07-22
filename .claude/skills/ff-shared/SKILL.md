---
name: ff-shared
description: >-
  Use whenever a task touches `packages/shared` (the `@ff-restaurent/shared`
  package) in the FF RESTaurent monorepo — cross-cutting TypeScript types and
  enums, the bill-splitting math (`calculateBillSplit`, integer-cents money
  logic), Vietnamese phone normalization, or the build/import contract that ties
  `apps/api` and `apps/web` together. Fire this for any question about shared
  types, shared utils, enums reused across front and back end, or "where does
  this type/constant live" — even when the user doesn't name the folder.
---

# ff-shared — the `@ff-restaurent/shared` package

## Purpose & scope

`packages/shared` is the **single home for code that both apps need**: TypeScript
types/enums, pure domain math, and phone normalization. It is imported by
`apps/api` (Fastify backend) and `apps/web` (React frontend) under the name
`@ff-restaurent/shared`. Keep it **pure and isomorphic** — no Fastify, no React,
no Node-only or browser-only APIs — so both runtimes can consume it unchanged.

## Structure

Flat `src/`, one concern per file, with colocated `*.test.ts` (vitest):

- `types.ts` — enums (`ChefRole`, `SystemRole`, `EntryStatus`, `PaymentStatus`,
  `AdjustmentType`, `AdjustmentAllocation`), `ROLE_LABELS` (vi/en), and the
  bill-split DTO types (`BillSplitInput`, `BillSplitResult`, `DiscountInput`,
  `VoucherInput`, …).
- `bill-splitting.ts` — `calculateBillSplit` and the money math that distributes
  VAT, shipping, discounts, and vouchers across participants (`EQUAL` /
  `PROPORTIONAL` allocation). Tested in `bill-splitting.test.ts`.
- `phone.ts` — Vietnam mobile-phone parsing/normalization (e.g.
  `parseVietnamMobilePhone`). Tested in `phone.test.ts`.
- `index.ts` — barrel that re-exports the three modules; this is the package's
  only public entry point.

## Core patterns — where to add code

- **A new enum or type used by both apps** → add it to `types.ts`.
- **New pure domain calculation** → its own file (mirror `bill-splitting.ts`),
  with a colocated `*.test.ts`.
- **Anything new that should be importable** → re-export it from `index.ts`.
  Consumers only ever import from `@ff-restaurent/shared` (the barrel), never
  from a deep path.
- Keep dependencies at zero — if you reach for a framework or runtime API, the
  code probably belongs in `apps/api` or `apps/web`, not here.

## Dependencies & build contract (important, non-obvious)

The package's `package.json` `exports`/`main`/`types` point at **`dist/`**, which
`tsc` produces (`npm run build -w @ff-restaurent/shared`). **But both apps alias
the import to the package _source_, not `dist/`:**

- `apps/api/tsconfig.json` and `apps/web/tsconfig.json` map
  `@ff-restaurent/shared` → `../../packages/shared/src/index.ts`.
- `apps/web/vite.config.ts` adds the same alias for the bundler.

Consequences:

- **Dev servers and `typecheck` do NOT need a prior shared build** — they resolve
  source directly. So editing a file here is picked up immediately by `tsx watch`
  (api) and Vite (web).
- **`dist/` is consumed by production paths only:** the root `npm run build` and
  the API's esbuild bundle (which marks `@ff-restaurent/shared` as `external` and
  resolves it from `node_modules` → `dist/` at runtime). Build shared before those.

## Gotchas

1. **ESM `.js` extensions on `.ts` imports.** Internal imports use the ESM
   convention — `export * from './types.js'` even though the file is `types.ts`.
   Match this exactly or module resolution breaks in the built output.
2. **Money is integer cents everywhere.** Every amount in the split types and math
   is an integer number of cents — never floats/decimals. Preserve this invariant.
3. **This is a contract-duplication hotspot.** The same enums/DTO shapes are also
   redeclared in `apps/api/prisma/schema.prisma`, `apps/api/src/schemas.ts` (Zod),
   and `apps/web/src/lib/api.ts` (response types). `packages/shared` is only a
   *partial* source of truth today, so a change here usually needs matching edits
   in those places — see [[ff-api]] (`schemas.ts`, Prisma) and [[ff-web]]
   (`lib/api.ts`). Check them before assuming a type change is self-contained.
