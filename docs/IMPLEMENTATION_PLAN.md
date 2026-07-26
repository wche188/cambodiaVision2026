# Cambodia Vision 2026 — Implementation Plan

> Snapshot after commit `bae57db`. This plan reflects the state of the codebase
> after the recent pre-deployment hardening pass. Items marked **Open** remain
> in the backlog and should be scheduled against the field-trip timeline.

---

## 1. Project Overview

Cambodia Vision 2026 is a patient management system for short-duration
medical mission trips in Cambodia. Volunteers register patients at intake,
station managers check patients in via QR code as they move through Doctor,
Optometry, Refraction, Glasses Dispensed, Ear Therapy, and Surgery
stations, surgeons record procedure data, and admins oversee users,
backups, and reporting. The app is a single Next.js 15 application that
runs over HTTPS (self-signed cert, required for browser camera access on
the LAN at the field site), persists to a local MySQL 8 database, and is
deployed to an Ubuntu 24.04 ARM server under PM2.

## 2. Architecture Summary

| Layer            | Technology                                                    |
| ---------------- | ------------------------------------------------------------- |
| Application      | Next.js 15.5.7 (App Router, React 19, Tailwind 4)             |
| Runtime          | Node.js 20.20.2, custom HTTPS server (`server.mjs`)           |
| Process manager  | PM2 (`ecosystem.config.cjs`, `max_memory_restart: 500M`)      |
| Database         | MySQL 8.0, single database `cambodia_vision`, mysql2 pool     |
| Auth             | `iron-session` 8.x — encrypted cookie, 8h idle, `sameSite: strict`, `secure: true` |
| Server           | Ubuntu 24.04 LTS aarch64 on Oracle Cloud free tier (`150.230.8.247`) |
| TLS              | Self-signed cert in `certs/`, SAN includes auto-detected LAN IP |
| Docs / forms     | `docxtemplater` over `.docx` templates in `public/templates/` |
| QR               | `qrcode` (generation), `html5-qrcode` (scanner), `jsPDF` (label export) |
| Tests            | `vitest` (`npm test`)                                         |

### Request flow

`browser -> https://:3000 -> server.mjs -> Next.js handler -> API route -> lib/mysql pool -> MySQL`.

Health and database-down paths return 503 via `withDb()` in
`lib/mysql.js`. Session is read on every authenticated request via
`getSession()` in `lib/session.js`.

## 3. Phased Roadmap

Each phase lists its top items, rough effort (S = ≤1 day, M = 2–3 days,
L = ≥1 week), risk, and acceptance criteria. Effort is per developer;
items in the same phase can be parallelised.

### Phase 0 — Pre-deployment blockers (must ship before `bae57db`)

Goal: make the fresh server boot, build, and serve traffic safely.

| # | Item                                                                     | Effort | Risk  | Status      |
| - | ------------------------------------------------------------------------ | ------ | ----- | ----------- |
| 1 | Align `db/init.sql` with code (schema drift fix)                        | S      | High  | Done (bae57db) |
| 2 | Update `.env.example` to call out `CHANGE_ME` placeholders explicitly    | S      | Medium| Done (bae57db) |
| 3 | PM2 `ecosystem.config.cjs` (autorestart, `max_memory_restart: 500M`)     | S      | Medium| Done (bae57db) |
| 4 | `server.mjs` LAN-IP detection + auto-cert SAN                            | S      | High  | Done (bae57db) |
| 5 | Cert SAN includes current LAN IP (`DNS:localhost,IP:<lan>,IP:127.0.0.1`) | S      | High  | Done (bae57db) |
| 6 | Install PM2 on server, `pm2 startup`, `pm2 save`                         | S      | Low   | Open (deploy step) |
| 7 | Generate strong `SESSION_SECRET` (`openssl rand -hex 32`)                | S      | High  | Open (deploy step) |

**Acceptance:** fresh Ubuntu 24.04 box, follow `DEPLOYMENT.md` end-to-end,
`https://<lan-ip>:3000` serves the registration page over a certificate
that browser-cameras trust, no warnings beyond the standard self-signed
prompt.

### Phase 1 — Field readiness

Goal: the system can survive a clinic day at a remote site.

| # | Item                                                                       | Effort | Risk  |
| - | -------------------------------------------------------------------------- | ------ | ----- |
| 1 | MySQL nightly `mysqldump` cron to `/var/backups/cambodia-vision/`          | S      | High  |
| 2 | LAN firewall rules (allow 3000 from LAN subnet only)                       | S      | Medium|
| 3 | Tablet/mobile device trust onboarding doc (accept cert once per device)    | S      | Low   |
| 4 | `app/api/health` endpoint verified                                         | S      | Low   |
| 5 | PM2 log rotation (`pm2-logrotate` or `logrotate.d`)                        | S      | Low   |

**Acceptance:** clinic-day dry run (5 devices, 1 admin, 6 station
managers, 50 patients) completes without manual server intervention.
Backup file exists and is non-empty after each night.

### Phase 2 — Correctness & transactions

Goal: no partial writes corrupt patient state on flaky clinic Wi-Fi.

| # | Item                                                                       | Effort | Risk  |
| - | -------------------------------------------------------------------------- | ------ | ----- |
| 1 | Wrap `gp_examinations` upsert in a transaction                             | S      | High  |
| 2 | Wrap `surgery_decisions` upsert in a transaction                           | S      | High  |
| 3 | Wrap `status` / `status_history` updates in a transaction                  | S      | High  |
| 4 | Wrap `surgery_records` insert in a transaction                             | S      | High  |
| 5 | Add a Vitest integration test that drives a partial-failure rollback       | M      | Medium|

**Status note:** the station endpoint already wraps its station
transition in a transaction as of `bae57db`. The four remaining
write paths above are **Open**.

**Acceptance:** killing the Node process mid-request leaves no orphan
rows in `patients`, `status_history`, `gp_examinations`,
`surgery_decisions`, or `surgery_records`. Verified by a fault-injection
test that asserts row counts before/after.

### Phase 3 — Authorization hardening

Goal: only the right roles touch the right endpoints.

| # | Item                                                                       | Effort | Risk  |
| - | -------------------------------------------------------------------------- | ------ | ----- |
| 1 | Audit every `/api/admin/*` handler for explicit role check                 | S      | High  |
| 2 | Add role check to the patient list endpoint                                | S      | High  |
| 3 | Reject station-manager access outside their assigned station               | S      | Medium|
| 4 | Remove leftover `.env.local` from production tree                          | S      | Medium|

**Status note:** admin role checks on the canonical admin handlers were
tightened in `bae57db`. The patient list endpoint role check and the
`.env.local` cleanup are **Open**.

**Acceptance:** a station-manager token cannot hit `/api/admin/users` or
list patients outside their station; CI or Vitest asserts this.

### Phase 4 — Schema & data integrity

Goal: the database defends itself.

| # | Item                                                                       | Effort | Risk  |
| - | -------------------------------------------------------------------------- | ------ | ----- |
| 1 | Add `CHECK` constraints for enums currently only enforced in app code      | M      | Medium|
| 2 | Add unique constraint `(patient_id, surgeon_id, eye, created_at)` surrogate on `surgery_records` | M | Medium|
| 3 | Add `FOREIGN KEY` on `gp_examinations.examined_by` if column exists        | S      | Low   |
| 4 | Migration script tool (`scripts/migrate.js`) for incremental changes       | M      | Medium|

**Acceptance:** running `init.sql` on a fresh DB and applying pending
migrations yields the same schema; FK violations surface as 500s, not
silent corruption.

### Phase 5 — Backup & disaster recovery

Goal: a hard drive failure on clinic day is recoverable.

| # | Item                                                                       | Effort | Risk  |
| - | -------------------------------------------------------------------------- | ------ | ----- |
| 1 | Streaming `mysqldump` via the admin backup endpoint                        | S      | High  |
| 2 | Encrypted off-site copy (rclone to S3-compatible bucket, or scp)           | M      | Medium|
| 3 | Weekly restore drill into a scratch database                               | S      | Low   |
| 4 | Documented RTO ≤ 30 min, RPO ≤ 24 h                                        | S      | Low   |

**Status note:** the backup endpoint was hardened in `bae57db` (auth,
confirm-password header, role check). Streaming (so very large dumps
do not load entirely into memory) is **Open**.

**Acceptance:** destroy the MySQL data dir, restore from the previous
night's backup, replay the day's `status_history` from the audit log,
resume clinic operations.

### Phase 6 — Architecture evolution

Goal: prepare for clinic scale (multiple sites, hundreds of patients/day).

| # | Item                                                                       | Effort | Risk  |
| - | -------------------------------------------------------------------------- | ------ | ----- |
| 1 | Replace `mysql2` pool with a single shared client + Drizzle/Kysely ORM     | L      | Medium|
| 2 | Move auth to NextAuth or a hardened iron-session wrapper with CSRF         | M      | Medium|
| 3 | Split read/write DB roles for reporting queries                           | M      | Low   |
| 4 | Replace `docxtemplater` server-side render with a queue/worker            | L      | Medium|

**Acceptance:** chosen ORM passes the same Vitest suite as the current
pool; p95 latency on `/api/patients` with 10 k rows stays under 200 ms.

### Phase 7 — UX & reporting

Goal: improve field usability and post-trip analysis.

| # | Item                                                                       | Effort | Risk  |
| - | -------------------------------------------------------------------------- | ------ | ----- |
| 1 | Khmer-language refinement pass (native-speaker review)                     | M      | Low   |
| 2 | Daily/weekly KPI dashboard on the admin home                               | M      | Low   |
| 3 | Offline-tolerant registration (IndexedDB queue, sync on reconnect)         | L      | Medium|
| 4 | PDF export of surgery records                                              | S      | Low   |

**Acceptance:** a non-technical volunteer can register a patient and
check them in to two stations without help; admins can produce a
per-surgeon surgery report on demand.

## 4. Critical Path & Dependencies

```
Phase 0  ──►  Phase 1  ──►  Phase 2  ──►  Phase 3  ──►  Phase 4
   │            │            │            │
   ▼            ▼            ▼            ▼
(field deploy)(backups)    (data safe)  (RBAC safe)
                                       │
                                       ▼
                                  Phase 5 (DR)
                                       │
                                       ▼
                                  Phase 6 (scale)
                                       │
                                       ▼
                                  Phase 7 (UX)
```

- **Phase 0 → 1:** backups cannot be tested until the app is up.
- **Phase 2 → 5:** DR restore drills need transactional writes so a
  restored DB does not contain orphan rows.
- **Phase 3 → 4:** schema-level constraints are easier to add once the
  role model is stable.
- **Phase 6 → 7:** UX improvements (offline-tolerant queue) require the
  ORM swap.

## 5. Status Snapshot at `bae57db`

### Completed in this commit

1. Schema drift between `db/init.sql` and code reconciled.
2. `.env.example` placeholders marked `CHANGE_ME` with explicit guidance
   for `SESSION_SECRET` generation.
3. `ecosystem.config.cjs` created with `autorestart` and
   `max_memory_restart: 500M`.
4. `server.mjs` now detects the LAN IP at startup and includes it in
   the self-signed cert SAN.
5. Admin handler role checks tightened.
6. Station transition endpoint wrapped in a transaction.
7. Admin backup endpoint hardened (auth + confirm-password header).

### Still open

1. Transactions on `gp_examinations`, `surgery_decisions`,
   `status_history`, and `surgery_records` write paths.
2. Remove `.env.local` from production tree (use `.env.production`).
3. Role check on the patient list endpoint.
4. Streaming response for the admin backup endpoint to avoid loading
   very large dumps entirely in memory.
5. PM2 install + `pm2 startup` + `pm2 save` on the production host.
6. Nightly `mysqldump` cron and weekly restore drill.