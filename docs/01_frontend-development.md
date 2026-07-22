# Frontend Development Guide

This guide explains how to work on the FF RESTaurent web application in
`apps/web`. It reflects the current route-based React app shipped with v1.1.0.

## Technology Stack

- React 19 with TypeScript
- React Router 7 route loaders and actions
- Vite 7
- Tailwind CSS 3 plus app CSS in `src/index.css`
- `react-hot-toast` for localized transient feedback
- `lucide-react` for icons
- Recharts for responsive statistics charts
- `@ff-restaurent/shared` for shared enums, phone parsing, and bill-splitting
  rules

## Source Layout

```text
apps/web/src/
|-- main.tsx
|-- index.css
|-- app/
|   |-- App.tsx
|   |-- router.ts
|   |-- router.test.ts
|   `-- providers/
|       |-- app-context.tsx
|       |-- i18n.tsx
|       `-- theme.tsx
|-- pages/
|   |-- LoginPage.tsx
|   |-- BillsPage.tsx
|   |-- BillDetailPage.tsx
|   |-- CreateBillPage.tsx
|   |-- CollectionsPage.tsx
|   |-- CollectionDetailPage.tsx
|   |-- ParticipantGroupsPage.tsx
|   |-- StatsPage.tsx
|   |-- ProfilePage.tsx
|   `-- AdminPage.tsx
|-- features/
|   `-- restaurants/
|       |-- RestaurantsPage.tsx
|       |-- RestaurantDetailPage.tsx
|       |-- RestaurantCatalogFields.tsx
|       |-- RestaurantProfileFields.tsx
|       |-- RestaurantBanner.tsx
|       |-- RestaurantFeedback.tsx
|       `-- PlatformLinksEditor.tsx
|-- components/
|   |-- ui/
|   |-- layout/
|   `-- address/
|-- hooks/
|   `-- useMutation.ts
`-- lib/
    |-- api.ts
    |-- helpers.ts
    |-- pwa.ts
    |-- result-messages.ts
    |-- session.ts
    `-- translations.ts
```

Tests are colocated with the source they cover as `*.test.ts`, `*.test.tsx`, or
focused JavaScript policy tests.

## Routing and Data Flow

The app uses React Router, configured in `src/app/router.ts`.

- `App.tsx` owns the shell and route error boundary.
- `router.ts` defines the route tree, loaders, actions, redirects, and lazy page
  loading.
- Page components read loader data and action results through React Router APIs.
- Shared app state, including the authenticated user and i18n/theme providers,
  lives under `src/app/providers/`.
- Form mutations should use route `action`s when they are navigation-coupled.
  Component-local actions can use the existing `useMutation` hook.

Do not reintroduce the obsolete `tab`/`screen` state-router pattern or
page-level result banners. Mutation outcomes, background warnings, and API
failures should use localized `react-hot-toast` messages unless a field-level
validation error or route error boundary is more appropriate.

## API Client and Session Handling

`src/lib/api.ts` contains the `ApiClient`, API error type, request/response
types, and formatting helpers. Keep it aligned with API response serializers and
Prisma include/select shapes.

Session storage is isolated in `src/lib/session.ts`. JWTs include a
`sessionVersion`; password changes, assisted resets, and root transfers can
invalidate older tokens. The web client should replace the stored token whenever
the API returns a fresh one.

## Components and UI Rules

- Use shared primitives from `src/components/ui` before adding one-off controls.
- Use `Dropdown.tsx` for production selection controls. Do not add native
  `<select>` elements for app selection UI.
- Use `ScrollArea.tsx` for app-owned scrolling regions. Do not add
  `react-scrollbars-custom`.
- Use `ConfirmDialog.tsx` or `Modal.tsx` for destructive confirmations and
  focused modal workflows.
- Keep reusable shell pieces in `components/layout`.
- Keep domain-specific restaurant UI in `features/restaurants`; follow that
  pattern when extracting other large domains.

## Domain Rules

- All money values from the API are integer cents. Never use floating point math
  for persisted or API monetary values.
- Shared bill-splitting behavior belongs in `packages/shared`, not duplicated in
  the web app.
- The API is the source of truth for Vietnamese phone validation. The web uses
  the shared parser only for immediate feedback.
- ROOT_ADMIN is the only role that manages member roles and root ownership.
  HEAD_CHEF has global bill visibility and archive/restore powers, but must not
  be treated as a member-governance role.
- Phase 2 normalized restaurant contracts are authoritative. Favorites and
  recommended restaurants persist through collections; cuisine and platform
  links persist through normalized relations. Legacy response aliases are
  derived by the API compatibility serializer.

## Shared Package Consumption

Development and typechecking resolve `@ff-restaurent/shared` to
`packages/shared/src/index.ts` through the web `tsconfig` and Vite alias.

The root build and packaged API still rely on compiled workspace output, so
rebuild shared before production builds or when validating changes that touch
shared exports:

```powershell
npm run build --workspace @ff-restaurent/shared
```

## Local Development

Run from the repository root:

```powershell
npm install
npm run dev --workspace @ff-restaurent/web
```

Expected local URL:

```text
http://localhost:5173
```

The API base URL is controlled by `VITE_API_URL`.

## Verification

For web-only changes:

```powershell
npm run typecheck --workspace @ff-restaurent/web
npm run lint --workspace @ff-restaurent/web
npm test --workspace @ff-restaurent/web
npm run build --workspace @ff-restaurent/web
```

For broader changes before review:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

When shared code changes, run the shared package tests and rebuild shared before
web verification:

```powershell
npm test --workspace @ff-restaurent/shared
npm run build --workspace @ff-restaurent/shared
```

## Frontend Change Checklist

- Add or update route loaders/actions when page data or navigation-coupled
  mutations change.
- Keep API response types in `src/lib/api.ts` aligned with backend responses.
- Use localized strings from `src/lib/translations.ts`; avoid hard-coded user
  facing text in feature UI.
- Keep transient mutation feedback in toasts.
- Keep validation close to the field or route action that owns it.
- Preserve integer-cent handling for money.
- Use shared UI primitives for dropdowns, modals, scroll regions, and layout.
- Add or update colocated tests for changed routing, API result handling, and
  component behavior.
