# FF-27 Optimization Evidence

## Query coverage

The final Phase 2 route audit found four common query shapes without a supporting
leading index:

| Query shape                     | Before                          | FF-27 index                                |
| ------------------------------- | ------------------------------- | ------------------------------------------ |
| User notification timeline      | No covering order index         | `Notification_userId_createdAt_id_idx`     |
| Bulk unread notification update | No user/read-state index        | `Notification_userId_readAt_idx`           |
| Bill reminder cooldown lookup   | No bill/user/time index         | `Notification_billId_userId_createdAt_idx` |
| Bill activity relation lookup   | No bill audit foreign-key index | `BillAuditLog_billId_createdAt_id_idx`     |

`npm run prisma:indexes:verify -w @ff-restaurent/api` checks that all four
indexes exist and uses PostgreSQL `EXPLAIN` with sequential scans disabled to
verify that every representative query can use its intended index. CI runs the
check immediately after migrations. Coverage changes from 0/4 explicitly
supported final query shapes to 4/4.

## Web delivery

Measured with the production Vite build and `npm run measure:web`.

| Artifact                         |               Before FF-27 |               After FF-27 |
| -------------------------------- | -------------------------: | ------------------------: |
| Application entry                | 434.92 kB / 134.57 kB gzip | 136.34 kB / 38.46 kB gzip |
| Stable React/router vendor chunk |          Included in entry | 286.63 kB / 92.03 kB gzip |
| Stable toast vendor chunk        |          Included in entry |   11.91 kB / 4.78 kB gzip |
| Stats route                      |   61.04 kB / 16.77 kB gzip |  61.12 kB / 16.81 kB gzip |
| Recharts dependency              |  326.80 kB / 97.80 kB gzip | 326.84 kB / 97.82 kB gzip |
| Phone parsing dependency         |  134.75 kB / 34.00 kB gzip | 134.75 kB / 34.00 kB gzip |

The application entry is 68.7% smaller raw and 71.4% smaller gzip. First-load
React bytes remain comparable because the vendor chunk is still required, but
application deployments can now reuse a stable cached React/router artifact.
Stats/Recharts and phone parsing remain isolated from the entry path, and all
page components remain route-lazy.

The final build contains 30 JavaScript chunks and totals 1,116,020 bytes raw /
333,584 bytes gzip across all emitted files. A module service worker adds
runtime app-shell delivery with these strict boundaries:

- Network-first navigation with the static application shell as the offline
  fallback.
- Cache-first same-origin scripts, styles, images, and fonts.
- Network-only API/fetch traffic, mutations, and cross-origin requests.

The cache-policy tests explicitly cover same-origin static/navigation traffic
and ensure authenticated same-origin API paths such as `/bills` are not
intercepted.
