# App Spec: Group Bill-Splitting & Restaurant Tracker

## 1. Overview

Build a web app (mobile to follow later) that helps a single group manage shared bills from restaurants/eateries — splitting cost fairly among members, tracking who has paid, and surfacing spending statistics. The app has three roles with cumulative permissions (higher roles inherit all lower-role capabilities). App name: FF RESTaurent

## 2. Roles & Permissions

Every user always has the **CUSTOMER** role as a baseline, and may additionally hold **exactly one** of the two "chef" roles:

| Combination                      | Valid?                  |
| -------------------------------- | ----------------------- |
| CUSTOMER only                    | ✅                      |
| CUSTOMER + SOUS_CHEF             | ✅                      |
| CUSTOMER + HEAD_CHEF             | ✅                      |
| CUSTOMER + SOUS_CHEF + HEAD_CHEF | ❌ (mutually exclusive) |

Permission hierarchy: `HEAD_CHEF ⊃ SOUS_CHEF ⊃ CUSTOMER`

### CUSTOMER

- Mark a bill (or their share of it) as paid
- View bills they're a participant in
- View personal statistics: spending by payment status, by food/cuisine type, by restaurant, by eatery

### SOUS_CHEF (also has all CUSTOMER features)

- Create, edit, view, and archive bills they own
- View payment status of all members on their bills (paid / waiting)
- Send payment reminders to members who haven't paid
- Create, edit, and mark restaurants/eateries as recommended or favorite

### HEAD_CHEF (also has all SOUS_CHEF features)

- View all bills across the system (not just their own)
- View full bill history (including archived)
- Archive any restaurant or eatery
- Grant or change roles for other members

## 3. Data Model

### Bill

| Field                         | Description                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `id`                          | Unique identifier                                                            |
| `restaurant_id` / `eatery_id` | Where the order was placed                                                   |
| `base_cost`                   | Sum of item costs before adjustments                                         |
| `vat`                         | VAT amount or percentage (specify which)                                     |
| `shipping_fee`                | Delivery/shipping cost                                                       |
| `discounts[]`                 | List of discounts, each with a type (percentage/fixed) and value             |
| `vouchers[]`                  | List of vouchers applied (each with code + value) — a bill can have multiple |
| `total_cost`                  | Computed: `base_cost + vat + shipping_fee − sum(discounts) − sum(vouchers)`  |
| `created_by`                  | SOUS_CHEF or HEAD_CHEF who created it                                        |
| `status`                      | active / archived                                                            |
| `participants[]`              | List of members with their split (see below)                                 |

### BillParticipant (per member, per bill)

| Field                | Description                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `member_id`          | Reference to user                                                                                   |
| `origin_cost`        | This member's share of `base_cost` (even split across participants)                                 |
| `allocated_vat`      | This member's even share of the bill's total VAT                                                    |
| `allocated_shipping` | This member's even share of the bill's total shipping fee                                           |
| `discount_applied`   | This member's even share of the combined total of all discounts + vouchers                          |
| `final_price`        | `origin_cost + allocated_vat + allocated_shipping − discount_applied` — the amount this member owes |
| `payment_status`     | paid / waiting                                                                                      |
| `paid_at`            | Timestamp when marked paid                                                                          |

### Restaurant / Eatery

| Field                                   | Description                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `name`, `address`, `cuisine_type` |
| `type`                                  | e.g. `RESTAURANT` or `EATERY` — **user-defined per entry**, not a fixed system rule. The app treats both as the same underlying entity/table with a `type` label the SOUS_CHEF/HEAD_CHEF assigns when creating it (e.g., "Restaurant" = a physical dine-in venue, "Eatery" = a delivery-only vendor/stall — but this categorization is left to the user creating the entry, not hardcoded logic) |
| `is_recommended`, `is_favorite`         |
| `status`                                | active / archived — **archived entries can be un-archived (restored) by HEAD_CHEF**                                                                                                                                                                                                                                                                                                              |

## 4. Bill-Splitting Logic

1. **Origin cost per member** = their portion of `base_cost` (e.g., itemized, or split evenly across 2+ members).
2. **VAT and shipping fee allocation**: split **evenly** across all participants — `allocated_vat = vat / participant_count`, `allocated_shipping = shipping_fee / participant_count`, regardless of each member's origin cost.
3. **Discounts and vouchers allocation**: split **evenly** across all participants as well — sum all discounts and all vouchers first, then divide the total evenly by participant count.
4. **Final price per member** = `origin_cost + allocated_vat + allocated_shipping − allocated_discounts − allocated_vouchers`.
5. **Rounding rule**: since `vat`, `shipping_fee`, discounts, and vouchers are stored in cents/`Decimal` and split evenly, an even division may leave a remainder (e.g., splitting $10.01 three ways). Define a deterministic rule — e.g., the remainder (in the smallest currency unit) is added to the bill creator's share, or distributed one cent at a time to the first N participants in a fixed order — so totals always reconcile exactly to the bill total with no floating-point drift.

## 5. Statistics (for CUSTOMER and above)

Views should support filtering/grouping by:

- Payment status (paid vs. waiting), over time
- Food/cuisine type
- Restaurant / Eatery (grouped by whichever `type` label the user assigned)
- Time range (weekly/monthly/yearly spend)

## 6. Additional Features to Consider

- **Notifications**: in-app reminder (notifications table + bell/badge UI) when SOUS_CHEF/HEAD_CHEF sends a payment reminder — no email/push/SMS needed.
- **Role management**: HEAD_CHEF grants/revokes SOUS_CHEF or HEAD_CHEF status for members; audit log of role changes.
- **Bill history/audit trail**: track edits to a bill after creation (who changed what, when).
- **Multi-currency support** (if relevant).
- **Search & filter** for bills and restaurants/eateries.

## 7. Tech Stack (open source, self-hostable)

| Layer            | Choice                                                                  | Why                                                                             |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Frontend         | React + TypeScript + Vite + Tailwind CSS + shadcn/ui                    | Widely supported, fast dev loop, no vendor lock-in                              |
| Backend          | Node.js + TypeScript, NestJS (or Fastify if you want something lighter) | Same language as frontend = easier for one dev/small team to maintain           |
| Database         | PostgreSQL                                                              | Open source, rock-solid for relational/financial data                           |
| ORM              | Prisma                                                                  | Type-safe queries, schema-as-code, built-in migrations                          |
| Auth             | JWT with refresh tokens (roll your own) or Lucia Auth                   | No paid third-party auth dependency                                             |
| API contract     | OpenAPI/Swagger auto-generated from code                                | Keeps frontend/backend in sync, self-documenting                                |
| Containerization | Docker + docker-compose                                                 | `docker compose up` should be enough to run the whole stack locally or on a VPS |
| CI               | GitHub Actions (lint + typecheck + test on every PR)                    | Free, standard, catches regressions early                                       |

**Money handling rule (non-negotiable):** store all monetary values as integers in the smallest currency unit (e.g., cents) or as `Decimal`/`numeric` in Postgres — never `float`/`double`. Bill-splitting math is the core feature; float rounding errors will silently corrupt totals.

## 8. Repo Structure (monorepo)

```
/apps
  /api        → NestJS backend (controllers, services, Prisma schema, migrations)
  /web        → React frontend
/packages
  /shared     → shared TypeScript types/enums (Role, PaymentStatus, DTOs) used by both apps
/docker-compose.yml
/README.md
```

Keeping request/response types in `packages/shared` prevents frontend and backend from drifting apart as the app grows — a common maintenance headache in split codebases.

## 9. Developer Experience / Maintainability Checklist

- **Linting/formatting**: ESLint + Prettier, enforced via a pre-commit hook (husky + lint-staged).
- **Migrations**: all schema changes go through Prisma Migrate — no manual SQL edits in production.
- **Seed script**: `prisma db seed` populating sample users (one of each role), restaurants/eateries, and a few bills with realistic splits — makes local dev and demos trivial.
- **Tests**: unit tests specifically for the bill-splitting calculation (origin cost, VAT/shipping allocation, discount/voucher allocation, rounding) since this is the highest-risk logic in the app; integration tests for auth/role permission boundaries.
- **API docs**: auto-generated Swagger UI at `/api/docs`.
- **Environment config**: single `.env.example` documenting every required variable (DB connection string, JWT secret, etc.); no secrets committed.
- **README**: must include one-command local setup (`docker compose up`), how to run migrations/seed, and how to run tests.

## 10. Deployment

- Ship a production `Dockerfile` for the API and a static build for the frontend (served via Nginx or a CDN-friendly static host).
- `docker-compose.yml` should bring up: Postgres, API, and web frontend together, so the whole stack is reproducible with one command on any VPS (e.g., a $5-6/mo box) — no proprietary PaaS required, though it can optionally also be deployed to Railway/Render/Fly.io if preferred later.
- Include a basic health-check endpoint (`/health`) for uptime monitoring.

## 11. Suggested Build Order (for the LLM doing the implementation)

Rather than generating everything at once, build and verify in this order — it produces cleaner, more reviewable output and catches issues early:

1. Prisma schema (users, roles, bills, participants, restaurants/eateries) + migrations + seed data
2. Bill-splitting calculation module, with unit tests, in isolation from the API
3. Auth + role-based permission guards
4. CRUD endpoints for bills/restaurants/eateries (respecting role permissions)
5. Statistics endpoints/queries
6. Frontend: auth flow → bill list/detail → create/edit bill → stats dashboard
7. Docker Compose wiring + README + CI pipeline

---

### Decisions (confirmed)

1. **VAT/shipping/discounts/vouchers**: split **evenly** across all participants, not proportionally.
2. **Restaurant vs. Eatery**: no fixed system distinction — both are one entity type with a `type` field the user assigns at creation time; the label's meaning is up to the user.
3. **Vouchers**: a bill can have **multiple** vouchers (stored as `vouchers[]`), same as discounts.
4. **Archiving**: restaurants/eateries (and bills) are soft-deleted via a `status` flag, and **HEAD_CHEF can restore (un-archive) them.**
5. **Platform**: **web app first** — build with React so a mobile app (React Native, reusing `packages/shared` types) can follow later without a rewrite.
6. **Multi-tenancy**: **single group only** — no need for multi-organization/workspace support. This simplifies the data model (no `organization_id`/tenant scoping needed on any table) and removes a whole layer of complexity from auth and queries.
7. **Notifications**: **in-app only** for payment reminders (e.g., a notifications table + bell icon/badge in the UI) — no email/push/SMS integration needed, which avoids adding SMTP/push-service dependencies.
