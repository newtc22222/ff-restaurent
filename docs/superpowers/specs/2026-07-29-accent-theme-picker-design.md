# Accent theme picker — design

Date: 2026-07-29
Status: Approved (design), pending implementation plan

## Objective

Let users pick an accent color for the web app's primary interactive elements,
in addition to the existing light/dark/system mode toggle. Device-local
preference only (no backend/account sync).

## Scope

- 3 curated accent presets, reusing the existing brand trio already defined in
  `apps/web/src/index.css`: **saffron** (default), **basil**, **chili**.
- Accent applies to **primary actions only**: `.btn-primary`, focus rings
  (`.field:focus`), and the active nav-link state in the sidebar.
- Semantic uses of saffron/basil/chili (chips — Favorite/Recommended/etc.,
  `.ticket-edge`, `.title-mark`) are **not** affected and keep their fixed
  colors.
- Picker control lives in `AppHeader`, next to the existing `ThemeToggle`
  (both the desktop action row and the mobile menu row).
- No Linear ticket creation, no backend change, no `User` model change — this
  is a web-only, `localStorage`-persisted preference, out of scope for this
  spec's implementation plan (tracked externally by the requester).

## Non-goals

- Free-form/custom hex color input.
- Per-account persistence or cross-device sync.
- Changing chip/badge/decorative accent usage.

## Design

### 1. Accent tokens

Add two new CSS custom properties following the existing `--color-*` pattern
in `apps/web/src/index.css`:

- `--color-accent`
- `--color-accent-soft` (for hover/soft backgrounds, e.g. focus ring tint)

Each is defined per **accent × mode** — 6 combinations total — gated by a
`data-accent="saffron|basil|chili"` attribute on `<html>`, layered the same
way `.dark` already layers on top of `:root`:

```css
:root,
[data-accent='saffron'] { --color-accent: hsl(36 90% 48%); --color-accent-soft: hsl(36 90% 48% / 14%); }
[data-accent='basil']   { --color-accent: hsl(151 45% 32%); --color-accent-soft: hsl(151 45% 32% / 14%); }
[data-accent='chili']   { --color-accent: hsl(6 78% 52%);  --color-accent-soft: hsl(6 78% 52% / 14%); }

.dark[data-accent='saffron'] { --color-accent: hsl(36 90% 55%); --color-accent-soft: hsl(36 90% 55% / 20%); }
.dark[data-accent='basil']   { --color-accent: hsl(151 50% 45%); --color-accent-soft: hsl(151 50% 45% / 20%); }
.dark[data-accent='chili']   { --color-accent: hsl(6 78% 55%);  --color-accent-soft: hsl(6 78% 55% / 22%); }
```

(Exact HSL values reuse what's already in `.chip-saffron` / `.chip-basil` /
`.chip-chili` today — no new colors to validate.)

`tailwind.config.js` gains matching entries in `theme.extend.colors`:

```js
accent: 'var(--color-accent)',
'accent-soft': 'var(--color-accent-soft)',
```

Default (`:root` / `[data-accent='saffron']`) matches current visuals for
users who never touch the picker, aside from `.btn-primary` (see below),
which is a deliberate, approved visual change.

### 2. `AccentProvider`

New file `apps/web/src/app/providers/accent.tsx`, structurally mirroring
`theme.tsx`:

```ts
export type AccentKey = 'saffron' | 'basil' | 'chili';
const STORAGE_KEY = 'ff-accent';
const DEFAULT_ACCENT: AccentKey = 'saffron';
```

- `AccentProvider` reads `localStorage['ff-accent']` on init (falls back to
  `'saffron'` if missing/invalid), applies `document.documentElement.dataset.accent`
  on mount and on every `setAccent`.
- `useAccent()` exposes `{ accent, setAccent }`.
- Kept as a **separate provider** from `ThemeProvider` — orthogonal concern,
  separate storage key, no migration of the existing `ff-theme` value needed.
- Mounted alongside `ThemeProvider` in `app/App.tsx` (or wherever providers
  are composed today).

### 3. Apply accent to primary actions

In `index.css`:

- `.btn-primary` switches from `bg-ink` (light) / fixed light-gray (dark) to
  `bg-accent text-white` (light) with a dark-mode override that keeps
  sufficient contrast — reuse the same "white text on saturated accent"
  pattern already used for `chip-*` foreground colors, adjusted for a solid
  button background rather than a soft chip background.
- `.field:focus` border color switches from `border-ink` to `border-accent`.
- Sidebar active nav-link state (wherever that class currently hardcodes a
  color — to confirm exact selector during planning) switches to
  `text-accent` / `bg-accent-soft`.

This is a real behavior change from today: primary buttons currently use the
neutral `ink` color, not any brand accent. Confirmed intentional per design
discussion.

### 4. `AccentToggle` UI component

New file `apps/web/src/components/ui/AccentToggle.tsx`, structurally
mirroring `ThemeToggle.tsx`:

- Uses the existing `Dropdown` component (`variant="header"`, `menuAlign="right"`).
- 3 options (saffron/basil/chili), each rendering a small colored dot
  (`<span>` with inline `background` from the accent's HSL, or a Tailwind
  arbitrary-value class) instead of a Lucide icon.
- Trigger icon shows the currently selected accent's dot.
- Props shape mirrors `ThemeToggleProps`: `{ accent, setAccent, label,
  saffronLabel, basilLabel, chiliLabel }`.

Wired into `AppHeader.tsx`:
- Desktop row: rendered next to `<ThemeToggle />`.
- Mobile menu: rendered as an additional `flex items-center justify-between`
  row, same pattern as the existing language/theme rows.

### 5. i18n labels

Add to `apps/web/src/lib/translations/{en,vi}/common.json` (same file that
already holds `theme.light` / `theme.dark` / `theme.system`):

- `theme.accent` (control label, e.g. "Accent" / "Màu nhấn")
- `theme.accentSaffron`, `theme.accentBasil`, `theme.accentChili`

### 6. Tests

- New `apps/web/src/app/providers/accent.test.tsx` (or colocated), mirroring
  whatever coverage `theme.tsx` has today (storage read/write, `data-accent`
  application, invalid stored value fallback).
- Extend `apps/web/src/components/layout/AppHeader.test.tsx` to cover the new
  control (renders, selecting an option calls `setAccent`).
- New `AccentToggle.test.tsx` if `ThemeToggle` has an equivalent standalone
  test file (to confirm during planning).

## Open items for the implementation plan

- Confirm exact selector/class for the sidebar's active nav-link state before
  editing it.
- Confirm whether `ThemeToggle.tsx` / `Dropdown` usage has a standalone test
  file to mirror for `AccentToggle`.
- Confirm dark-mode text contrast on `.btn-primary` against all 3 accent
  colors (esp. basil, which is the darkest/least saturated) meets WCAG AA for
  button text.
