# FF RESTaurent

Web-first group bill-splitting and restaurant tracker for a single shared group.

## Stack

- React + React Router 7 + TypeScript + Vite + Tailwind CSS
- Fastify + TypeScript API with JWT auth and Swagger at `/api/docs`
- PostgreSQL + Prisma schema, migration, and seed data
- Shared TypeScript package for enums, DTO-shaped types, and bill-splitting math (Vite resolves `@ff-restaurent/shared` to source during web development, but API/root production builds require compiled output)
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

Use this path when you want to run the API and Vite dev servers directly. The root `.env.example` is the canonical environment contract. No app-local `.env` files are required or supported.

Start a PostgreSQL 16-compatible database first, then copy `.env.example` to `.env` at the project root and ensure it has a host URL reachable from your machine:

```env
DATABASE_URL=postgresql://ff:ff@localhost:5432/ff_restaurent?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
CORS_ORIGINS=http://localhost:5173
REGISTRATION_INVITE_CODE=replace-with-a-private-group-invite
ROOT_ADMIN_USERNAME=replace-with-an-existing-username
API_PORT=4000
VITE_API_URL=http://localhost:4000
```

```bash
npm install
npm run build -w @ff-restaurent/shared

# Reset local database
npx prisma migrate reset --schema apps/api/prisma/schema.prisma --force

# Run migrate database
npm run prisma:migrate -w @ff-restaurent/api
npm run prisma:seed -w @ff-restaurent/api
```

The demo seed also loads the popular Vietnamese cuisine catalog. To add only
that catalog without resetting application data, run:

```bash
npm run prisma:cuisines:seed -w @ff-restaurent/api
```

This command is idempotent: it inserts missing normalized cuisine names and
does not update or delete existing catalog entries. API container deployments
run it automatically after Prisma migrations and before the API starts.

Run the API and web app in separate terminals:

```bash
npm run dev -w @ff-restaurent/api
```

```bash
npm run dev -w @ff-restaurent/web
```

Open the same local URLs listed above.

### Google Cloud Storage setup

Image uploads are mediated by the API using Google Cloud Application Default
Credentials. The runtime identity needs `roles/storage.objectUser` on both
buckets and `roles/iam.serviceAccountTokenCreator` on itself so it can sign
private payment-QR URLs.

Create two uniform-access buckets:

- A public image bucket with `allUsers` granted
  `roles/storage.objectViewer`. It stores user avatars and restaurant
  logos/banners.
- A private payment-QR bucket with public access prevention enabled. The API
  serves its objects through short-lived V4 signed URLs.

Set `GCP_PROJECT_ID`, `GCS_PUBLIC_BUCKET`, `GCS_QR_BUCKET`, and optionally
`GCS_SIGNED_URL_TTL_SECONDS` (default `900`). The backend validates file
signatures in addition to bucket IAM. Without bucket variables the rest of the
app remains available, while media endpoints return
`STORAGE_NOT_CONFIGURED`.

For the one-time Supabase cutover, freeze media writes and run
`npm run storage:migrate:gcs -w @ff-restaurent/api -- --plan`, then `--apply`
with the legacy `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_PUBLIC_BUCKET`, and `SUPABASE_QR_BUCKET` available only to the
operator process. Run `--verify` before removing the legacy credentials. The
script copies only database-referenced objects, verifies their content, and
rewrites managed public image URLs; external image URLs are left untouched.

### Vietnam address directory

The API bundles the complete 34-province, 3,321-ward directory effective July
1, 2025. Address pickers use the authenticated `/address/provinces` and
`/address/provinces/:provinceCode/wards` endpoints without contacting an
external province service. Existing numeric address snapshots are preserved
and remapped by province and ward name when edited.

## Verification

```bash
npm run prettier:check
npm run typecheck
npm test
npm run build
```

The highest-risk bill math lives in `packages/shared/src/bill-splitting.ts` and is covered by Vitest tests for even splits, explicit origin costs, percentage discounts, and validation. The API intentionally uses `node:test` for its test runner, while the web and shared packages use Vitest.

## Key Features & Permissions

- **i18n & Theme Support**: Multi-language interface (Vietnamese default, English toggle) and customizable theme options (Light, Dark, System mode).
- **Personalized Stats**: Interactive visualization of spending habits via Recharts (including payment status, cuisine breakdown, monthly trends, and restaurant frequency).
- **Favorites**: Per-user favorites junction table allowing users to save their go-to eateries.
- **CUSTOMER**: View participant bills, mark their own share paid, view personal stats, and filter bills by payment status.
- **SOUS_CHEF**: Create bills, edit bills, send payment reminders, create/edit restaurant entries, and recommend eateries.
- **HEAD_CHEF**: View all bills (including archived) and archive/restore bills and restaurants.
- **ROOT_ADMIN**: Inherits Head Chef permissions and exclusively manages member roles and system administration.

All money values are stored and calculated as integer amounts (using VND as the default currency).
