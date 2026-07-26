const fs = require("fs");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

(async () => {
  const pw = fs.readFileSync("/tmp/set_admin_pw.txt", "utf8").trim();
  const hash = await bcrypt.hash(pw, 10);
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });
  const [result] = await conn.execute(
    "UPDATE admin_users SET password_hash = ? WHERE username = ?",
    [hash, "admin"]
  );
  const [rows] = await conn.execute(
    "SELECT LENGTH(password_hash) AS len FROM admin_users WHERE username = ?",
    ["admin"]
  );
  console.log("affectedRows:", result.affectedRows, "hash_len:", rows[0].len);
  await conn.end();
})();
