# UI Guidelines Lint Enforcement Plan (`.context/lint-enforcement-plan.md`)

This document outlines the exact ESLint and Stylelint rule configurations proposed to enforce [`.context/ui-guidelines.md`](file:///c:/Vault/Project/management-platform/ff-restaurent/.context/ui-guidelines.md), along with empirical dry-run measurements and a phased migration strategy.

---

## 1. Rule Configurations

### A. ESLint AST Syntax Restrictions (`eslint.config.js`)

Add the following `no-restricted-syntax` rules targeting React TSX/JSX components:

```javascript
// eslint.config.js
export default [
  // ...
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'warn', // Configured as 'warn' during Phase 1 migration
        {
          selector: 'JSXElement[openingElement.name.name="select"]',
          message: 'Do not use native <select>. Use the shared Dropdown component (@/components/ui/Dropdown.tsx) instead.',
        },
        {
          selector: 'JSXAttribute[name.name="className"] Literal[value=/text-\\[\\d+px\\]/]',
          message: 'Do not use arbitrary font sizes text-[Npx]. Use standard font scale tokens (text-2xs, text-xs, text-compact, text-sm, text-base, text-lg, text-xl).',
        },
        {
          selector: 'JSXAttribute[name.name="className"] Literal[value=/bg-\\[#[0-9a-fA-F]+\\]|text-\\[#[0-9a-fA-F]+\\]/]',
          message: 'Do not use hardcoded hex colors in className. Use semantic theme tokens (bg-saffron, bg-basil, chip-saffron, etc.).',
        },
      ],
    },
  },
];
```

### B. Stylelint CSS Rules (`.stylelintrc.json`)

To enforce rules on `index.css` and custom CSS files:

```json
{
  "rules": {
    "color-named": "never",
    "declaration-property-value-disallowed-list": {
      "/^font-size/": ["/\\d+px/"],
      "color": ["/#e9900c/", "/#10b981/"]
    }
  }
}
```

---

## 2. Dry-Run Test Measurements

Executed dry-run measurement using `npm run lint --workspace @ff-restaurent/web`:

- **Total Violations Detected**: **71 warnings** (0 fatal errors).
- **Violation Breakdown**:
  1. **Arbitrary Font Size (`text-[Npx]`)**: **65 instances** across feature pages ([`CreateBillPage.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/bills/CreateBillPage.tsx), [`BillDetailPage.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/bills/BillDetailPage.tsx), [`RestaurantsPage.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/restaurants/RestaurantsPage.tsx), [`StatsPage.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/stats/StatsPage.tsx), [`ProfilePage.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/profile/ProfilePage.tsx)).
  2. **Hardcoded Hex in `className` (`bg-[#...]`)**: **4 instances** ([`ProfilePage.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/profile/ProfilePage.tsx), [`StatsPage.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/stats/StatsPage.tsx)).
  3. **Native `<select>` element**: **2 instances** in test files ([`CreateBillPage.test.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/bills/CreateBillPage.test.tsx), [`ParticipantGroupsPage.test.tsx`](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/participant-groups/ParticipantGroupsPage.test.tsx)).

---

## 3. Phased Migration Strategy

Because immediate error enforcement would break existing CI pipelines (`npm run lint`), the migration will follow a 3-phase rollout:

### Phase 1: Soft Warning Enforcement (Current State)

- **Status**: **ACTIVE**
- **Action**: Register rules as `'warn'` in `eslint.config.js`.
- **Effect**: Developers and AI agents receive real-time IDE warnings while CI builds (`npm run lint`) continue to pass clean without breaking PRs.

### Phase 2: Feature Page Refactoring Sprints

- **Sprint A (High Priority)**: Refactor hardcoded hex colors and native `<select>` usages (6 violations).
- **Sprint B (Core Bill Pages)**: Refactor `CreateBillPage.tsx`, `BillsPage.tsx`, and `BillDetailPage.tsx` to use named scale tokens (`text-2xs`, `text-compact`, `text-xs`, `text-sm`).
- **Sprint C (Secondary Views)**: Refactor `StatsPage.tsx`, `ProfilePage.tsx`, `RestaurantDetailPage.tsx`, and `CollectionsPage.tsx`.

### Phase 3: Hard Enforcement & CI Gate

- **Condition**: Total violation count reaches 0.
- **Action**: Change rule severity from `'warn'` to `'error'` in `eslint.config.js`.
- **Effect**: Any future PR introducing arbitrary font sizes or hardcoded hex colors will be blocked automatically by CI.
