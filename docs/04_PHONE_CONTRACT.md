# Phone Number Contract

FF RESTaurent stores optional phone numbers in canonical E.164 form. Version
1.1.0 initially applies this contract to user accounts; restaurant phones added
by FF-34 must reuse the same shared parser.

## Accepted input

- The number must be a valid Vietnamese mobile number.
- Local form such as `0901234567` and international form such as
  `+84901234567` are accepted.
- Common spaces and separators accepted by `libphonenumber-js` are normalized.
- Empty optional input is stored as `null`.

The API is authoritative. The web uses the same shared parser only to provide
immediate localized field feedback.

## Persistence and lookup

- Persist only E.164, for example `+84901234567`.
- Uniqueness is checked after normalization.
- Authentication resolves an exact username before interpreting an identifier
  as a phone number.
- API responses expose only the canonical value or `null`.

## Existing data

Application startup runs the idempotent `prisma:phones:backfill` command after
Prisma migrations and before Node starts. The preflight aborts deployment when
it finds invalid values or two raw values that normalize to the same phone. Its
diagnostic output includes user IDs and masked phone values only.

Operators can run the same check/backfill explicitly:

```bash
npm run prisma:phones:backfill -w @ff-restaurent/api
```
