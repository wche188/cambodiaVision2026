// Seed all station_manager accounts + volunteer shared passphrase.
// Run once on the server. Idempotent — safe to re-run.
//
// Usage (on the server, with .env.production sourced):
//   cd /home/ubuntu/cambodia-vision
//   set -a && source .env.production && set +a
//   node scripts/seed-accounts.js
//   rm scripts/seed-accounts.js

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const STATION_MANAGERS = [
  { username: "sm_doctor",     assigned_station: "Doctor",            full_name: "Doctor Station Manager" },
  { username: "sm_optometry",  assigned_station: "Optometry",         full_name: "Optometry Station Manager" },
  { username: "sm_refraction", assigned_station: "Refraction",        full_name: "Refraction Station Manager" },
  { username: "sm_dispensary", assigned_station: "Glasses_Dispensed", full_name: "Glasses Station Manager" },
  { username: "sm_ear",        assigned_station: "Ear_Therapy",       full_name: "Ear Therapy Station Manager" },
  { username: "sm_surgery",    assigned_station: "Surgery",           full_name: "Surgery Station Manager" },
];
const SM_PASSWORD = "Station2026!";
const VOLUNTEER_PASSPHRASE = "Volunteer2026!";

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const smHash = await bcrypt.hash(SM_PASSWORD, 10);
  await conn.query("DELETE FROM admin_users WHERE username LIKE 'sm\\_%'");

  for (const u of STATION_MANAGERS) {
    await conn.query(
      "INSERT INTO admin_users (username, password_hash, full_name, `role`, assigned_station) VALUES (?, ?, ?, ?, ?)",
      [u.username, smHash, u.full_name, "station_manager", u.assigned_station]
    );
  }

  const volHash = await bcrypt.hash(VOLUNTEER_PASSPHRASE, 10);
  try {
    await conn.query(
      "INSERT INTO system_config (config_key, config_value) VALUES (?, ?)",
      ["shared_passphrase", volHash]
    );
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      await conn.query(
        "UPDATE system_config SET config_value = ? WHERE config_key = ?",
        [volHash, "shared_passphrase"]
      );
    } else throw e;
  }

  const [users] = await conn.query(
    "SELECT username, `role`, assigned_station FROM admin_users ORDER BY id"
  );
  const [cfg] = await conn.query(
    "SELECT config_key FROM system_config WHERE config_key = ?",
    ["shared_passphrase"]
  );

  console.log("=== ACCOUNTS CREATED ===\n");
  console.log("Station Managers (login via /api/auth/login as type=admin):");
  console.log("password for ALL: " + SM_PASSWORD);
  console.log("username        | station");
  console.log("----------------|--------------------");
  for (const u of users.filter(u => u.role === "station_manager")) {
    console.log(u.username.padEnd(16) + "| " + u.assigned_station);
  }
  console.log("");
  console.log("Volunteer passphrase (login as type=volunteer):");
  console.log("passphrase: " + VOLUNTEER_PASSPHRASE);
  console.log("hashed in system_config.shared_passphrase: " + (cfg.length === 1 ? "OK" : "MISSING"));
  console.log("");
  console.log("Existing admin:");
  for (const u of users.filter(u => u.role === "admin")) {
    console.log("  " + u.username + " (admin role)");
  }
  await conn.end();
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
