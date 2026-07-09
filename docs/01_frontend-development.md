# Frontend Development Guide

Welcome to the FF RESTaurent Frontend Development Guide. This document provides an overview of the architecture, technology stack, directory structure, and coding standards used in the React Vite single-page application (`apps/web`).

---

## Technology Stack

The frontend application is built using the following modern web technologies:
- **Core Library**: React 19
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 3 (utility-first CSS frameworks) & Vanilla CSS overrides
- **Icons**: Lucide React
- **Charts**: Recharts (fully responsive canvas/SVG stats charts)
- **Shared Module**: `@ff-restaurent/shared` (contains split calculations, shared validation types, and interfaces)

---

## Folder & Component Structure

The frontend application follows the **KISS (Keep It Simple, Stupid)** principle. It utilizes a flat, component-level separation to avoid over-engineering and folder clutter:

```
apps/web/src/
├── App.tsx                     # Main entry point orchestrating state, auth, and subviews
├── api.ts                      # Client wrapper utilizing Fetch API and defining response types
├── i18n.ts                     # Multi-language translation dictionaries and hooks (EN/VI)
├── main.tsx                    # React application bootstrap entry
├── theme.ts                    # Theme hook supplying Light, Dark, or System themes
├── index.css                   # Core stylesheet importing Tailwind utilities
│
├── utils/
│   └── helpers.ts              # Pure utilities, constants, permissions, and role validation helpers
│
└── components/
    ├── ui/                     # Generic, stateless, and low-level reusable UI components
    │   ├── BrandIcon.tsx       # Logo/Brand icon
    │   ├── ThemeToggle.tsx     # Theme switcher trigger
    │   ├── LocaleToggle.tsx    # Language switcher trigger
    │   ├── ConfirmDialog.tsx   # Warning/Confirmation modal popup
    │   ├── SelectDropdown.tsx  # Customized single-select dropdown
    │   ├── MultiSelectDropdown.tsx # Customized checkbox multi-select dropdown
    │   ├── SectionTitle.tsx    # Standard view header (title/subtitle)
    │   ├── EmptyState.tsx      # Onboarding prompt for empty lists
    │   ├── AmountInput.tsx     # Standard currency input wrapper for VND
    │   ├── SummaryLine.tsx     # Styled invoice summary details row
    │   └── StatCard.tsx        # Spending metrics indicator row
    │
    ├── layout/                 # Layout/Structural components
    │   ├── AppHeader.tsx       # Standardized application topbar header
    │   └── Sidebar.tsx         # Sidebar navigation links
    │
    └── views/                  # Main screen views and tabs components
        ├── LoginScreen.tsx     # Authenticating login and register forms
        ├── BillsView.tsx       # Main bills listing tab (includes BillCard and PaymentChip)
        ├── BillDetailPage.tsx  # Detailed split invoice view and payment statuses
        ├── CreateBillPage.tsx  # Bill creation wizard & participant allocation form
        ├── RestaurantsView.tsx # Restaurants listing, favorites, and recommendations
        ├── RestaurantDetailPage.tsx # Restaurant details, link lists, and archive controls
        ├── StatsView.tsx       # Stats charts dashboard
        ├── AdminView.tsx       # Manager screen to adjust user chef roles
        └── ProfilePage.tsx     # Profile updating card
```

---

## State Management & Routing

To keep the application simple and direct:
1. **No External Router**: Navigation is controlled entirely by React state `tab` (for sidebar sections) and `screen` (for specific page views like `'create-bill'`, `'bill-detail'`).
2. **State Location**: The central application state (e.g. current user, list of bills, restaurants, loading indicators) resides in `App.tsx` and is passed down to components via standard React props.
3. **Uni-directional Data Flow**: Actions (e.g. paying a share, archiving a bill) are initiated in subcomponents and pass up through callbacks to trigger `App.tsx` to update states and invoke refetching.

---

## Development Guidelines

### 1. Integer Cents (Money Representation)
- All monetary values are handled and stored as **integer cents** (represented in VND currency).
- Never use floats for monetary calculations to avoid rounding discrepancies.
- Reuse `money()` formatting helper from `api.ts` to convert integers into readable VND symbols.

### 2. Multi-language (i18n) & Themes
- The application supports English (`en`) and Vietnamese (`vi`, default). Use the `useI18n()` hook to retrieve the current locale, translation helper `t()`, and setter `setLocale()`.
- Use the `useTheme()` hook to manage `theme` ('light' | 'dark' | 'system'). Tailor styles for dark mode using Tailwind's `dark:` modifier.

### 3. Shared Package Consumption
- Shared logic (e.g. calculations, shared validation types) is imported from `@ff-restaurent/shared`.
- **Note**: TypeScript compiles the shared workspace package to `dist/`. If you modify anything under `packages/shared`, you must rebuild it so the frontend can resolve the new imports:
  ```bash
  npm run build -w @ff-restaurent/shared
  ```

### 4. Code Standards & Naming
- Use highly descriptive and clear names. Avoid cryptic abbreviations (e.g., use `onSelectRestaurant` instead of `selRes`).
- Write brief JSDoc comments for components, documenting props and explaining any non-obvious logic.

---

## Workspace Commands

Run these commands from the root directory of the monorepo:

### Local Development
```bash
# Run the Vite web development server (available at http://localhost:5173)
npm run dev -w @ff-restaurent/web
```

### Build & Verification
```bash
# Typecheck TypeScript files
npm run typecheck

# Lint source files
npm run lint

# Build production distribution bundle
npm run build
```
