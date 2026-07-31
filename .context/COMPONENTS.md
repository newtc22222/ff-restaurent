# Component Registry (`.context/COMPONENTS.md`)

This document serves as the authoritative component registry for the **FF RESTaurent** codebase. Developers and AI coding agents MUST inspect this registry before creating new components to avoid duplicating existing implementations.

---

## Workspace & Framework System Overview

| Property                                     | Details                                                                                 |
| :------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **Primary Framework System**                 | **React web component** (`apps/web` — React 19, React Router v7, Vite, Tailwind CSS)    |
| **Shared Domain Package**                    | `@ff-restaurent/shared` (`packages/shared`)                                             |
| **Equivalent Vue 2 / Vue 3 Implementations** | **None in this repository** (The monorepo frontend is exclusively built with React 19). |
| **Barrel Export**                            | `apps/web/src/components/ui/index.ts`                                                   |

---

## 1. UI Primitives (`apps/web/src/components/ui/`)

### AmountInput

- **Framework System**: React web component
- **Source File**: [AmountInput.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/AmountInput.tsx)
- **Export**: `default export AmountInput`
- **Description**: Standardized input field for VND currency amounts formatting integer values using `react-currency-input-field`.
- **Props**:
  - `label`: `string`
  - `value`: `number` (numeric value in currency units)
  - `onChange`: `(value: number) => void`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### BackButton

- **Framework System**: React web component
- **Source File**: [BackButton.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/BackButton.tsx)
- **Export**: `default export BackButton`
- **Description**: Shared back-navigation button control for pages inside the application shell (`ArrowLeft` icon + label styled with `.text-compact`).
- **Props**:
  - `label`: `string`
  - `onClick`: `() => void`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### BrandIcon

- **Framework System**: React web component
- **Source File**: [BrandIcon.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/BrandIcon.tsx)
- **Export**: `default export BrandIcon`
- **Description**: Restaurant logo/icon box container styled with canonical brand saffron background (`bg-saffron`) and `UtensilsCrossed` icon.
- **Props**:
  - `size?`: `number` (default: `48`)
- **Equivalent in Other Frameworks**: N/A in repository.

---

### ConfirmDialog

- **Framework System**: React web component
- **Source File**: [ConfirmDialog.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ConfirmDialog.tsx)
- **Export**: `default export ConfirmDialog`
- **Description**: Accessible modal confirmation dialog rendered at `document.body` via `createPortal`. Implements `.overlay-backdrop`, `role="dialog"`, `aria-modal="true"`, focus management, Escape key listener, locally translated labels from `useI18n`, and confirm/cancel action buttons.
- **Props**:
  - `title`: `string`
  - `message`: `string`
  - `onConfirm`: `() => void`
  - `onCancel`: `() => void`
  - `pending?`: `boolean` (default: `false`)
- **Equivalent in Other Frameworks**: N/A in repository.

---

### Dropdown

- **Framework System**: React web component
- **Source File**: [Dropdown.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/Dropdown.tsx)
- **Export**: `default export Dropdown`, `export interface DropdownOption`
- **Description**: Canonical themed single/multi-select picker component featuring auto-flipping viewport positioning, searchable filtering, `createPortal` listbox container, keyboard navigation, and custom trigger variants (`field`, `header`).
- **Props Interface**:
  - `label`: `string`
  - `options`: `DropdownOption[]` (`{ value, label, icon?, description?, searchText? }`)
  - `variant?`: `'field' | 'header'` (default: `'field'`)
  - `searchable?`: `boolean` (default: `false`)
  - `multiple?`: `boolean`
  - `value?`: `string` (for single-select)
  - `values?`: `string[]` (for multi-select)
  - `onChange`: `(value: string | string[]) => void`
  - `allowClear?`: `boolean`
  - `fullWidth?`: `boolean`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### EmptyState

- **Framework System**: React web component
- **Source File**: [EmptyState.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/EmptyState.tsx)
- **Export**: `default export EmptyState`
- **Description**: Empty view prompt container featuring an icon box styled with `chip-saffron`, title, description, and step cards to guide users when no content exists.
- **Props**:
  - `icon`: `LucideIcon`
  - `title`: `string`
  - `description`: `string`
  - `steps`: `string[]`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### FilterBar

- **Framework System**: React web component
- **Source File**: [FilterBar.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/FilterBar.tsx)
- **Export**: `default export FilterBar`
- **Description**: Accessible section container (`<section aria-labelledby>`) providing a shared responsive control grid for list filters.
- **Props**:
  - `label`: `string`
  - `children`: `ReactNode`
  - `actions?`: `ReactNode`
  - `busy?`: `boolean`
  - `className?`: `string`
  - `controlsClassName?`: `string`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### ImagePicker

- **Framework System**: React web component
- **Source File**: [ImagePicker.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ImagePicker.tsx)
- **Export**: `default export ImagePicker`
- **Description**: Form control for selecting, previewing, replacing, and removing single image files with client-side blob URL cleanup and size limits.
- **Props**:
  - `label`: `string`
  - `currentUrl?`: `string | null`
  - `maxSizeMb`: `number`
  - `onFile`: `(file: File | null) => void`
  - `onRemove?`: `() => void`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### ImagePreviewDialog

- **Framework System**: React web component
- **Source File**: [ImagePreviewDialog.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ImagePreviewDialog.tsx)
- **Export**: `default export ImagePreviewDialog`
- **Description**: Reusable full-size preview dialog for managed images and payment QR codes, built on `Modal` (`size="lg"`, `closeOnClickOutside`). Preserves aspect ratio via `object-contain`, shows a loading spinner and a resilient error state with retry. For signed/expiring QR URLs (`isSignedUrl`), auto-retries once via `onRetry` (re-running the caller's existing data fetch to obtain a fresh signed URL) before falling back to a manual-retry terminal error state; for non-expiring public-bucket images, retry simply remounts the same URL.
- **Props**:
  - `open`: `boolean`
  - `onClose`: `() => void`
  - `src`: `string | null | undefined`
  - `title`: `string`
  - `alt`: `string`
  - `onRetry?`: `() => void | Promise<void>`
  - `isSignedUrl?`: `boolean`
  - `imageClassName?`: `string`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### LocaleToggle

- **Framework System**: React web component
- **Source File**: [LocaleToggle.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/LocaleToggle.tsx)
- **Export**: `default export LocaleToggle`
- **Description**: Header dropdown control wrapper around `Dropdown` for selecting application language (`en` / `vi`).
- **Props**:
  - `locale`: `Locale`
  - `setLocale`: `(locale: Locale) => void`
  - `label?`: `string`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### Modal

- **Framework System**: React web component
- **Source File**: [Modal.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/Modal.tsx)
- **Export**: `default export Modal`
- **Description**: General-purpose accessible modal dialog container rendered into `document.body` via `createPortal`. Includes `.overlay-backdrop`, focus management, Escape key listener, body scroll lock, header close button, and inner `ScrollArea`.
- **Props**:
  - `open`: `boolean`
  - `title`: `string`
  - `children`: `ReactNode`
  - `onClose`: `() => void`
  - `size?`: `'md' | 'lg'` (default: `'md'`)
- **Equivalent in Other Frameworks**: N/A in repository.

---

### ScrollArea

- **Framework System**: React web component
- **Source File**: [ScrollArea.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ScrollArea.tsx)
- **Export**: `default export ScrollArea`
- **Description**: Canonical scroll container component applying `.scroll-area` CSS custom scrollbars and touch-overscroll behaviors across `x`, `y`, or `both` axes.
- **Props**:
  - `children`: `ReactNode`
  - `className?`: `string`
  - `contentClassName?`: `string`
  - `axis?`: `'x' | 'y' | 'both'` (default: `'y'`)
  - `style?`: `CSSProperties`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### SectionTitle

- **Framework System**: React web component
- **Source File**: [SectionTitle.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/SectionTitle.tsx)
- **Export**: `default export SectionTitle`
- **Description**: Styled title (`<h2 className="text-xl font-bold">`) and subtitle block.
- **Props**:
  - `title`: `string`
  - `subtitle?`: `string`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### StatCard

- **Framework System**: React web component
- **Source File**: [StatCard.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/StatCard.tsx)
- **Export**: `default export StatCard`
- **Description**: Statistics category spend card displaying spend amounts and progress bar indicators filled with canonical `bg-basil`.
- **Props**:
  - `title`: `string`
  - `data`: `Record<string, number>`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### SummaryLine

- **Framework System**: React web component
- **Source File**: [SummaryLine.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/SummaryLine.tsx)
- **Export**: `default export SummaryLine`
- **Description**: Key-value summary row displaying formatted values (`text-compact font-semibold`) with optional green highlight (`tone="success"` using `text-basil`).
- **Props**:
  - `label`: `string`
  - `value`: `string`
  - `tone?`: `'success'`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### ThemeToggle

- **Framework System**: React web component
- **Source File**: [ThemeToggle.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ThemeToggle.tsx)
- **Export**: `default export ThemeToggle`
- **Description**: Header dropdown control wrapper around `Dropdown` for selecting application theme (`light`, `dark`, `system`).
- **Props**:
  - `theme`: `Theme`
  - `setTheme`: `(theme: Theme) => void`
  - `label?`: `string`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### ToastHost

- **Framework System**: React web component
- **Source File**: [ToastHost.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/ui/ToastHost.tsx)
- **Export**: `default export ToastHost`
- **Description**: Global toast container wrapping `react-hot-toast` `Toaster` with theme awareness and viewport-sensitive positioning (`top-center` on mobile, `top-right` on desktop).
- **Props**: None.
- **Equivalent in Other Frameworks**: N/A in repository.

---

## 2. Layout Components (`apps/web/src/components/layout/`)

### AppHeader

- **Framework System**: React web component
- **Source File**: [AppHeader.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/layout/AppHeader.tsx)
- **Export**: `default export AppHeader`
- **Description**: Fixed header bar providing brand identity, unread notification panel popover, language/theme selectors, and user profile action menu.
- **Props**:
  - `onProfile?`: `() => void`
  - `notifications?`: `Notification[]`
  - `onOpenNotification?`: `(notification: Notification) => void`
  - `onMarkAllNotificationsRead?`: `() => void`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### MobileNav

- **Framework System**: React web component
- **Source File**: [MobileNav.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/layout/MobileNav.tsx)
- **Export**: `default export MobileNav`
- **Description**: Mobile-only, horizontally scrollable navigation strip that renders every role-authorized route and keeps the active route visible.
- **Props**:
  - `nav`: `readonly NavigationItem[]`
  - `label`: `string`
- **Equivalent in Other Frameworks**: N/A in repository.

---

### Sidebar

- **Framework System**: React web component
- **Source File**: [Sidebar.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/components/layout/Sidebar.tsx)
- **Export**: `default export Sidebar`
- **Description**: Expandable desktop-only sidebar navigation.
- **Props**:
  - `nav`: `readonly NavigationItem[]`
  - `collapsed`: `boolean`
  - `onToggle`: `() => void`
- **Equivalent in Other Frameworks**: N/A in repository.

---

## 3. Feature UI Controls (`apps/web/src/features/`)

### VietnamAddressFields

- **Framework System**: React web component
- **Source File**: [VietnamAddressFields.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/address/VietnamAddressFields.tsx)
- **Export**: `default export VietnamAddressFields`, `emptyVietnamAddress`, `isVietnamAddressComplete`
- **Description**: Structured or manual location field set for Vietnamese addresses (provinces, wards, address lines) integrated with address directory queries.

### PlatformLinksEditor

- **Framework System**: React web component
- **Source File**: [PlatformLinksEditor.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/restaurants/PlatformLinksEditor.tsx)
- **Export**: `default export PlatformLinksEditor`, `platformLabel`, `arePlatformLinksValid`
- **Description**: Interactive list editor for reordering, adding, and validating external restaurant delivery platform links (Grab, ShopeeFood, Gojek, Website, etc.).

### RestaurantBanner

- **Framework System**: React web component
- **Source File**: [RestaurantBanner.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/restaurants/RestaurantBanner.tsx)
- **Export**: `default export RestaurantBanner`
- **Description**: Cover banner component with gradient background fallback, logo thumbnail, and optional overlay slot.

### RestaurantCatalogFields

- **Framework System**: React web component
- **Source File**: [RestaurantCatalogFields.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/restaurants/RestaurantCatalogFields.tsx)
- **Export**: `default export RestaurantCatalogFields`, `emptyRestaurantCatalogs`
- **Description**: Form section containing cuisine multi-select picker, primary cuisine selector, and optional dining area picker.

### RestaurantFeedback

- **Framework System**: React web component
- **Source File**: [RestaurantFeedback.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/restaurants/RestaurantFeedback.tsx)
- **Export**: `default export RestaurantFeedback`
- **Description**: Restaurant food and service rating overview, bill feedback form, and community review list component.

### RestaurantProfileFields

- **Framework System**: React web component
- **Source File**: [RestaurantProfileFields.tsx](file:///c:/Vault/Project/management-platform/ff-restaurent/apps/web/src/features/restaurants/RestaurantProfileFields.tsx)
- **Export**: `default export RestaurantProfileFields`, `emptyRestaurantProfile`, `isRestaurantProfileValid`
- **Description**: Restaurant profile form section containing E.164 phone validation input and platform links editor.
