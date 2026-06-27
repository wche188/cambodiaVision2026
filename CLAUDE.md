# Project Context

## Overview
Cambodia Vision 2026 — patient management system for medical mission trips. Next.js 15, MySQL, Tailwind CSS 4.

## Commands
- `node server.mjs` — run with HTTPS (for LAN camera access)
- `npm run dev` — run with HTTP (localhost only)
- `npm test` — run tests (vitest)
- `npm run build` — production build

## Key Files
- `server.mjs` — custom HTTPS server
- `lib/mysql.js` — database connection pool
- `lib/session.js` — iron-session config
- `lib/status-pipeline.js` — station definitions
- `middleware.js` — auth + role enforcement
- `db/init.sql` — full database schema
- `public/templates/` — .docx form templates

## Database
- MySQL 8.0, database: `cambodia_vision`
- Tables: patients, admin_users, system_config, surgeons, surgery_records, station_status, status_history, gp_examinations, surgery_decisions

## Roles
- `volunteer` — passphrase login, registration + dashboard
- `station_manager` — username/password, scan page only
- `admin` — username/password, full access
