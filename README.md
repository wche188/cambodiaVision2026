# Cambodia Vision 2026

Patient management system for Cambodia Vision medical mission trips. Built with Next.js 15, MySQL, and Tailwind CSS.

## Features

- **Patient registration** with photo capture and bilingual labels (English/Khmer)
- **QR code** on printed forms — station managers scan to check patients in
- **Station tracking** — Doctor, Optometry, Refraction, Glasses, Ear Therapy, Surgery
- **Surgery recording** — procedure, IOL type, incision, complications, surgeon
- **Station queue status** — green/yellow/red indicators so staff can redirect patients
- **Multi-role access** — Volunteers, Station Managers, Admins
- **Document templates** — .docx forms with patient data auto-filled
- **Dashboard** with search, filters, and patient activity stamps

## Roles

| Role | Access | Login |
|------|--------|-------|
| Volunteer | Registration + Dashboard | Shared passphrase |
| Station Manager | Scan page for their station | Username + password |
| Admin | Everything + user management | Username + password |

## Quick Start (Development)

```bash
# 1. Install dependencies
npm install

# 2. Set up MySQL (install locally or use Docker)
mysql -u root -e "CREATE DATABASE cambodia_vision; CREATE USER 'cambodiav'@'localhost' IDENTIFIED BY 'cambodiav'; GRANT ALL ON cambodia_vision.* TO 'cambodiav'@'localhost';"

# 3. Initialize the database
mysql -u cambodiav -pcambodiav cambodia_vision < db/init.sql

# 4. Seed admin account and passphrase
# Run: node scripts/seed.js
# Or manually insert via MySQL

# 5. Configure environment
cp .env.example .env.local
# Edit .env.local with your MySQL credentials

# 6. Run the app
node server.mjs
# App runs at https://localhost:3000 (HTTPS for camera access on LAN)
```

## Production Deployment

Requires: **Node.js 20+**, **MySQL 8.0**, **PM2** (process manager)

```bash
# Install PM2 globally
npm install -g pm2

# On any machine with Node.js 20+ and MySQL 8.0:
git clone <your-repo-url>
cd cambodia-vision
npm install
mysql -u root cambodia_vision < db/init.sql
cp .env.example .env.local  # edit with real credentials — CHANGE ALL PLACEHOLDER VALUES

# Start with PM2 (auto-restart, memory limits)
npm run start:prod

# Or run directly:
node server.mjs

# PM2 commands
npm run stop       # stop the app
npm run restart    # restart the app
pm2 logs cambodia-vision  # view logs
pm2 monit          # monitoring dashboard
```

## HTTPS (Required for Camera on LAN)

The `server.mjs` runs HTTPS using self-signed certificates in `certs/`. These are auto-generated on first run or you can create them:

```bash
mkdir certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem -out certs/cert.pem \
  -subj "/CN=Cambodia Vision Dev" \
  -addext "subjectAltName=DNS:localhost,IP:YOUR_LAN_IP,IP:127.0.0.1"
```

Devices connecting via LAN need to accept the certificate warning once.

## Backup & Restore

```bash
# Backup
mysqldump -u cambodiav -pcambodiav cambodia_vision > backup-$(date +%Y%m%d).sql

# Restore
mysql -u cambodiav -pcambodiav cambodia_vision < backup-YYYYMMDD.sql
```

## Update After Fix

```bash
git pull
npm install
# Restart the app (kill and re-run)
node server.mjs
```

## Document Templates

Templates are in `public/templates/`:
- `registration_template.docx` — patient registration form
- `surgery_template.docx` — surgery form

Placeholders: `{patient_number}`, `{family_name}`, `{given_name}`, `{gender}`, `{age}`, `{has_tb}`, `{blood_group}`, `{is_pregnant}`, `{province}`, `{district}`, `{village}`, `{commune}`, `{contact_phone}`, `{registration_date}`, `{reason_for_visit}`

QR code is injected automatically (top-left corner). Edit templates in Word and upload via Admin panel.

## Station Manager Accounts

Default password for all station accounts: `station2026`

| Username | Station |
|----------|---------|
| doctor | Doctor |
| optom | Optometry |
| refraction | Refraction |
| glasses | Glasses |
| ear | Ear Therapy |
| surgery | Surgery |

## Default Credentials

- **Admin:** `admin` / `camv2026`
- **Volunteer passphrase:** `cambodia2026`

## Tech Stack

- Next.js 15 (App Router)
- MySQL 8.0
- Tailwind CSS 4
- iron-session (auth)
- docxtemplater (forms)
- html5-qrcode (scanner)
- qrcode (generation)
- jsPDF (QR labels)
