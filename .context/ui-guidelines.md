# FF RESTaurent UI Guidelines (`.context/ui-guidelines.md`)

This document defines the authoritative design, layout, accessibility, and component usage guidelines for **FF RESTaurent** (`@ff-restaurent/web`). It synthesizes the consolidated tokens from [`.context/design-tokens.json`](file:///c:/Vault/Project/management-platform/ff-restaurent/.context/design-tokens.json) and component registry from [`.context/COMPONENTS.md`](file:///c:/Vault/Project/management-platform/ff-restaurent/.context/COMPONENTS.md).

---

## Rule Severity Tags

Every guideline in this document includes an explicit severity tag:

- **`[MUST]`**: Strict requirement. Code violating `[MUST]` rules will fail design and code reviews.
- **`[SHOULD]`**: Recommended best practice. Deviations require clear justification.
- **`[AVOID]`**: Anti-pattern. Prohibited code pattern or design smell.

---

## 1. Color System & Palette Rules

### A. Semantic Variables & Theme Tokens

- `[MUST]` Use theme CSS variables (`var(--color-bg)`, `var(--color-surface)`, `var(--color-ink)`, `var(--color-border)`, `var(--color-muted)`) and extended Tailwind tokens (`saffron`, `basil`, `chili`, `success`) for all application styling.
- `[MUST]` Support both light mode and dark mode (`.dark` class) seamlessly by referencing semantic surface and border tokens instead of fixed light colors.

### B. Brand Accent Colors

- `[MUST]` Use canonical Saffron (`hsl(36 90% 48%)` / `bg-saffron` / `text-saffron`) for the application brand icon, active bill states, and waiting participant badges.
- `[MUST]` Use `.chip-saffron` (`bg-saffron/14 text-saffron-dark` in light mode, `bg-saffron/20 text-saffron-light` in dark mode) for notification highlights, step indicators, and warning badges.
- `[MUST]` Use canonical Basil (`hsl(151 45% 32%)` / `bg-basil` / `text-basil`) and `.chip-basil` for restaurant spend indicators, settled financial states, and paid member badges.
- `[MUST]` Use Chili (`hsl(6 78% 52%)` / `bg-chili` / `text-chili`) and `.chip-chili` for destructive warnings, removal badges, and error states.

### C. System & Status Feedback Colors

- `[MUST]` Use `semantic.success` (`var(--color-success)` / `hsl(151 55% 42%)`) for system toast success icons (`ToastHost`), inline operational status confirmation, and non-brand success indicators.
- `[AVOID]` Hardcoded hex color literals (e.g. `#e9900c`, `#10b981`, `#0f1729`) in TSX/JSX component markup.
- `[AVOID]` Generic Tailwind color swatches (e.g. `bg-amber-50`, `text-orange-700`, `bg-emerald-500`, `text-emerald-600`) when semantic brand tokens (`saffron`, `basil`, `chip-saffron`, `chip-basil`) are applicable.

---

## 2. Typography & Numeric Scale

### A. Font Scale Steps

- `[MUST]` Enforce the established typography scale:
  - `text-2xs` (11px / `0.6875rem`): Form field labels (`.label`), chip badges (`.chip-badge`), field group titles (`.field-group-title`), step headers.
  - `text-xs` (12px / `0.75rem`): Supporting metadata, help text, compact dropdown labels.
  - `text-compact` (13px / `0.8125rem`): Table cells, dropdown option items, `SummaryLine` values, `BackButton` text.
  - `text-sm` (14px / `0.875rem`): Form input text (`.field`), standard body text, button text (`.btn`), confirm dialog message.
  - `text-base` (16px / `1rem`): Modal titles, confirm dialog titles, section headings.
  - `text-lg` (18px / `1.125rem`): Page section headers (`SectionTitle`), empty state titles.
  - `text-xl` (20px / `1.25rem`): Major page titles (`SectionTitle`).
- `[MUST]` Apply `.label` (`@apply text-2xs font-semibold uppercase tracking-[0.5px] text-slate-500`) for input field labels.
- `[AVOID]` Arbitrary font size classes (e.g. `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[14px]`, `text-[16px]`).
- `[SHOULD]` Keep `text-[15px]` restricted to the `AppHeader` brand title until design review merges it into standard scale.

### B. Numeric & Currency Display

- `[MUST]` Apply `font-variant-numeric: tabular-nums` / `.ticket-figure` to all financial figures, bill totals, member cost shares, and rating scores to ensure vertical alignment.
- `[MUST]` Format currency values exclusively via shared `money()` helpers and integer-cent values from `@ff-restaurent/shared`.
- `[AVOID]` Manual floating-point currency formatting or duplicating bill-splitting math.

---

## 3. Control Heights, Spacing & Shapes

### A. Semantic Control Heights

- `[MUST]` Use standard semantic control height utility classes for all interactive elements:
  - `.control-sm` (`h-8` / 32px): Header controls (`LocaleToggle`, `ThemeToggle`), compact icon buttons, small form tags.
  - `.control-md` (`h-9` / 36px): Filter dropdown triggers (`variant="filter"`), header action buttons.
  - `.control-default` (`h-10` / 40px): Standard form inputs (`.field`), primary/secondary buttons (`.btn`), standard dropdown triggers (`variant="field"`).
  - `.control-lg` (`h-12` / 48px): Major container headers, desktop sidebar toggle bar.
- `[MUST]` Apply `.field` (`@apply control-default rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-ink;`) for form input fields.
- `[MUST]` Apply `.btn` (`@apply inline-flex control-default items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50;`) along with `.btn-primary` or `.btn-soft` for button controls.

### B. Shape Radii & Layout Cards

- `[MUST]` Use 6px border radius (`rounded-md`) for inputs, buttons, dropdown triggers, and select menus.
- `[MUST]` Use 12px border radius (`rounded-xl` / `.panel`) for surface cards, filter bars (`FilterBar`), modal dialog panels (`Modal`, `ConfirmDialog`), and container groups (`.field-group`).
- `[MUST]` Use full rounded pill radius (`rounded-full`) for status chips (`.chip`), avatar badges, progress bars, and scrollbar thumbs.
- `[AVOID]` Ad-hoc height utilities (e.g. `h-[38px]`, `h-[42px]`) or custom inline dimensions (`style={{ width: size, height: size }}`).

---

## 4. Modals, Dialogs & Overlay System

### A. Portal Mounting & Accessibility

- `[MUST]` Render all modal dialogs (`Modal`, `ConfirmDialog`) into `document.body` via React `createPortal`.
- `[MUST]` Include accessibility attributes on dialog panels: `role="dialog"`, `aria-modal="true"`, and `aria-labelledby={titleId}`.
- `[MUST]` Implement focus management: focus the first interactive control inside the dialog upon opening, and restore focus to the previously active element upon closing.
- `[MUST]` Add Escape key event listener (`event.key === 'Escape'`) to dismiss open dialogs (unless `pending` state is true).
- `[MUST]` Lock document body scrolling when a modal is active (`document.body.style.overflow = 'hidden'`).

### B. Backdrop Overlay Classes

- `[MUST]` Use `.overlay-backdrop` (`@apply fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm;`) for all modal and confirmation dialog overlays (`Modal`, `ConfirmDialog`).
- `[MUST]` Use `.overlay-subtle` (`@apply bg-slate-950/25 backdrop-blur-[1px];`) exclusively for mobile navigation drawer backdrops (`Sidebar`).
- `[AVOID]` Un-portaled inline modal containers, raw `bg-black/50` backdrops without blur, or dialogs missing Escape key listeners and focus trapping.

---

## 5. Selection Controls & Pickers

### A. Dropdown Selection Pattern

- `[MUST]` Use `apps/web/src/components/ui/Dropdown.tsx` for all single-selects, multi-selects, filter pickers, searchable options, and header toggles.
- `[MUST]` Select the appropriate dropdown variant:
  - `variant="field"`: Form input fields & list filter pickers (`control-default`).
  - `variant="header"`: Header toggles (`control-sm`).
- `[MUST]` Enable `searchable` mode for dynamic or potentially large option sets (Restaurants, Members, Cuisines, Wards/Provinces).
- `[MUST]` Pass localized search placeholders, empty result messages, and clear button labels.

### B. Selection Control Anti-Patterns

- `[AVOID]` Native HTML `<select>` elements anywhere in production web code (enforced by project rules).
- `[AVOID]` Custom page-specific select popovers or custom dropdown hooks when `Dropdown.tsx` can fulfill the interaction contract.

---

## 6. Scroll Containers & Custom Scrollbars

- `[MUST]` Wrap inner scrollable lists or regions using `apps/web/src/components/ui/ScrollArea.tsx` or apply the `.scroll-area` CSS utility class.
- `[MUST]` Specify the explicit axis (`axis="x"`, `axis="y"`, or `axis="both"`).
- `[AVOID]` Adding third-party scrollbar libraries (such as `react-scrollbars-custom`) or un-styled raw `overflow-y-auto` divs in scrollable dialogs/menus.

---

## 7. Component Reuse Checklist

Before creating a new UI component, developers and AI coding agents `[MUST]` consult [`.context/COMPONENTS.md`](file:///c:/Vault/Project/management-platform/ff-restaurent/.context/COMPONENTS.md) and reuse existing primitives:

| Requirement | Existing Component to Use |
| :--- | :--- |
| **VND Currency Input** | `AmountInput` ([AmountInput.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/AmountInput.tsx)) |
| **Back Navigation Link** | `BackButton` ([BackButton.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/BackButton.tsx)) |
| **Brand Logo Box** | `BrandIcon` ([BrandIcon.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/BrandIcon.tsx)) |
| **Confirmation Alert Modal** | `ConfirmDialog` ([ConfirmDialog.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ConfirmDialog.tsx)) |
| **Selection / Filter Dropdown** | `Dropdown` ([Dropdown.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/Dropdown.tsx)) |
| **Zero-Data State View** | `EmptyState` ([EmptyState.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/EmptyState.tsx)) |
| **Filter Bar Container** | `FilterBar` ([FilterBar.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/FilterBar.tsx)) |
| **Image Upload & Preview** | `ImagePicker` ([ImagePicker.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ImagePicker.tsx)) |
| **Language Toggle** | `LocaleToggle` ([LocaleToggle.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/LocaleToggle.tsx)) |
| **General Modal Dialog** | `Modal` ([Modal.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/Modal.tsx)) |
| **Custom Scroll Container** | `ScrollArea` ([ScrollArea.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ScrollArea.tsx)) |
| **Section Heading & Subtitle** | `SectionTitle` ([SectionTitle.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/SectionTitle.tsx)) |
| **Category Spend Visualizer** | `StatCard` ([StatCard.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/StatCard.tsx)) |
| **Key-Value Summary Row** | `SummaryLine` ([SummaryLine.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/SummaryLine.tsx)) |
| **Theme Toggle** | `ThemeToggle` ([ThemeToggle.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ThemeToggle.tsx)) |
| **Notification Toast Host** | `ToastHost` ([ToastHost.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ToastHost.tsx)) |
| **Vietnamese Address Fields** | `VietnamAddressFields` ([VietnamAddressFields.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/address/VietnamAddressFields.tsx)) |
| **Platform Links Editor** | `PlatformLinksEditor` ([PlatformLinksEditor.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/restaurants/PlatformLinksEditor.tsx)) |
