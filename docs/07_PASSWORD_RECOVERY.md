# Password recovery operations

Password recovery is deliberately assisted by the singleton `ROOT_ADMIN`; the
application does not send SMS or email.

## Member flow

1. On the sign-in page, submit a username or Vietnamese mobile number.
2. The API always returns the same `202` response, whether or not the account
   exists.
3. After verifying the requester outside the application, the Root Admin opens
   **Members → Password reset requests** and issues a code.
4. The eight-character code is displayed once. It expires after 15 minutes,
   locks after five failed attempts, and can be consumed only once.
5. A successful reset increments the user's session version and invalidates all
   existing sessions. The member signs in with the new password.

Submitting another request supersedes the user's previous active request and
code. Reset-code hashes are the only code material stored in PostgreSQL.

## Root Admin recovery

The Root Admin cannot approve their own forgotten-password request. An operator
with production shell and database access must use the existing interactive,
hidden-input recovery command:

```bash
npm run prisma:root:recover -w @ff-restaurent/api
```

The command resets only the sole database Root Admin and invalidates that
account's existing sessions.
