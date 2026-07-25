# FF RESTaurent — Folder Structure Review & Recommendations

---

## 1. Current Structure at a Glance

### `apps/api/src/` — 29 files in root, 3 subdirectories

```
apps/api/src/
├── app.ts                            # Composition root (clean ✅)
├── server.ts                         # Entry point (clean ✅)
├── config.ts                         # Env config loader
├── prisma.ts                         # Singleton client
├── types.d.ts                        # Fastify augments
│
├── schemas.ts                        # ⚠️ ALL Zod schemas (566 lines)
├── roles.ts                          # Auth role helpers
├── storage.ts                        # Supabase storage service
├── collection-service.ts             # Collection domain logic
├── restaurant-contract.ts            # Compatibility serializer
├── pagination.ts                     # Cursor pagination util
├── search-normalization.ts           # Text normalization
├── catalog-normalization.ts          # Catalog util
├── address-directory.ts              # Vietnam address directory
├── phone-backfill.ts                 # Phone normalization logic
├── popular-cuisine-seed.ts           # Cuisine seed logic
├── root-admin-service.ts             # Root admin transfer logic
│
├── *.test.ts                         # ⚠️ 9 test files mixed at root
│
├── http/
│   ├── auth-guards.ts                # JWT verification guards
│   └── error-handler.ts              # Global error mapper
│
├── routes/                           # 14 route modules + 4 route tests
│   ├── auth-routes.ts
│   ├── bill-routes.ts                # ⚠️ 944 lines
│   ├── restaurant-routes.ts          # ⚠️ 513 lines
│   ├── collection-routes.ts          # 402 lines
│   ├── feedback-routes.ts            # 257 lines
│   ├── media-routes.ts               # 322 lines
│   ├── password-reset-routes.ts      # 298 lines
│   ├── catalog-routes.ts             # 226 lines
│   ├── member-routes.ts              # 115 lines
│   ├── notification-routes.ts
│   ├── participant-group-routes.ts
│   ├── profile-routes.ts
│   ├── stats-routes.ts
│   └── address-routes.ts
│
└── data/
    └── vietnam-wards-full.json       # 278 KB static dataset
```

### `apps/web/src/` — 6 subdirectories, 2 root files

```
apps/web/src/
├── main.tsx
├── index.css
│
├── app/
│   ├── App.tsx                       # Shell, error boundary
│   ├── router.ts                     # ⚠️ ALL loaders + actions (746 lines)
│   ├── router.test.ts                # 561 lines
│   └── providers/
│       ├── app-context.tsx
│       ├── i18n.tsx
│       └── theme.tsx
│
├── components/
│   ├── ui/                           # 20 files (components + tests)
│   ├── layout/                       # AppHeader, Sidebar (3 files)
│   └── address/                      # VietnamAddressFields (2 files)
│
├── features/
│   └── restaurants/                  # ⚠️ Only domain with a feature folder
│       ├── RestaurantsPage.tsx        # 565 lines
│       ├── RestaurantDetailPage.tsx   # 405 lines
│       ├── RestaurantCatalogFields.tsx
│       ├── RestaurantFeedback.tsx
│       ├── RestaurantProfileFields.tsx
│       ├── RestaurantBanner.tsx
│       ├── PlatformLinksEditor.tsx
│       └── *.test.tsx
│
├── hooks/
│   └── useMutation.ts               # ⚠️ Single file in directory
│
├── lib/
│   ├── api.ts                        # ⚠️ ALL API types + client (376 lines)
│   ├── helpers.ts                    # Role helpers
│   ├── session.ts                    # Token storage
│   ├── translations.ts              # ⚠️ 1,039 lines (all i18n strings)
│   ├── result-messages.ts           # Localized result mapping
│   ├── pwa.ts                       # PWA utilities
│   └── *.test.*
│
├── pages/                            # ⚠️ 9 page files, most 400-750 lines
│   ├── CreateBillPage.tsx            # 759 lines
│   ├── BillsPage.tsx                 # 722 lines
│   ├── BillDetailPage.tsx            # 520 lines
│   ├── AdminPage.tsx                 # 493 lines
│   ├── CollectionDetailPage.tsx      # 459 lines
│   ├── CollectionsPage.tsx
│   ├── LoginPage.tsx
│   ├── ParticipantGroupsPage.tsx
│   ├── ProfilePage.tsx
│   ├── StatsPage.tsx
│   └── *.test.tsx
```

---

## 2. What's Working Well

| Aspect | Observation |
| :--- | :--- |
| **Monorepo workspace layout** | Clean `apps/api`, `apps/web`, `packages/shared` split — dependency boundaries are clear. |
| **API composition root** | `app.ts` is composition-only. Plugin and route registration is easy to scan. |
| **Route-per-domain** | The API `routes/` directory has one file per domain (auth, bills, restaurants, etc.) — good horizontal separation. |
| **HTTP layer isolation** | `http/auth-guards.ts` and `http/error-handler.ts` separate cross-cutting HTTP concerns from business logic. |
| **Feature folder started** | `features/restaurants/` on the web side shows the right pattern — domain components colocated together. |
| **Providers pattern** | `app/providers/` cleanly separates React context providers from the shell. |
| **Component organization** | `components/ui/` vs `components/layout/` vs `components/address/` — layered component taxonomy. |
| **Test colocation** | Tests sit next to their source files — easy to find and maintain. |

---

## 3. Issues & Improvement Opportunities

### 3.1 API: Flat `src/` with Mixed Concerns

**Problem**: The API `src/` root contains 29 files spanning service logic, domain
helpers, data seeding, test files, and configuration — all at the same level.
There's no grouping by responsibility.

**Impact**: As the app grows, it becomes harder to answer "where does X live?"
Service files like `collection-service.ts`, `restaurant-contract.ts`,
`root-admin-service.ts`, and `phone-backfill.ts` are domain services but sit
alongside infrastructure (`config.ts`, `prisma.ts`, `storage.ts`).

**Recommendation**: Group files by layer:

```
src/
├── server.ts                    # Entry point
├── app.ts                       # Composition root
│
├── config/                      # App configuration
│   ├── config.ts
│   └── types.d.ts
│
├── http/                        # HTTP layer (unchanged)
│   ├── auth-guards.ts
│   └── error-handler.ts
│
├── routes/                      # Route handlers (unchanged)
│   └── ...
│
├── schemas/                     # Zod schemas, split by domain
│   ├── auth.ts
│   ├── bill.ts
│   ├── restaurant.ts
│   ├── collection.ts
│   ├── common.ts                # Shared (pagination, phone, address)
│   └── index.ts                 # Re-exports
│
├── services/                    # Domain/business logic
│   ├── collection-service.ts
│   ├── restaurant-contract.ts
│   ├── root-admin-service.ts
│   ├── phone-backfill.ts
│   ├── popular-cuisine-seed.ts
│   ├── address-directory.ts
│   └── storage.ts
│
├── lib/                         # Pure utilities
│   ├── pagination.ts
│   ├── search-normalization.ts
│   ├── catalog-normalization.ts
│   └── prisma.ts
│
└── data/                        # Static datasets (unchanged)
    └── vietnam-wards-full.json
```

### 3.2 API: Monolithic `schemas.ts` (566 lines)

**Problem**: Every Zod validation schema for every domain lives in a single file.

**Impact**: High merge-conflict risk when multiple features touch validation.
Difficult to find the schema for a specific route.

**Recommendation**: Split into domain-scoped schema files under `schemas/`. Each
route file imports only the schemas it needs:

```diff
- import { billCreateSchema, restaurantCreateSchema } from '../schemas.js';
+ import { billCreateSchema } from '../schemas/bill.js';
+ import { restaurantCreateSchema } from '../schemas/restaurant.js';
```

### 3.3 API: Oversized Route Files

| File | Lines | Concern |
| :--- | :---: | :--- |
| `bill-routes.ts` | **944** | CRUD + participants + payment + QR + audit + archive |
| `restaurant-routes.ts` | **513** | CRUD + address + platform links + cuisine |
| `collection-routes.ts` | **402** | CRUD + shares + restaurants + system collections |

**Recommendation**: For the largest files, consider extracting sub-route modules
that the main registration function composes:

```
routes/
├── bill-routes.ts                  # Register function delegates to:
├── bills/
│   ├── bill-crud.ts
│   ├── bill-participants.ts
│   └── bill-payment.ts
```

This keeps the existing `app.ts` composition intact (`registerBillRoutes(app)`)
while splitting the implementation.

### 3.4 Web: `router.ts` is a God File (746 lines)

**Problem**: `router.ts` contains every loader, every action, and all route
definitions for the entire application in one file.

**Impact**: This is the single hardest file to work in. Every new page or API
call requires touching this file. It will accumulate merge conflicts and is
difficult to reason about.

**Recommendation**: Colocate loaders and actions with their pages or feature
folders:

```
pages/
├── BillsPage/
│   ├── BillsPage.tsx
│   ├── BillsPage.loader.ts
│   └── BillsPage.test.tsx
├── CreateBillPage/
│   ├── CreateBillPage.tsx
│   ├── CreateBillPage.action.ts
│   └── CreateBillPage.test.tsx
```

Then `router.ts` becomes a thin route-definition file (~100 lines) that wires
paths to lazily-imported components and their loaders:

```ts
// router.ts (thin)
const routes: RouteObject[] = [
  {
    path: '/bills',
    lazy: () => import('../pages/BillsPage/BillsPage.loader'),
    Component: lazy(() => import('../pages/BillsPage/BillsPage')),
  },
  // ...
];
```

### 3.5 Web: Feature Folders Are Incomplete

**Problem**: Only `restaurants` has a `features/` folder. Bills, collections,
admin, and stats are bare page files in `pages/` with all UI, state, and logic
inlined.

**Impact**: The `pages/` directory mixes page-level routing concerns with
feature-specific components. Pages like `CreateBillPage.tsx` (759 lines) and
`BillsPage.tsx` (722 lines) are doing too much.

**Recommendation**: Adopt the feature-folder pattern consistently:

```
features/
├── bills/
│   ├── BillCard.tsx
│   ├── BillFilters.tsx
│   ├── BillParticipantList.tsx
│   ├── PaymentStatusBadge.tsx
│   └── CreateBillForm.tsx
├── collections/
│   ├── CollectionCard.tsx
│   ├── CollectionShareList.tsx
│   └── AddToCollectionModal.tsx
├── admin/
│   ├── RoleManagement.tsx
│   ├── MemberTable.tsx
│   └── PasswordResetPanel.tsx
├── restaurants/                    # Already exists ✅
│   └── ...
└── stats/
    ├── StatsDashboard.tsx
    └── PaymentChart.tsx
```

Pages become thin orchestrators:

```tsx
// pages/BillsPage.tsx (~100 lines)
export default function BillsPage() {
  const data = useLoaderData();
  return (
    <>
      <BillFilters ... />
      <BillList bills={data.bills} />
    </>
  );
}
```

### 3.6 Web: `lib/api.ts` Mixes Types and Client Logic

**Problem**: `api.ts` (376 lines) contains all API response types, the API
client class, and error handling in one file.

**Recommendation**: Split into:

```
lib/
├── api/
│   ├── client.ts           # ApiClient class + ApiError
│   ├── types.ts             # All API response/request types
│   └── index.ts             # Re-exports
```

### 3.7 Web: `translations.ts` Is a 1,039-Line Monolith

**Problem**: All i18n strings for every feature live in a single file.

**Recommendation**: Split by feature namespace:

```
lib/
├── translations/
│   ├── common.ts
│   ├── bills.ts
│   ├── restaurants.ts
│   ├── admin.ts
│   ├── auth.ts
│   └── index.ts            # Merges all namespaces
```

### 3.8 Web: Lone `hooks/useMutation.ts`

**Problem**: A single-file directory is a code smell. It suggests the hook
either belongs somewhere else or there are other hooks that should be colocated.

**Recommendation**: Either move `useMutation.ts` into `lib/` (since it's a
generic utility), or commit to the `hooks/` directory and move page-specific
hooks out of pages into it (e.g., `useFilteredBills`, `useBillForm`).

---

## 4. Proposed Target Structure

### `apps/api/src/`

```
src/
├── server.ts
├── app.ts
│
├── config/
│   ├── config.ts
│   └── types.d.ts
│
├── http/
│   ├── auth-guards.ts
│   └── error-handler.ts
│
├── routes/
│   ├── auth-routes.ts
│   ├── bill-routes.ts
│   ├── catalog-routes.ts
│   ├── collection-routes.ts
│   ├── feedback-routes.ts
│   ├── media-routes.ts
│   ├── member-routes.ts
│   ├── notification-routes.ts
│   ├── participant-group-routes.ts
│   ├── password-reset-routes.ts
│   ├── profile-routes.ts
│   ├── restaurant-routes.ts
│   ├── stats-routes.ts
│   └── address-routes.ts
│
├── schemas/
│   ├── auth.ts
│   ├── bill.ts
│   ├── restaurant.ts
│   ├── collection.ts
│   ├── member.ts
│   ├── feedback.ts
│   ├── media.ts
│   ├── common.ts
│   └── index.ts
│
├── services/
│   ├── collection-service.ts
│   ├── restaurant-contract.ts
│   ├── root-admin-service.ts
│   ├── phone-backfill.ts
│   ├── popular-cuisine-seed.ts
│   ├── address-directory.ts
│   └── storage.ts
│
├── lib/
│   ├── prisma.ts
│   ├── roles.ts
│   ├── pagination.ts
│   ├── search-normalization.ts
│   └── catalog-normalization.ts
│
└── data/
    └── vietnam-wards-full.json
```

### `apps/web/src/`

```
src/
├── main.tsx
├── index.css
│
├── app/
│   ├── App.tsx
│   ├── router.ts                    # Thin route definitions only
│   └── providers/
│       ├── app-context.tsx
│       ├── i18n.tsx
│       └── theme.tsx
│
├── components/
│   ├── ui/                          # Generic, reusable UI primitives
│   ├── layout/                      # Shell layout (AppHeader, Sidebar)
│   └── address/                     # Vietnam address fields
│
├── features/
│   ├── bills/                       # NEW
│   │   ├── BillCard.tsx
│   │   ├── BillFilters.tsx
│   │   ├── BillParticipants.tsx
│   │   ├── PaymentActions.tsx
│   │   └── CreateBillForm.tsx
│   ├── collections/                 # NEW
│   │   ├── CollectionCard.tsx
│   │   └── CollectionShareList.tsx
│   ├── admin/                       # NEW
│   │   ├── RoleManagement.tsx
│   │   └── PasswordResetPanel.tsx
│   ├── stats/                       # NEW
│   │   └── StatsDashboard.tsx
│   └── restaurants/                 # Existing ✅
│       └── ...
│
├── pages/
│   ├── BillsPage.tsx                # Thin orchestrator
│   ├── BillDetailPage.tsx
│   ├── CreateBillPage.tsx
│   ├── CollectionsPage.tsx
│   ├── CollectionDetailPage.tsx
│   ├── AdminPage.tsx
│   ├── ProfilePage.tsx
│   ├── StatsPage.tsx
│   └── LoginPage.tsx
│
├── hooks/
│   └── useMutation.ts
│
└── lib/
    ├── api/
    │   ├── client.ts
    │   ├── types.ts
    │   └── index.ts
    ├── translations/
    │   ├── common.ts
    │   ├── bills.ts
    │   ├── restaurants.ts
    │   └── index.ts
    ├── helpers.ts
    ├── session.ts
    ├── result-messages.ts
    └── pwa.ts
```

---

## 5. Priority & Migration Order

| Priority | Change | Risk | Effort |
| :---: | :--- | :---: | :---: |
| 🔴 **P0** | Split `schemas.ts` → `schemas/` | Low | Small |
| 🔴 **P0** | Move API services into `services/` | Low | Small |
| 🟡 **P1** | Extract bill/collection/admin feature folders (web) | Medium | Medium |
| 🟡 **P1** | Slim down `router.ts` — colocate loaders/actions with pages | Medium | Medium |
| 🟡 **P1** | Split `lib/api.ts` → `lib/api/` (types vs client) | Low | Small |
| 🟢 **P2** | Split `translations.ts` by feature namespace | Low | Medium |
| 🟢 **P2** | Split largest route files (`bill-routes.ts`) into sub-modules | Medium | Medium |
| 🟢 **P2** | Move test files alongside source in organized directories | Low | Small |

> **TIP**: Start with P0 changes — they're pure file moves with updated imports,
> no logic changes. They immediately reduce cognitive load and make the remaining
> refactors easier. Each P0 change can be done in a single focused PR.

---

## 6. Summary

The codebase is well-structured for its current size. The monorepo workspace
split, route-per-domain API, composition-root `app.ts`, and early feature folder
(`restaurants/`) are all good choices.

The main improvements are about scaling the existing patterns consistently:

1. **API**: Organize the flat `src/` into `services/`, `schemas/`, `lib/`, and
   `config/` layers.
2. **Web**: Complete the feature-folder pattern for bills, collections, admin,
   and stats — extracting sub-components from oversized page files.
3. **Web**: Make `router.ts` a thin wiring file by colocating loaders/actions
   with pages.
4. **Both**: Split monolith files (`schemas.ts`, `api.ts`, `translations.ts`)
   into domain-scoped modules.
