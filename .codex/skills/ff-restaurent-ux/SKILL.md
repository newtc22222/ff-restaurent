---
name: ff-restaurent-ux
description: Apply and maintain the FF RESTaurent web design language in the React/Tailwind frontend. Use when Codex is asked to design, redesign, polish, or verify UI/UX for apps/web, especially login, dashboard, bills, bill detail, create bill, restaurant directory, notifications, stats, responsive behavior, Tailwind styling, and matching the Design app UX focus reference.
---

# FF RESTaurent UX

## Workflow

1. Inspect the current `apps/web/src/App.tsx`, `apps/web/src/index.css`, and relevant component state before editing.
2. If matching the reference design, inspect `Design app UX focus/src/app/App.tsx` and use it as the interaction/style source, not as a direct drop-in replacement.
3. Read `references/design-system.md` for the app's visual and interaction rules.
4. Preserve real API behavior. Design changes must keep existing auth, role gating, bill actions, and forms wired to `ApiClient`.
5. Prefer the existing Tailwind utility style and app-local helpers. Inspect `apps/web/src/components/ui/Dropdown.tsx` before implementing any select, filter, or searchable picker. Reuse it unless the interaction cannot fit its single/multi-select contract. Do not add a UI library unless explicitly requested.
6. Verify desktop and mobile layouts. Use screenshots or Playwright when available; otherwise run typecheck/build and inspect in the browser.

## UX Priorities

- Make bills scannable: cards, payment progress, member chips, clear primary detail action.
- Keep create/edit flows focused: one centered panel, clear back navigation, compact inputs, live summary.
- Keep operational views dense but readable. Avoid marketing-page structure.
- Maintain role-aware controls. Hide chef/admin actions from users who cannot perform them.
- Avoid layout clipping on mobile. Use horizontal nav only when it fits better than a cramped sidebar.
- Keep selection controls consistent: use the themed `Dropdown` variants for header controls, compact filters, and form fields; enable its search mode for Restaurant/Eatery, Member, and other potentially large option sets.

## Validation

Run at least:

```powershell
npm run typecheck --workspace @ff-restaurent/web
npm run build --workspace @ff-restaurent/web
```

Also run web lint when CSS/TSX changes are not purely exploratory:

```powershell
npm run lint --workspace @ff-restaurent/web
```

For screenshot verification, a mocked API route in Playwright is acceptable when Docker/Postgres is not running. Verify login, bills dashboard, bill detail, create bill, and one mobile viewport.
