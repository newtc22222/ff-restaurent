# FF RESTaurent

Web-first group bill-splitting and restaurant tracker for a single shared group.

## Stack

- React + TypeScript + Vite + Tailwind CSS
- Fastify + TypeScript API with JWT auth and Swagger at `/api/docs`
- PostgreSQL + Prisma schema, migration, and seed data
- Shared TypeScript package for enums, DTO-shaped types, and bill-splitting math
- Docker Compose for Postgres, API, and static web frontend

## Run locally

### Docker Compose

Use Docker Compose for the fastest full-stack setup. It starts PostgreSQL, runs
API migrations, seeds demo data when the database is empty, and serves the web
app.

```bash
docker compose up --build
```

No `.env` file is required for local Docker usage. The Compose file defaults to
development settings. If you provide overrides, keep `NODE_ENV=development`
locally so demo seeding remains enabled.

Then open:

- Web: http://localhost:5173
- API health: http://localhost:4000/health
- API docs: http://localhost:4000/api/docs

Demo logins, all using `password123`:

- `customer` (Casey Customer)
- `sous` (Sam Sous Chef)
- `head` (Hana Head Chef)

### Manual npm setup

Use this path when you want to run the API and Vite dev servers directly. Start
a PostgreSQL 16-compatible database first, then create `.env` with a host URL
reachable from your machine:

```env
DATABASE_URL=postgresql://ff:ff@localhost:5432/ff_restaurent?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
CORS_ORIGINS=http://localhost:5173
REGISTRATION_INVITE_CODE=replace-with-a-private-group-invite
API_PORT=4000
VITE_API_URL=http://localhost:4000
```

```bash
npm install
npm run build -w @ff-restaurent/shared
npm run prisma:migrate -w @ff-restaurent/api
npm run prisma:seed -w @ff-restaurent/api
```

Run the API and web app in separate terminals:

```bash
npm run dev -w @ff-restaurent/api
```

```bash
npm run dev -w @ff-restaurent/web
```

Open the same local URLs listed above.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The highest-risk bill math lives in `packages/shared/src/bill-splitting.ts` and is covered by Vitest tests for even splits, explicit origin costs, percentage discounts, and validation.

## Key Features & Permissions

- **i18n & Theme Support**: Multi-language interface (Vietnamese default, English toggle) and customizable theme options (Light, Dark, System mode).
- **Personalized Stats**: Interactive visualization of spending habits via Recharts (including payment status, cuisine breakdown, monthly trends, and restaurant frequency).
- **Favorites**: Per-user favorites junction table allowing users to save their go-to eateries.
- **CUSTOMER**: View participant bills, mark their own share paid, view personal stats, and filter bills by payment status.
- **SOUS_CHEF**: Create bills, edit bills, send payment reminders, create/edit restaurant entries, and recommend eateries.
- **HEAD_CHEF**: View all bills (including archived), archive/restore bills and restaurants, and manage member roles.

All money values are stored and calculated as integer amounts (using VND as the default currency).
