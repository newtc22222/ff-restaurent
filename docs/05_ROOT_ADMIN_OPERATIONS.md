# ROOT_ADMIN operations

FF RESTaurent has exactly one `ROOT_ADMIN`. The database `systemRole` value is
authoritative; `chefRole` remains independent for backward-compatible chef
assignments.

## Deployment bootstrap

Set `ROOT_ADMIN_USERNAME` to an existing username before the first deployment
of the root-admin migration. Container startup runs migrations, phone backfill,
and then:

```bash
npm run prisma:root:bootstrap -w @ff-restaurent/api
```

When a root already exists, bootstrap is idempotent and does not transfer the
role even if the environment variable changes. When no root exists, a missing
or unknown configured username stops startup. The initial promotion invalidates
that account's existing sessions so root access always starts with a fresh
login.

## In-app ownership transfer

The current root can transfer ownership to another existing user from Member
administration. Transfer requires the current root password and an exact repeat
of the target username. The transaction records an audit row, increments both
users' session versions, and sends the current root back to login.

## Operator recovery

If the sole root loses access, run the interactive command from an operator
terminal with production database access:

```bash
npm run prisma:root:recover -w @ff-restaurent/api
```

The command requires exact root-username confirmation and a new password twice.
It never prints the password or hash and invalidates every existing root
session. Do not expose this command through an HTTP endpoint or web UI.
