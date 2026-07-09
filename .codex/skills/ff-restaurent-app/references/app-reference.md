# FF RESTaurent Reference

## Project Shape

- `apps/web`: React 19, Vite, Tailwind CSS, lucide-react. API client and DTO-shaped types live in `src/api.ts`; main UI currently lives in `src/App.tsx`.
- `apps/api`: Fastify API with JWT auth, Prisma/PostgreSQL persistence, Swagger at `/api/docs`.
- `packages/shared`: enums, DTO-shaped types, and bill-splitting math reused by API.

## Domain Model

Core Prisma models:

- `User`: email, name, password hash, optional `chefRole`.
- `RestaurantEntry`: name, address, cuisine type, custom type label, favorite/recommended flags, active/archive status.
- `Bill`: restaurant, base/vat/shipping cents, discounts/vouchers JSON, total cost cents, active/archive status, creator.
- `BillParticipant`: composite key `(billId, memberId)`, origin/vat/shipping/discount/final cents, `PAID` or `WAITING`.
- `Notification`: user-scoped reminder messages.
- `RoleAuditLog` and `BillAuditLog`: administrative history.

## Roles and Permissions

- `chefRole` is nullable. Sanitized users expose `roles: ['CUSTOMER', chefRole?]`.
- `SOUS_CHEF` and `HEAD_CHEF` can create restaurants and bills.
- Bill management is allowed for the bill creator or any `HEAD_CHEF`.
- `HEAD_CHEF` can list all users, change chef roles, view archived/all bills, and archive/restore restaurants.
- Customers can only see bills they participate in and can mark their own payment paid unless a manager performs it.

## API Routes

- `POST /auth/login`, `POST /auth/register`, `GET /me`
- `GET /members`; `GET /users` and `PATCH /users/:id/chef-role` require `HEAD_CHEF`
- `GET /restaurants`, `POST /restaurants`, `PUT /restaurants/:id`, `PATCH /restaurants/:id/archive`, `PATCH /restaurants/:id/restore`
- `GET /bills`, `GET /bills/:id`, `POST /bills`, `PUT /bills/:id`, `PATCH /bills/:id/archive`
- `PATCH /bills/:id/participants/:memberId/pay`
- `POST /bills/:id/reminders`
- `GET /notifications`, `PATCH /notifications/:id/read`
- `GET /stats/me?range=weekly|monthly|yearly`

## Bill Math

All money values are integer cents. `calculateBillSplit`:

- Requires at least two unique participants.
- Sorts participant IDs for deterministic remainder assignment.
- Splits base evenly unless every participant has `originCostCents`.
- Requires explicit participant origins to sum exactly to `baseCostCents`.
- Splits VAT, shipping, discounts, and vouchers deterministically in cents.
- Throws when adjustments cannot reconcile to the bill total.

Update `packages/shared/src/bill-splitting.test.ts` for changes to these rules.

## Environment Notes

The checked-in `.env` may target Docker host `postgres`. For non-Docker local API work, set a host-reachable `DATABASE_URL` before Prisma commands.

The first Docker API start seeds demo data if the database is empty. Demo accounts:

- `customer@ff.test`
- `sous@ff.test`
- `head@ff.test`

Password: `password123`.
