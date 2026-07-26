const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const OUT = path.resolve(__dirname, "..", "docs", "presentation", "screenshots");

(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.request.post("https://150.230.8.247:3000/api/auth/login", {
    data: { type: "admin", username: "admin", password: "Admin2026!Mission" },
  });
  const page = await context.newPage();
  await page.goto("https://150.230.8.247:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "10b-admin-dashboard-full.png"), fullPage: true });
  console.log("✓ dashboard full page");

  await context.request.post("https://150.230.8.247:3000/api/auth/login", {
    data: { type: "volunteer", passphrase: "Volunteer2026!" },
  });
  await page.goto("https://150.230.8.247:3000/registration", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "30b-registration-full.png"), fullPage: true });
  console.log("✓ registration full page");

  await context.request.post("https://150.230.8.247:3000/api/auth/login", {
    data: { type: "admin", username: "sm_surgery", password: "Station2026!" },
  });
  await page.goto("https://150.230.8.247:3000/station", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "20b-station-full.png"), fullPage: true });
  console.log("✓ station full page");

  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
    locale: "km-KH",
  });
  await mobileCtx.request.post("https://150.230.8.247:3000/api/auth/login", {
    data: { type: "volunteer", passphrase: "Volunteer2026!" },
  });
  const mPage = await mobileCtx.newPage();
  await mPage.goto("https://150.230.8.247:3000/", { waitUntil: "networkidle" });
  await mPage.waitForTimeout(2500);
  await mPage.screenshot({ path: path.join(OUT, "40-mobile-dashboard.png"), fullPage: true });
  console.log("✓ mobile dashboard (km-KH locale)");

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
