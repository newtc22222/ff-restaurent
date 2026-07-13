# FF RESTaurent Design System

## Visual Tokens

- Background: warm off-white `#faf8f5`.
- Surface: white cards/panels with `border-border` and subtle shadow.
- Ink: dark navy `ink` / `#0f1729` for primary text and primary buttons.
- Saffron: `#e9900c` for brand icon and active/waiting accent.
- Success: emerald shades for paid/settled states.
- Muted text: slate 500; secondary borders: `border` / `#e1e7ef`.

## Shape and Density

- Use 8-12px radii; cards may use `rounded-xl`, fields/buttons use `rounded-md`.
- Keep operational screens dense and scannable.
- Use centered max-width panels for detail and create flows (`max-w-2xl` or `max-w-xl`).
- Avoid nested cards unless representing rows inside a detail panel.

## Dropdowns and Pickers

- Use `apps/web/src/components/ui/Dropdown.tsx` for single selects, multi-selects, filters, header controls, and searchable pickers.
- Choose the `header`, `filter`, or `field` variant instead of styling a new trigger.
- Enable `searchable` for Restaurant/Eatery, Member, Cuisine, and any option set expected to grow. Supply localized search, empty, and clear text.
- Preserve selected values while filtering, reset the query when the menu closes, and keep long option lists internally scrollable.
- Use option `description` and `searchText` for secondary searchable metadata such as cuisine, restaurant type, or username.
- Keep panels on `bg-surface`, `border-border`, `text-ink`, and `bg-muted` interaction tokens so light and dark themes remain aligned.
- When replacing a native required select, enforce required state in form readiness because custom dropdown buttons do not participate in native select validation.
- Do not create page-specific select popovers unless `Dropdown` cannot represent the required behavior; extend the shared component when the behavior is broadly reusable.

## App Shell

- Header: white, 56px tall, brand icon, app name, current user/role, sign out.
- Desktop nav: left sidebar, white surface, active item dark ink.
- Mobile nav: horizontal scroll strip below header. Do not squeeze all items into fixed equal columns.

## Bills Dashboard

- Page width: `max-w-2xl`.
- Header row: `Bills` plus primary `Create bill` when role allows.
- Filters: compact dropdown buttons for restaurant and member filters; active filter buttons invert to dark ink.
- Bill card structure:
  - Restaurant name, type/cuisine/creator metadata.
  - Total amount and active/settled status on the right.
  - Paid count and percentage progress bar.
  - Member chips showing first name and final amount; green for paid, amber for waiting.
  - Primary full-width `View detail`; secondary `Remind` and `Archive` for managers.

## Bill Detail

- Use a top back link and a centered detail column.
- Summary card: restaurant name, metadata, total, status, paid progress.
- Member breakdown panel:
  - Header labels `Member breakdown` and `Amount / Status`.
  - Avatar initials, member name, base/VAT/shipping line.
  - Final amount, paid/waiting badge, `Mark paid` button where allowed.
- Bottom actions: equal-width `Send reminders` and `Archive bill` for managers.

## Create Bill

- Use one centered form card.
- Inputs:
  - Restaurant select full width.
  - VAT, shipping, discount in a three-column row on desktop.
  - Participant rows with name, base input, and remove control.
  - Add-member chips below the participant list.
- Show a live summary when there are participants or non-zero totals.
- Submit button is full width and dark ink; success state may turn emerald.

## Responsive Rules

- Test at desktop around 1280px wide and mobile around 390px wide.
- Let nav scroll horizontally on mobile.
- Cards must not require horizontal scrolling.
- Detail rows may stack on mobile, but action buttons should remain reachable and not overlap.
