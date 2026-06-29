# Cambodia Vision 2026 — Day-to-Day Operations

This guide covers routine tasks for the production deployment at
`ubuntu@150.230.8.247`. It assumes the install steps in
[`DEPLOYMENT.md`](./DEPLOYMENT.md) have been completed and that the
project lives at `/opt/cambodia-vision`.

> Conventions:
> - Run all commands as the deploy user (`ubuntu`), not root, unless noted.
> - `.env.production` lives at `/opt/cambodia-vision/.env.production`.
> - Backups live in `/var/backups/cambodia-vision/`.
> - Logs live under PM2's default log root (`~/.pm2/logs/`).

---

## 1. Common PM2 Commands

```bash
# Process state
pm2 status

# Live logs (stdout + stderr interleaved)
pm2 logs cambodia-vision

# Tail only the last N lines
pm2 logs cambodia-vision --lines 200

# Only stderr (where crashes show up)
pm2 logs cambodia-vision --err --lines 100

# Restart the app
pm2 restart cambodia-vision

# Reload (zero-downtime) — only useful once we run multiple instances
pm2 reload cambodia-vision

# Stop (keeps the process entry in PM2's list)
pm2 stop cambodia-vision

# Delete the process entry (next start:prod re-creates it)
pm2 delete cambodia-vision

# Live CPU/memory dashboard
pm2 monit

# Flush logs (does NOT delete log files, just truncates)
pm2 flush cambodia-vision
```

The npm-script shortcuts from `package.json` are also available inside
the project directory:

```bash
cd /opt/cambodia-vision
npm run stop       # pm2 stop cambodia-vision
npm run restart    # pm2 restart cambodia-vision
```

---

## 2. Deploy a New Version

```bash
cd /opt/cambodia-vision

# Pull the latest code
git pull

# Install any new dependencies (clean, lockfile-driven)
npm ci

# Rebuild the Next.js bundle
npm run build

# Restart PM2 — picks up the new build
pm2 restart cambodia-vision

# Tail logs to confirm a clean boot
pm2 logs cambodia-vision --lines 100
```

If `ecosystem.config.cjs` itself changed, PM2 needs to reload it:

```bash
pm2 delete cambodia-vision
npm run start:prod
pm2 save
```

### Rollback

```bash
cd /opt/cambodia-vision
git log --oneline -n 5              # pick a known-good SHA
git checkout <known-good-sha>
npm ci
npm run build
pm2 restart cambodia-vision
```

Database schema changes require a migration plan — see
`IMPLEMENTATION_PLAN.md` Phase 4. Do **not** re-run `db/init.sql`
against a populated database; it uses `CREATE TABLE IF NOT EXISTS` and
will skip tables, but it will not back-fill new columns.

---

## 3. Backups

### 3.1 Nightly cron backup (file system)

Already configured in `DEPLOYMENT.md` §12. Verify it ran:

```bash
ls -lh /var/backups/cambodia-vision/
sudo tail -n 20 /var/log/cambodia-vision-backup.log
```

### 3.2 In-app admin backup endpoint

Pull a live dump over HTTPS. The endpoint requires an admin session
cookie **and** a password confirmation header.

```bash
# 1. Log in and capture the session cookie
curl -k -c cookies.txt -X POST https://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_ADMIN_PASSWORD"}'

# 2. Stream a backup
curl -k -b cookies.txt \
  -H 'X-Confirm-Password: YOUR_ADMIN_PASSWORD' \
  https://localhost:3000/api/admin/backup \
  -o cambodia-vision-$(date +%Y%m%d-%H%M%S).sql
```

Verify the dump:

```bash
head -n 5 cambodia-vision-*.sql
grep -c '^CREATE TABLE' cambodia-vision-*.sql   # expect 9
```

> Security note: the in-app backup endpoint authenticates with the
> admin's session cookie and a password re-confirmation header. Keep
> `cookies.txt` on a trusted host and delete it after use.

### 3.3 Restore from backup

```bash
# From a mysqldump file
gunzip -c /var/backups/cambodia-vision/cambodia-vision-20260628-021700.sql.gz \
  | mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision

# From a plain .sql file
mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision < cambodia-vision-20260628.sql
```

Verify after restore:

```bash
mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision -e "
  SELECT COUNT(*) AS patients FROM patients;
  SELECT COUNT(*) AS surgeries FROM surgery_records;
"
```

### 3.4 Restore drill (recommended weekly)

The drill proves that the backup is good **before** you need it.

```bash
# 1. Spin up a scratch database
mysql -h 127.0.0.1 -u root -p -e "
  CREATE DATABASE cambodia_vision_drill CHARACTER SET utf8mb4;
  GRANT ALL ON cambodia_vision_drill.* TO 'cambodiav'@'127.0.0.1';
  FLUSH PRIVILEGES;
"

# 2. Restore the latest nightly backup
LATEST=$(ls -t /var/backups/cambodia-vision/*.sql.gz | head -1)
gunzip -c "$LATEST" | mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision_drill

# 3. Compare row counts
mysql -h 127.0.0.1 -u cambodiav -p -e "
  SELECT 'patients' AS tbl, COUNT(*) FROM cambodia_vision.patients
  UNION ALL
  SELECT 'patients', COUNT(*) FROM cambodia_vision_drill.patients;
"

# 4. Clean up
mysql -h 127.0.0.1 -u root -p -e "DROP DATABASE cambodia_vision_drill;"
```

Log the drill outcome somewhere durable (issue tracker, ops log).

### 3.5 Off-site copy (optional but recommended)

Once a clinic day is complete, copy the night's dump off the host. With
Oracle Cloud free tier, the simplest path is `scp` to a personal
machine, or `rclone` to a bucket you control.

```bash
# Example: copy to local laptop
scp ubuntu@150.230.8.247:/var/backups/cambodia-vision/cambodia-vision-*.sql.gz ./backups/
```

---

## 4. User Management — DB only

The admin panel does **not** expose user creation or deletion. The admin UI
can change passwords for existing users only. New users must be added via
direct database access. This is intentional — it prevents a compromised
admin session from creating backdoor accounts, and forces user lifecycle
to go through documented IT/DBA workflows.

### 4.1 Changing a user's password (admin UI)

`/admin` → Users row → **Change password** button. Required fields:

- New password (≥ 8 characters)
- Confirm new password
- Your own admin password (re-authentication — blocks a hijacked session)

### 4.2 Adding a new admin user (DB only)

```bash
cd /home/ubuntu/cambodia-vision

# 1. Generate a bcrypt hash for the new password (cost 10 — same as login route)
node -e '
  const bcrypt = require("bcryptjs");
  console.log(bcrypt.hashSync(process.argv[1], 10));
' 'NEW_ADMIN_PASSWORD'
```

Copy the printed hash, then:

```bash
mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision <<SQL
INSERT INTO admin_users (username, password_hash, full_name, role, assigned_station)
VALUES ('newadmin', 'PASTE_BCRYPT_HASH_HERE', 'Second Admin', 'admin', NULL);
SQL
```

**For station_manager accounts**, set `role='station_manager'` and
`assigned_station` to one of:

```text
Doctor | Optometry | Refraction | Glasses_Dispensed | Ear_Therapy | Surgery
```

```sql
INSERT INTO admin_users (username, password_hash, full_name, role, assigned_station)
VALUES ('sm_doctor', 'PASTE_BCRYPT_HASH_HERE', 'Doctor Station Manager',
        'station_manager', 'Doctor');
```

### 4.3 Removing a user (DB only, rare)

> Avoid in production. Prefer rotating the user's password and disabling
> their access instead of a hard DELETE so the audit trail (status_history,
> patient author attribution) stays intact.

```bash
mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision -e \
  "DELETE FROM admin_users WHERE username = 'username_to_remove';"
```

Last-admin and self-deletion guards exist in the API but if you delete via
SQL, take care not to leave the system without an admin.

### 4.4 Bulk seeding (test setup)

Use `scripts/seed-accounts.js` to create the full initial roster
(1 admin + 6 station_managers + volunteer passphrase) in one shot. Idempotent.

```bash
cd /home/ubuntu/cambodia-vision
set -a && source .env.production && set +a
node scripts/seed-accounts.js
```

The script prints a table of all created accounts when done. Delete
`scripts/seed-accounts.js` from the server after running for the first
time — it should not remain on production.

---

## 5. Rotating `SESSION_SECRET`

Rotating the session secret invalidates every active session —
everyone must log in again. Schedule for off-hours.

```bash
cd /opt/cambodia-vision

# 1. Generate a new secret
NEW_SECRET=$(openssl rand -hex 32)
echo "$NEW_SECRET"

# 2. Update .env.production
sed -i.bak "s|^SESSION_SECRET=.*|SESSION_SECRET=${NEW_SECRET}|" .env.production
chmod 600 .env.production

# 3. Restart the app to pick up the new value
pm2 restart cambodia-vision

# 4. Confirm
pm2 logs cambodia-vision --lines 50 | grep -i 'iron-session\|error' || echo 'no errors'
```

Keep the `.env.production.bak` somewhere safe for one cycle so you
can roll back if a typo broke logins. Delete it after verification.

---

## 6. Health Checks

### 6.1 App

```bash
curl -k -sS https://localhost:3000/api/health | jq .
```

Expect HTTP 200 with a JSON body. If the response is a 503, the DB is
unreachable — `lib/mysql.js` returns 503 on `ECONNREFUSED` and
`PROTOCOL_CONNECTION_LOST`.

### 6.2 Database

```bash
mysqladmin -h 127.0.0.1 -u cambodiav -p ping
mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision \
  -e "SELECT NOW(), @@hostname, @@version;"
```

### 6.3 PM2 process

```bash
pm2 status
pm2 show cambodia-vision    # full restart count, memory curve, log paths
```

A high restart count (`> 5` in 24 h) is a smell. Investigate
`pm2 logs cambodia-vision --err --lines 200` before each clinic day.

### 6.4 Disk + memory

```bash
df -h /
free -h
```

The PM2 process is capped at 500 MB; the box has 23 GB RAM and 23 GB
disk. If disk fills up, MySQL and PM2 will start failing — clean old
backups, old PM2 logs, and old `~/.npm` cache.

```bash
# Clean PM2 logs older than 7 days
find ~/.pm2/logs -type f -mtime +7 -delete

# Clean npm cache (safe)
npm cache clean --force
```

---

## 7. Where Logs Live

| Source                       | Path                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| App stdout/stderr            | `~/.pm2/logs/cambodia-vision-out.log`, `cambodia-vision-error.log` |
| App logs via `pm2 logs`      | streamed live by PM2 (rotated by `pm2-logrotate` if installed) |
| Backup cron output           | `/var/log/cambodia-vision-backup.log`                       |
| MySQL errors                 | `/var/log/mysql/error.log`                                  |
| OS / auth                    | `/var/log/auth.log`, `/var/log/syslog`                      |

For ongoing rotations:

```bash
npm install -g pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
```

Or use system `logrotate.d` for `/var/log/cambodia-vision-backup.log`:

```
/var/log/cambodia-vision-backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
```

---

## 8. LAN Deployment Notes (Field Site)

The HTTPS custom server (`server.mjs`) auto-generates a self-signed
cert whose SAN includes the host's current LAN IP. This is what makes
`getUserMedia()` (camera, used by `html5-qrcode` and the registration
photo capture) work on tablets and phones.

### Per-device cert trust

Each clinic device has to accept the self-signed cert warning
**once** per browser. Steps for the field admin:

1. On the device, open `https://<lan-ip>:3000/`.
2. Tap "Advanced" → "Proceed" (or "Visit this website").
3. The browser will remember the exception for the session.

For iOS Safari (used on iPads), the cert must be installed as a
profile:

1. From a Mac on the same LAN, browse to
   `https://<lan-ip>:3000/certs/cert.pem` and download it.
2. AirDrop to the iPad, install the profile, then go to
   **Settings → General → About → Certificate Trust Settings** and
   enable the Cambodia Vision cert.

If the LAN IP changes (e.g., the router reboots with a different
DHCP lease), delete `certs/key.pem` and `certs/cert.pem` and restart —
the server will regenerate with the new SAN.

```bash
cd /opt/cambodia-vision
rm -f certs/key.pem certs/cert.pem
pm2 restart cambodia-vision
```

### Camera still blocked?

- Confirm you are on **HTTPS**, not HTTP.
- Confirm the browser exception is for the **exact** hostname/IP in
  the address bar. A cert that covers `192.168.1.50` does not cover
  `cambodia.local` even if they resolve to the same host.
- Try `https://<lan-ip>:3000/` directly by IP if mDNS is flaky.

---

## 9. Operational Schedule

| Cadence  | Task                                                                                       |
| -------- | ------------------------------------------------------------------------------------------ |
| Nightly  | `mysqldump` cron → `/var/backups/cambodia-vision/`, retain 14 days                          |
| Weekly   | Restore drill into `cambodia_vision_drill`, compare row counts, drop scratch DB           |
| Weekly   | `pm2 status` + `df -h /` + `free -h` spot check                                            |
| Pre-trip | Rotate `SESSION_SECRET`, rotate admin and station-manager passwords, run backup drill      |
| Post-trip| Off-site copy of `*.sql.gz` files; archive trip-specific logs                              |
| Quarterly| `npm audit --omit=dev` review; review MySQL user list and drop unused accounts              |

---

## 10. Incident Quick Reference

| Symptom                                        | First check                                    |
| ---------------------------------------------- | ---------------------------------------------- |
| `502 Bad Gateway` from the app                 | `pm2 status` — is the process online?          |
| App returns 503 on every request               | `mysqladmin ping`; check MySQL service         |
| Camera doesn't open on tablet                  | HTTPS? Cert trusted for the exact hostname?    |
| Volunteers can't log in                        | `system_config` passphrase hash matches        |
| Patient list shows empty                       | `SELECT COUNT(*) FROM patients` in MySQL       |
| Backup file is empty                           | Cron log + `mysqldump` exit code               |
| Cert expired                                   | `openssl x509 -in certs/cert.pem -noout -dates` |
| High PM2 restart count                         | `pm2 logs cambodia-vision --err --lines 200`   |

When in doubt, capture `pm2 logs cambodia-vision --lines 500 > /tmp/incident.log`
**before** restarting, so you have evidence if the issue recurs.
