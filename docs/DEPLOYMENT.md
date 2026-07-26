# Cambodia Vision 2026 — Production Deployment Guide

This guide walks through a from-scratch production deployment of the
Cambodia Vision 2026 patient management system onto a fresh
**Ubuntu 24.04 LTS ARM** server. It assumes a clean host with
passwordless `sudo` and that MySQL 8 is reachable on
`127.0.0.1:3306`.

The remote target used for the reference deployment is
`ubuntu@150.230.8.247`. The repository is
`https://github.com/wche188/cambodiaVision2026.git`.

The expected end state is:

- App reachable at `https://<lan-ip>:3000`
- Process managed by PM2 with autorestart and boot persistence
- MySQL schema initialised from `db/init.sql`
- Nightly `mysqldump` cron writing to `/var/backups/cambodia-vision/`

---

## 1. Prerequisites

| Requirement         | Minimum version | Notes                                |
| ------------------- | --------------- | ------------------------------------ |
| OS                  | Ubuntu 24.04    | aarch64 verified                     |
| Node.js             | 20.x            | `node -v`                            |
| npm                 | 10.x            | bundled with Node 20                 |
| MySQL Server        | 8.0             | listening on `127.0.0.1:3306`        |
| MySQL Client        | 8.0             | `mysql --version`                    |
| git                 | 2.30+           | for cloning the repo                 |
| PM2                 | latest          | installed by this guide              |
| OpenSSL             | 3.x             | for cert + secret generation         |
| sudo                | n/a             | passwordless to a non-root user      |

Verify the host is ready:

```bash
node -v          # v20.20.2+
npm -v           # 10.8.2+
mysql --version  # 8.0.x
git --version    # 2.43+
sudo -n true     # exits 0 if passwordless
```

---

## 2. One-time Server Setup

### 2.1 System update

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential openssl curl ca-certificates
```

### 2.2 Firewall

The reference server ships with `ufw` inactive and Oracle Cloud's
network list as the only network filter. Choose **one** of:

**Option A — leave network-list filtering as the only firewall.**
Acceptable for the Oracle Cloud free tier where the subnet is private
and Oracle's ingress rules already lock down 22/3000 to known IPs.

**Option B — turn on `ufw` and allow only SSH + LAN-subnet to 3000.**

```bash
sudo ufw allow OpenSSH
sudo ufw allow from 192.168.0.0/16 to any port 3000 proto tcp
sudo ufw allow from 10.0.0.0/8     to any port 3000 proto tcp
sudo ufw allow from 172.16.0.0/12  to any port 3000 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Open port **3000/tcp** to your clinic LAN range. Do **not** expose
3000 to the public internet — the self-signed cert is not a production
identity, and the passphrase flow is LAN-scoped.

### 2.3 MySQL hardening (if MySQL is freshly installed)

The reference host already has MySQL 8 running on `127.0.0.1:3306`.
If you are starting from scratch on a different host:

```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

`mysql_secure_installation` should:

- Set a root password (or switch to `auth_socket`).
- Remove anonymous users.
- Disallow remote root login.
- Remove the test database.

Confirm it is up:

```bash
sudo systemctl status mysql   # active (running)
ss -lntp | grep 3306          # 127.0.0.1:3306
```

---

## 3. Clone the Repository

```bash
sudo mkdir -p /opt/cambodia-vision
sudo chown -R "$USER":"$USER" /opt/cambodia-vision
cd /opt
git clone https://github.com/wche188/cambodiaVision2026.git cambodia-vision
cd /opt/cambodia-vision
```

---

## 4. Generate Production Secrets

Run these **on the production host** so the secrets never traverse the
network.

### 4.1 `SESSION_SECRET`

Must be at least 32 random characters:

```bash
openssl rand -hex 32
```

Output will look like `9f3c1a...e7b2` (64 hex chars). Save this — you
will paste it into `.env.production` below.

### 4.2 MySQL application user

Connect as root (or whichever admin principal can `CREATE USER`):

```bash
sudo mysql
```

Then inside the MySQL shell:

```sql
-- Pick a strong password, e.g. 24 random chars from openssl rand -base64 24
CREATE USER 'cambodiav'@'127.0.0.1'
  IDENTIFIED BY 'PASTE_STRONG_RANDOM_PASSWORD_HERE';

CREATE DATABASE IF NOT EXISTS cambodia_vision
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON cambodia_vision.*
  TO 'cambodiav'@'127.0.0.1';

FLUSH PRIVILEGES;
EXIT;
```

Generate the password with:

```bash
openssl rand -base64 24
```

Notes:

- Scope to `127.0.0.1` because the app and DB are on the same host.
- Grant only on the `cambodia_vision` schema, not `*.*`.
- Rotate at least once per clinic cycle; see `OPERATIONS.md`.

### 4.3 Volunteer passphrase

You can leave the default (`cambodia2026`) and rotate it post-deployment
through the admin UI, or pre-set it via the seeder in step 7.

---

## 5. Configure `.env.production`

The app reads environment variables directly from `process.env` —
Next.js loads `.env.production` automatically when started with
`NODE_ENV=production`. The file must live at the project root.

```bash
cd /opt/cambodia-vision
cat > .env.production <<'ENV'
# Cambodia Vision 2026 — production
# DO NOT COMMIT THIS FILE. Lives on the server only.

# Database
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=cambodiav
MYSQL_PASSWORD=PASTE_MYSQL_PASSWORD_FROM_STEP_4_2
MYSQL_DATABASE=cambodia_vision

# Session — minimum 32 random chars
# Generate with: openssl rand -hex 32
SESSION_SECRET=PASTE_SESSION_SECRET_FROM_STEP_4_1

# App
NODE_ENV=production
ENV

chmod 600 .env.production
```

Lock the file down to the owner only — it contains the session secret
and DB password.

---

## 6. Initialise the Database Schema

```bash
cd /opt/cambodia-vision
mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision < db/init.sql
```

Enter the password from step 4.2 when prompted.

Verify the tables:

```bash
mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision \
  -e "SHOW TABLES; SELECT COUNT(*) AS surgeons FROM surgeons;"
```

Expected: 9 tables (`patients`, `status_history`, `gp_examinations`,
`surgery_decisions`, `admin_users`, `system_config`, `surgeons`,
`surgery_records`, `station_status`) and 8 seeded surgeons.

---

## 7. Seed Admin User

The repo does not ship with a default admin password hash; you create
the first admin from the CLI. Use a one-shot Node script with
`bcryptjs` (already a dependency).

```bash
cd /opt/cambodia-vision
node -e '
  const bcrypt = require("bcryptjs");
  const password = process.argv[1];
  const hash = bcrypt.hashSync(password, 12);
  console.log(hash);
' 'PASTE_INITIAL_ADMIN_PASSWORD'
```

Copy the printed hash. Then insert the row:

```bash
mysql -h 127.0.0.1 -u cambodiav -p cambodia_vision <<SQL
INSERT INTO admin_users (username, password_hash, full_name, role)
VALUES ('admin', 'PASTE_BCRYPT_HASH_HERE', 'Field Admin', 'admin');

-- Shared volunteer passphrase (bcrypt-hashed). Default: cambodia2026
-- Generate its hash the same way and store in system_config.
INSERT INTO system_config (config_key, config_value)
VALUES ('volunteer_passphrase_hash', 'PASTE_PASSPHRASE_BCRYPT_HASH_HERE');
SQL
```

Alternatively, save this as `scripts/seed-admin.js` for re-use:

```js
// scripts/seed-admin.js — run locally with: node scripts/seed-admin.js
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.production' });

const ADMIN_USERNAME = process.argv[2] || 'admin';
const ADMIN_PASSWORD = process.argv[3];
const PASSPHRASE    = process.argv[4];

if (!ADMIN_PASSWORD || !PASSPHRASE) {
  console.error('Usage: node scripts/seed-admin.js <username> <password> <passphrase>');
  process.exit(1);
}

(async () => {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: +process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const adminHash   = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const passHash    = await bcrypt.hash(PASSPHRASE, 12);

  await pool.query(
    `INSERT INTO admin_users (username, password_hash, full_name, role)
     VALUES (?, ?, 'Field Admin', 'admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [ADMIN_USERNAME, adminHash]
  );

  await pool.query(
    `INSERT INTO system_config (config_key, config_value)
     VALUES ('volunteer_passphrase_hash', ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
    [passHash]
  );

  await pool.end();
  console.log('Seeded admin and volunteer passphrase.');
})();
```

---

## 8. Build

```bash
cd /opt/cambodia-vision
npm ci       # clean install from package-lock.json
npm run build
```

`npm run build` invokes `next build --turbopack` and emits a
`.next/` directory. The output should end with a route table listing
the App Router pages and API routes.

---

## 9. Start with PM2

```bash
cd /opt/cambodia-vision
npm install -g pm2
npm run start:prod
```

`npm run start:prod` runs `pm2 start ecosystem.config.cjs`, which uses
the contents of `ecosystem.config.cjs`:

```js
module.exports = {
  apps: [{
    name: 'cambodia-vision',
    script: 'server.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
  }]
};
```

PM2 will pick up the LAN IP from `networkInterfaces()` inside
`server.mjs`, generate a self-signed cert with that IP in the SAN, and
listen on `0.0.0.0:3000`.

Confirm:

```bash
pm2 status
pm2 logs cambodia-vision --lines 100
```

Look for log lines:

```
> Ready on https://localhost:3000
> LAN: https://<lan-ip>:3000
> Generating self-signed certificates (SAN includes <lan-ip>)...
```

---

## 10. Verify

### 10.1 Local curl

```bash
curl -k https://127.0.0.1:3000/api/health
```

Expect HTTP 200 with a JSON body. `-k` is required because the cert is
self-signed.

### 10.2 LAN curl

From a laptop on the same network:

```bash
curl -k https://<lan-ip>:3000/api/health
```

### 10.3 Browser

Visit `https://<lan-ip>:3000/` from a clinic device. Accept the
self-signed-cert warning once. Camera access (registration photos, QR
scanning) requires HTTPS, which is why we run our own server.

### 10.4 PM2 dashboard

```bash
pm2 monit          # live CPU / mem / logs
pm2 status         # process state
```

---

## 11. PM2 Startup on Boot

So the app survives a reboot without manual intervention:

```bash
pm2 startup        # prints the exact systemd command to run as root
# copy/paste the suggested command, e.g.:
#   sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

pm2 save           # snapshot the current process list
```

Verify after a reboot:

```bash
sudo reboot
# wait, ssh back in
pm2 status         # cambodia-vision should be online
```

---

## 12. Backup Setup

`mysqldump` to a per-day file under `/var/backups/cambodia-vision/`,
retained for 14 days:

```bash
sudo mkdir -p /var/backups/cambodia-vision
sudo chown ubuntu:ubuntu /var/backups/cambodia-vision
chmod 700 /var/backups/cambodia-vision
```

Write `/opt/cambodia-vision/scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/cambodia-vision"
TS="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/cambodia-vision-${TS}.sql.gz"

# Credentials are sourced from the app env to keep this single-source.
set -a
. /opt/cambodia-vision/.env.production
set +a

mysqldump \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --password="$MYSQL_PASSWORD" \
  --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE" | gzip -9 > "$FILE"

# Retain 14 days
find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime +14 -delete

echo "wrote $FILE"
```

```bash
chmod +x /opt/cambodia-vision/scripts/backup.sh
```

Cron entry, runs nightly at 02:17 server time:

```bash
crontab -e
# add:
17 2 * * * /opt/cambodia-vision/scripts/backup.sh >> /var/log/cambodia-vision-backup.log 2>&1
```

Test manually first:

```bash
/opt/cambodia-vision/scripts/backup.sh
ls -lh /var/backups/cambodia-vision/
```

See `OPERATIONS.md` for restore drills and the in-app admin backup
endpoint.

---

## 13. Troubleshooting

### 13.1 `Error: connect ECONNREFUSED 127.0.0.1:3306`

MySQL is not running or is bound to a different interface.

```bash
sudo systemctl status mysql
ss -lntp | grep 3306
```

If bound only to a socket, set `MYSQL_HOST=localhost` in
`.env.production` (the `mysql2` driver will use the Unix socket).

### 13.2 `SESSION_SECRET must be at least 32 characters`

`iron-session` enforces a 32-char minimum. Re-run:

```bash
openssl rand -hex 32
```

and paste the result (no quotes, no spaces).

### 13.3 Camera does not work on tablets

Browsers refuse `getUserMedia()` over plain HTTP except on `localhost`.
Two checks:

- Are you on `https://<lan-ip>:3000`? (Self-signed cert warning is OK.)
- Did you accept the cert on this device? Some tablets need a manual
  install: visit `https://<lan-ip>:3000/cert.pem` once and trust the CA.

### 13.4 `PM2 not found`

Install globally:

```bash
npm install -g pm2
hash -r   # or open a new shell
which pm2
```

### 13.5 `pm2 startup` prints a sudo command but the service is not enabled

Run the **exact** command printed, with `sudo`. Then `pm2 save` again.

### 13.6 Build fails on `next build --turbopack`

- Confirm Node ≥ 20 (`node -v`).
- Delete `.next/` and rebuild: `rm -rf .next && npm run build`.
- Check disk space: `df -h /`.

### 13.7 Backup file is empty

`mysql --password=...` with an empty value still works for some local
configs but is fragile. Always pass the password via `.env.production`
and let `mysqldump` read it from the environment:

```bash
mysqldump --defaults-extra-file=<(set -a; . .env.production; set +a; env | grep ^MYSQL_) ...
```

The wrapper script in §12 already handles this; do not inline the
password on the command line.

### 13.8 Out of memory (PM2 restarts repeatedly)

`max_memory_restart: '500M'` will recycle the process if it exceeds
500 MB. Inspect with:

```bash
pm2 logs cambodia-vision --err --lines 200
free -h
```

If the box genuinely cannot support the workload, lower the connection
pool in `lib/mysql.js` from `connectionLimit: 10` to 5 and rebuild.

---

## 14. Post-deploy Checklist

- [ ] `pm2 status` shows `cambodia-vision` as `online`
- [ ] `https://<lan-ip>:3000/` loads and accepts the self-signed cert
- [ ] Admin login works (`/login`)
- [ ] One test patient can be registered end-to-end
- [ ] Nightly cron is present (`crontab -l`)
- [ ] A test backup was created and contains the expected tables
- [ ] Reboot test passed (`sudo reboot` then `pm2 status`)