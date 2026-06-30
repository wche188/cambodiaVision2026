// scripts/reset-admin-password.js — Last-resort admin password reset.
//
// Use only when the admin password has been lost or compromised and
// cannot be reset through the admin UI (which requires the current
// password). Bypasses the UI to write directly to MySQL.
//
// Runs on the SERVER, against the production database.
//
// Usage:
//   1. ssh ubuntu@150.230.8.247
//   2. cd /home/ubuntu/cambodia-vision
//   3. set -a && source .env.production && set +a
//   4. node scripts/reset-admin-password.js [username]    # default: admin
//
// Interactive (TTY):  prompts for YES, then password (hidden with *), confirm
// Piped input:        reads line-by-line; password prompt is visible
//
// Audit log: every reset appends to scripts/.admin-reset.log (project dir).
// Move to /var/log later if /var/log is made writable by the deploy user.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const TARGET_USERNAME = process.argv[2] || "admin";
const BCRYPT_ROUNDS = 10;
const AUDIT_LOG = path.resolve(__dirname, ".admin-reset.log");

function makePromptFn() {
  // TTY mode: hide password input. Piped mode: read visible lines.
  if (process.stdin.isTTY) {
    return async function prompt(question, { hidden = false } = {}) {
      return new Promise((resolve) => {
        const stdin = process.openStdin();
        const stdout = process.stdout;
        const wasRaw = stdin.isRaw;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding("utf8");
        stdout.write(question);
        let input = "";
        const onData = (ch) => {
          const c = ch.toString("utf8");
          if (c === "\n" || c === "\r" || c === "") {
            stdin.setRawMode(wasRaw);
            stdin.pause();
            stdin.removeListener("data", onData);
            stdout.write("\n");
            resolve(input);
            return;
          }
          if (c === "") {
            stdout.write("\n");
            process.exit(1);
          }
          if (c === "" || c === "\b") {
            if (input.length > 0) {
              input = input.slice(0, -1);
              stdout.write("\b \b");
            }
            return;
          }
          input += c;
          if (!hidden) stdout.write(c);
          else stdout.write("*");
        };
        stdin.on("data", onData);
      });
    };
  }

  // Non-TTY (piped): use a single readline interface and consume lines.
  const rl = readline.createInterface({ input: process.stdin });
  const queue = [];
  rl.on("line", (line) => queue.push(line));
  return async function prompt(question, _opts = {}) {
    while (queue.length === 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return queue.shift();
  };
}

async function audit(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    fs.appendFileSync(AUDIT_LOG, line, { mode: 0o600 });
  } catch (err) {
    console.error(`(audit log write failed: ${err.message})`);
  }
}

async function main() {
  console.log("=========================================");
  console.log(" Admin Password Reset (last resort)");
  console.log("=========================================");
  console.log(`Target user: ${TARGET_USERNAME}`);
  console.log(`DB host:    ${process.env.MYSQL_HOST || "(unset)"}`);
  console.log(`DB name:    ${process.env.MYSQL_DATABASE || "(unset)"}`);
  console.log("");

  if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) {
    console.error("ERROR: MYSQL_* env vars not set.");
    console.error("Source .env.production first:");
    console.error("  set -a && source .env.production && set +a");
    process.exit(1);
  }

  const prompt = makePromptFn();

  const confirm = await prompt("Type YES to reset the admin password: ");
  if ((confirm || "").trim() !== "YES") {
    console.log("Aborted.");
    process.exit(0);
  }

  const pw = await prompt("New password (min 8 chars): ", { hidden: true });
  console.log("");
  if (!pw || pw.length < 8) {
    console.error("ERROR: password must be at least 8 characters.");
    process.exit(1);
  }
  const pw2 = await prompt("Confirm new password:           ", { hidden: true });
  console.log("");
  if (pw !== pw2) {
    console.error("ERROR: passwords do not match.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    const [rows] = await conn.execute(
      "SELECT id, username, role FROM admin_users WHERE username = ?",
      [TARGET_USERNAME]
    );
    if (rows.length === 0) {
      console.error(`ERROR: user "${TARGET_USERNAME}" not found in admin_users.`);
      process.exit(1);
    }
    const target = rows[0];
    if (target.role !== "admin") {
      console.warn(`WARN: target user "${TARGET_USERNAME}" has role="${target.role}", not "admin".`);
      const goAnyhow = await prompt("Continue anyway? (YES): ");
      if ((goAnyhow || "").trim() !== "YES") {
        console.log("Aborted.");
        process.exit(0);
      }
    }

    const [result] = await conn.execute(
      "UPDATE admin_users SET password_hash = ? WHERE username = ?",
      [hash, TARGET_USERNAME]
    );

    if (result.affectedRows === 0) {
      console.error("ERROR: update affected 0 rows. Aborting.");
      process.exit(1);
    }

    console.log("");
    console.log(`✓ Password reset for "${TARGET_USERNAME}" (id=${target.id})`);
    console.log(`  rows affected: ${result.affectedRows}`);
    console.log("");
    console.log("NEXT STEPS:");
    console.log("  1. Test the new password against the login API immediately:");
    console.log(`     curl -sk -X POST -H "Content-Type: application/json" \\`);
    console.log(`       -d '{"type":"admin","username":"${TARGET_USERNAME}","password":"<new>"}' \\`);
    console.log(`       https://localhost:3000/api/auth/login`);
    console.log(`  2. Audit entry written to ${AUDIT_LOG}`);

    await audit(`RESET password for "${TARGET_USERNAME}" (id=${target.id})`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});