const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST, user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE,
  });
  const [rows] = await conn.execute("SELECT password_hash FROM admin_users WHERE username = ?", ["admin"]);
  for (const pw of ["Admin2026!Mission", "admin", "camv2026", "password", "Admin2026!"]) {
    const ok = await bcrypt.compare(pw, rows[0].password_hash);
    console.log(pw + ": " + (ok ? "MATCH" : "no"));
  }
  await conn.end();
})();
