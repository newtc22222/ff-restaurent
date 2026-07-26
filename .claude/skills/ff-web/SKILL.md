---
name: ff-web
description: >-
  Use whenever a task touches the FF RESTaurent **frontend** (`apps/web`) — the
  React SPA/PWA (Vite + Tailwind): pages and components, react-router v7 routes
  with their loaders/actions, the `ApiClient` in `lib/api.ts`, EN/VI i18n,
  light/dark theming, or PWA behavior. Fire this for any UI / component /
  screen / "the web app" / "the client" / styling / routing work, even when the
  user doesn't name `apps/web`. Prefer it over the backend skill for
  frontend/UI questions.
---

# ff-web — the React SPA/PWA frontend (`apps/web`)

## Purpose & scope

`apps/web` is the client: a React SPA/PWA built with Vite and Tailwind CSS, with
EN/VI internationalization and light/dark theming. It talks to `apps/api` (see
[[ff-api]]) exclusively through a typed `ApiClient`, and imports shared
types/enums/math from `@ff-restaurent/shared` (see [[ff-shared]]).

## Structure

`apps/web/src/`:

- `app/` — `App.tsx`, `router.ts` (the **react-router v7** route tree), and
  `providers/` (`app-context.tsx`, `i18n.tsx`, `theme.tsx`).
- `pages/` — one component per non-feature screen (Login, Bills, BillDetail,
  CreateBill, Collections, CollectionDetail, ParticipantGroups, Stats, Profile,
  Admin).
- `features/` — domain-owned pages/components/tests; `restaurants/` holds the
  restaurant directory + detail feature.
- `components/` — shared `ui/` primitives, `layout/`, and `address/`.
- `lib/` — `api.ts` (the `ApiClient` class: all API calls + local response
  types), `session.ts`, `translations/` (JSON per locale and domain behind a
  typed barrel), `helpers.ts`, `result-messages.ts`, `pwa.ts`.
- `hooks/` — reusable hooks (e.g. `useMutation`).
- Tests are colocated `*.test.tsx` (vitest + jsdom).

## Core patterns — where to add code

- **Routing is react-router v7**, configured in `app/router.ts` via
  `createBrowserRouter`: a nested route tree with **per-route `loader`s** (data
  fetching) and **`action`s** (mutations), and lazily imported page components.
  The router-wide loader shape is `AppLoaderData` (in `providers/app-context`).
- **New screen** → create a `pages/` component (or a `features/<domain>/`
  component for domain-owned screens) and wire a route into `app/router.ts` with
  its `loader`/`action`.
- **Server calls** → always go through the `ApiClient` in `lib/api.ts`. Don't
  `fetch` directly from components; add a method to `ApiClient` and call it from a
  loader/action or `useMutation`.
- **Copy / labels** → EN/VI strings live in `lib/translations/{vi,en}/<domain>.json`; use the i18n
  provider rather than hardcoding text. User-facing result toasts go through
  `result-messages.ts` + `react-hot-toast`.
- **Shared UI** → `components/ui/` primitives; check there before building a new
  input/button/dialog.

## Dependencies & build

- Imports `@ff-restaurent/shared`, aliased to **source** in `vite.config.ts` and
  the web tsconfig — so no shared build step is needed for web dev/typecheck
  (see [[ff-shared]]).
- Dev: `npm run dev -w @ff-restaurent/web` (`http://localhost:5173`).
- `VITE_API_URL` sets the backend base URL the `ApiClient` targets.

## Gotchas

1. **It uses react-router (v7), not a hand-rolled state router.** Older docs may
   say "there is no router library / navigation is driven by router.ts state" —
   that's wrong. `router.ts` is a `createBrowserRouter` config; data flows through
   loaders/actions, not ad-hoc component state.
2. **Vite resolves `@ff-restaurent/shared` from source**, so you never need to
   build the shared package to run or typecheck web.
3. **`components/ui/Dropdown.tsx` is a custom button-based listbox**
   (`role="listbox"` / `role="option"`), **not** a native `<select>`. It takes an
   **`ariaLabel`** prop (camelCase — passing `aria-label` silently does nothing),
   and Playwright/Testing-Library `selectOption` will **not** work on it; drive it
   by clicking the trigger then the `role="option"` item.
4. **Never expose the Supabase service-role key to Vite** — it is API-only. Only
   safe, `VITE_`-prefixed public config belongs in the web env.
5. **Money is integer cents** end-to-end (matches [[ff-shared]] / [[ff-api]]);
   format for display, but keep values as integer cents in state and API calls.
6. Response types in `lib/api.ts` duplicate backend contracts — when an API
   response shape changes in [[ff-api]], update `ApiClient` here to match.
