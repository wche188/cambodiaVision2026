// scripts/take-screenshots.js — Capture real screenshots of the live app for
// marketing / documentation. Requires a running server + valid credentials.
//
// Usage:
//   node scripts/take-screenshots.js
//
// Logs in as each of the three roles and captures the key pages, both at
// desktop (1440×900) and mobile (375×812) widths.

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "https://localhost:3000";
const OUT = path.resolve(__dirname, "..", "docs", "presentation", "screenshots");
fs.mkdirSync(OUT, { recursive: true });

const CREDENTIALS = {
  admin:        { type: "admin",   username: "admin",        password: "Admin2026!Mission" },
  station:      { type: "admin",   username: "sm_surgery",   password: "Station2026!" },
  volunteer:    { type: "volunteer", passphrase: "Volunteer2026!" },
};

// Pages to screenshot, with which role is needed (and optional wait/script before shot)
const PAGES = [
  // Public
  { name: "00-login",           role: null,    path: "/login",         wait: 500 },

  // Admin
  { name: "10-admin-dashboard",   role: "admin",     path: "/",              wait: 2000 },
  { name: "11-admin-users",       role: "admin",     path: "/admin",         wait: 2000 },
  { name: "12-admin-report",      role: "admin",     path: "/data-report",   wait: 2000 },
  { name: "13-patient-detail",    role: "admin",     path: "/patient/1",     wait: 2000 },

  // Station manager
  { name: "20-station-scan",      role: "station",   path: "/station",       wait: 2000 },

  // Volunteer
  { name: "30-registration",      role: "volunteer", path: "/registration",  wait: 2000 },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile:  { width: 390,  height: 844 },
};

async function loginAs(context, role) {
  const creds = CREDENTIALS[role];
  const resp = await context.request.post(BASE + "/api/auth/login", { data: creds });
  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(`Login failed for ${role}: ${resp.status()} ${body}`);
  }
  return resp.json();
}

(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });

  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    for (const pageDef of PAGES) {
      const context = await browser.newContext({
        viewport,
        ignoreHTTPSErrors: true,
        locale: "en-US",
      });

      try {
        if (pageDef.role) {
          await loginAs(context, pageDef.role);
        }

        const page = await context.newPage();
        await page.goto(BASE + pageDef.path, { waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(pageDef.wait || 1000);

        const out = path.join(OUT, `${pageDef.name}.${vpName}.png`);
        await page.screenshot({ path: out, fullPage: false });
        const stats = fs.statSync(out);
        console.log(`✓ ${vpName.padEnd(7)} ${pageDef.name.padEnd(22)} ${(stats.size / 1024).toFixed(0)} KB`);
      } catch (e) {
        console.error(`✗ ${vpName} ${pageDef.name}: ${e.message}`);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();
  console.log("\nDone. Screenshots saved to:", OUT);
})().catch(e => { console.error(e); process.exit(1); });