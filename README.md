# FF RESTaurent

Web-first group bill-splitting and restaurant tracker for a single shared group.

## Stack

- React + TypeScript + Vite + Tailwind CSS
- Fastify + TypeScript API with JWT auth and Swagger at `/api/docs`
- PostgreSQL + Prisma schema, migration, and seed data
- Shared TypeScript package for enums, DTO-shaped types, and bill-splitting math
- Docker Compose for Postgres, API, and static web frontend

## Run locally with Docker

```bash
docker compose up --build
```

Then open:

- Web: http://localhost:5173
- API health: http://localhost:4000/health
- API docs: http://localhost:4000/api/docs

The first API start seeds demo data if the database is empty.

Demo logins, all using `password123`:

- `customer` (Casey Customer)
- `sous` (Sam Sous Chef)
- `head` (Hana Head Chef)

## Run locally without Docker

```bash
npm install
cp .env.example .env
npm run build -w @ff-restaurent/shared
npm run prisma:migrate -w @ff-restaurent/api
npm run prisma:seed -w @ff-restaurent/api
npm run dev -w @ff-restaurent/api
npm run dev -w @ff-restaurent/web
```

Use a local `DATABASE_URL` in `.env` before running Prisma commands.

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
