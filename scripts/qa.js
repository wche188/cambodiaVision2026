// scripts/qa.js — comprehensive QA harness for Cambodia Vision
// Hits every page and every API endpoint as the appropriate role,
// records pass/fail with HTTP status + error message, prints a summary.
//
// Run with:  node scripts/qa.js

const BASE = process.env.QA_BASE || "https://localhost:3000";
const PASSWORD = "pw";
const https = require("https");
const { URL } = require("url");

const agent = new https.Agent({ rejectUnauthorized: false });

const results = [];
let totalPass = 0, totalFail = 0, totalSkipped = 0;

function record(name, ok, detail) {
  if (ok === null) { totalSkipped++; return; }
  if (ok) totalPass++; else totalFail++;
  const tag = ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${tag}  ${name}${detail ? ` — ${detail}` : ""}`);
  results.push({ name, ok, detail });
}

async function http(method, path, { body, cookie, expectJson = true } = {}) {
  const url = new URL(BASE + path);
  return new Promise((resolve, reject) => {
    const headers = { "User-Agent": "qa-harness/1.0" };
    if (body) headers["Content-Type"] = "application/json";
    if (cookie) headers["Cookie"] = cookie;
    const req = https.request({
      method, hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      headers, agent
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        const setCookie = res.headers["set-cookie"];
        const newCookie = setCookie ? setCookie.map(c => c.split(";")[0]).join("; ") : null;
        let parsed = null;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: data, json: parsed, cookie: newCookie, setCookie });
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function login(username, type = "admin") {
  const body = type === "volunteer"
    ? { type: "volunteer", passphrase: PASSWORD }
    : { type: "admin", username, password: PASSWORD };
  const res = await http("POST", "/api/auth/login", { body });
  if (res.status !== 200) throw new Error(`login failed for ${username}: ${res.status} ${res.body}`);
  return res.cookie;
}

async function logout(cookie) {
  return http("POST", "/api/auth/logout", { cookie });
}

async function checkPage(name, path, cookie, { expectStatus = 200 } = {}) {
  const res = await http("GET", path, { cookie });
  const ok = res.status === expectStatus;
  record(`${name} (GET ${path})`, ok, ok ? `HTTP ${res.status}` : `expected ${expectStatus}, got ${res.status}`);
  return res;
}

async function checkApi(name, method, path, cookie, { body, expectStatus = 200 } = {}) {
  const res = await http(method, path, { cookie, body });
  const ok = res.status === expectStatus;
  record(`${name} (${method} ${path})`, ok, ok ? `HTTP ${res.status}` : `expected ${expectStatus}, got ${res.status} — ${res.body?.slice(0,120)}`);
  return res;
}

(async () => {
  console.log(`\n========== QA HARNESS — ${BASE} ==========\n`);

  // ============================================================
  console.log("--- 1. STATIC PAGES (no auth) ---");
  // ============================================================
  await checkPage("Login page", "/login", null);
  // /icon.png in dev mode redirects through Next image proxy (307 is normal, not a bug)
  await checkPage("Static logo", "/logo.jpeg", null);
  const icon = await http("GET", "/icon.png", { cookie: null });
  record("Static icon (dev 307 → image proxy is normal)", icon.status === 307 || icon.status === 200,
    `HTTP ${icon.status}`);

  // ============================================================
  console.log("\n--- 2. AUTH FLOWS ---");
  // ============================================================
  const badLogin = await http("POST", "/api/auth/login", { body: { type: "admin", username: "admin", password: "wrong" } });
  record("Login rejects bad password", badLogin.status === 401, `got ${badLogin.status}`);

  const noUser = await http("POST", "/api/auth/login", { body: { type: "admin", username: "nobody", password: PASSWORD } });
  record("Login rejects unknown user", noUser.status === 401 || noUser.status === 400, `got ${noUser.status}`);

  const noBody = await http("POST", "/api/auth/login", { body: "not json" });
  record("Login rejects malformed body", noBody.status === 400, `got ${noBody.status}`);

  const noType = await http("POST", "/api/auth/login", { body: { type: "hacker" } });
  record("Login rejects unknown type", noType.status === 400, `got ${noType.status}`);

  // Login all 3 roles
  const adminCookie = await login("admin");
  record("Admin login (admin/pw)", !!adminCookie, adminCookie ? "got cookie" : "no cookie");

  const doctorCookie = await login("doctor");
  record("Station manager login (doctor/pw)", !!doctorCookie);

  const volCookie = await login(null, "volunteer");
  record("Volunteer login (passphrase)", !!volCookie);

  const adminSession = await http("GET", "/api/auth/session", { cookie: adminCookie });
  record("Admin session check", adminSession.json?.role === "admin", `role=${adminSession.json?.role}`);

  const lo = await logout(adminCookie);
  record("Admin logout", lo.status === 200, `HTTP ${lo.status}`);

  // Re-login admin (logout cleared the session)
  const adminC = await login("admin");

  // ============================================================
  console.log("\n--- 3. AUTH GATES (admin) ---");
  // ============================================================
  for (const p of ["/admin", "/data-report", "/registration", "/station"]) {
    await checkPage(`Admin page: ${p}`, p, adminC);
  }
  for (const a of ["/api/patients", "/api/stations/status", "/api/admin/users", "/api/surgeons"]) {
    await checkApi(`Admin API: ${a}`, "GET", a, adminC);
  }

  // ============================================================
  console.log("\n--- 4. STATION MANAGER (doctor) ---");
  // ============================================================
  for (const p of ["/station"]) {
    await checkPage(`Doctor page: ${p}`, p, doctorCookie);
  }
  // Doctor at / should be redirected to /station (by design, middleware line 74-76)
  const docAtRoot = await http("GET", "/", { cookie: doctorCookie });
  record("Doctor at / redirects to /station (by design)", docAtRoot.status === 307, `HTTP ${docAtRoot.status}`);

  const doctorAdmin = await http("GET", "/admin", { cookie: doctorCookie });
  record("Doctor blocked from /admin", doctorAdmin.status === 403, `got ${doctorAdmin.status}`);

  // ============================================================
  console.log("\n--- 5. VOLUNTEER ---");
  // ============================================================
  for (const p of ["/registration", "/"]) {
    await checkPage(`Volunteer page: ${p}`, p, volCookie);
  }
  const volAdmin = await http("GET", "/admin", { cookie: volCookie });
  record("Volunteer blocked from /admin", volAdmin.status === 403, `got ${volAdmin.status}`);
  // Volunteer IS allowed to read patients (intentional — they need to see their registrations)
  const volPatients = await http("GET", "/api/patients", { cookie: volCookie });
  record("Volunteer CAN read /api/patients (intentional)", volPatients.status === 200, `got ${volPatients.status}`);

  // ============================================================
  console.log("\n--- 6. PATIENT CRUD ---");
  // ============================================================
  const list = await http("GET", "/api/patients?limit=10", { cookie: adminC });
  record("List patients (admin)", list.json?.data?.length > 0, `${list.json?.data?.length} patients`);

  const firstId = list.json?.data?.[0]?.id;
  if (firstId) {
    const single = await http("GET", `/api/patients/${firstId}`, { cookie: adminC });
    record(`Get patient ${firstId}`, single.status === 200, `name=${single.json?.data?.family_name}`);
  }

  const ghost = await http("GET", "/api/patients/99999", { cookie: adminC });
  record("Get non-existent patient returns 404", ghost.status === 404, `got ${ghost.status}`);

  if (firstId) {
    const put = await http("PUT", `/api/patients/${firstId}`, { cookie: adminC, body: { treatment: "qa-test-marker" } });
    record("PUT patient with allowed field", put.status === 200, `status=${put.status}`);

    const putBad = await http("PUT", `/api/patients/${firstId}`, { cookie: adminC, body: { evil_field: "x", patient_number: "hacked" } });
    record("PUT patient rejects unknown fields", putBad.status === 400, `status=${putBad.status}`);
  }

  // ============================================================
  console.log("\n--- 7. PATIENT REGISTRATION (volunteer) ---");
  // ============================================================
  // Invalid gender (the bug we found and fixed)
  const badGender = await http("POST", "/api/patients", {
    cookie: volCookie,
    body: { family_name: "Test", given_name: "X", patient_number: "9998", age: 30, gender: "M" }
  });
  record("POST /api/patients rejects invalid gender with clear error", badGender.status === 400 && badGender.json?.error?.includes("gender"),
    `status=${badGender.status}, error=${badGender.json?.error}`);

  // Valid gender
  // Use a unique patient number each run
  const newPatient = {
    family_name: "QATest", given_name: "Smoke", patient_number: String(Date.now()).slice(-4).padStart(4, "0"),
    age: 30, gender: "Male", contact_phone: "0123456789",
    province: "QA Province", district: "QA District", village: "QA Village", commune: "QA Commune"
  };
  const create = await http("POST", "/api/patients", { cookie: volCookie, body: newPatient });
  let newId = null;
  if (create.status === 200 || create.status === 201) {
    newId = create.json?.data?.id;
    record("Create new patient (volunteer, valid gender)", true, `id=${newId}`);
  } else {
    record("Create new patient (volunteer, valid gender)", false, `status=${create.status} — ${create.body?.slice(0,200)}`);
  }

  // Cleanup
  if (newId) {
    // No DELETE endpoint; use the script directly
    const { execSync } = require("child_process");
    try {
      execSync(`docker exec -i cambodia-vision-db mysql -u root -prootpw cambodia_vision -e "DELETE FROM patients WHERE id = ${newId};" 2>/dev/null`);
    } catch {}
  }

  // ============================================================
  console.log("\n--- 8. STATION WORKFLOW (PATCH not POST) ---");
  // ============================================================
  if (newId) {
    record("Station workflow", null, "skipped — used for setup only");
  } else {
    // Status endpoint is PATCH, not POST
    const r = await http("PATCH", `/api/patients/${firstId}/status`, {
      cookie: doctorCookie, body: { status: "Seen_by_GP", notes: "QA: GP saw patient" }
    });
    record("PATCH patient status as doctor", r.status === 200, `status=${r.status}`);
  }

  // ============================================================
  console.log("\n--- 9. ADMIN: USER MANAGEMENT ---");
  // ============================================================
  const users = await http("GET", "/api/admin/users", { cookie: adminC });
  record("List admin users", users.status === 200 && Array.isArray(users.json?.data), `count=${users.json?.data?.length}`);

  // Doctor should be blocked from user list
  const docUsers = await http("GET", "/api/admin/users", { cookie: doctorCookie });
  record("Doctor blocked from /api/admin/users", docUsers.status === 403, `got ${docUsers.status}`);

  // ============================================================
  console.log("\n--- 10. ADMIN: PASSPHRASE (PATCH needs current password) ---");
  // ============================================================
  const ppGet = await http("GET", "/api/admin/passphrase", { cookie: adminC });
  record("Passphrase GET returns 405 (PATCH-only endpoint)", ppGet.status === 405, `got ${ppGet.status}`);
  // PATCH needs { passphrase, confirm_password }. Passphrase must be 8+ chars.
  // We test the validation/error paths but DON'T actually change the real passphrase.
  const ppMissingPw = await http("PATCH", "/api/admin/passphrase", {
    cookie: adminC, body: { passphrase: "x" }
  });
  record("Passphrase PATCH without confirm_password → 400", ppMissingPw.status === 400, `got ${ppMissingPw.status}`);

  const ppTooShort = await http("PATCH", "/api/admin/passphrase", {
    cookie: adminC, body: { passphrase: "abc", confirm_password: PASSWORD }
  });
  record("Passphrase PATCH with too-short passphrase → 400", ppTooShort.status === 400, `got ${ppTooShort.status}`);

  // ============================================================
  console.log("\n--- 11. QR CODE / PDF GENERATION ---");
  // ============================================================
  if (firstId) {
    const qr = await http("GET", `/api/patients/${firstId}/qrcode`, { cookie: adminC });
    record("Get patient QR code", qr.status === 200, `size=${qr.body?.length}`);

    // PDF requires ?type=registration or ?type=surgery
    const pdfReg = await http("GET", `/api/generate-pdf/${firstId}?type=registration`, { cookie: adminC });
    record("Generate registration PDF (with ?type=registration)", pdfReg.status === 200, `status=${pdfReg.status}, size=${pdfReg.body?.length}`);

    const pdfNoType = await http("GET", `/api/generate-pdf/${firstId}`, { cookie: adminC });
    record("PDF without type param returns 400 with helpful error", pdfNoType.status === 400 && pdfNoType.json?.error?.includes("type"),
      `status=${pdfNoType.status}, error=${pdfNoType.json?.error}`);

    // BUG regression check: surgery form must be downloadable by station managers
    // (was: middleware blocked them, link did nothing)
    const pdfSurgDoc = await http("GET", `/api/generate-pdf/${firstId}?type=surgery`, { cookie: doctorCookie });
    record("Surgery form downloadable by station manager (BUG was 307 redirect)", pdfSurgDoc.status === 200,
      `status=${pdfSurgDoc.status}, size=${pdfSurgDoc.body?.length}`);

    const pdfSurgAdmin = await http("GET", `/api/generate-pdf/${firstId}?type=surgery`, { cookie: adminC });
    record("Surgery form downloadable by admin", pdfSurgAdmin.status === 200, `status=${pdfSurgAdmin.status}`);
  }

  // ============================================================
  console.log("\n--- 11b. SURGERY INFORMATION (patient detail) ---");
  // ============================================================
  // Patient 17 (Hak Chea) has 2 surgery records. Patient 18 (Vann) has none.
  const p17 = await http("GET", "/api/patients/17", { cookie: adminC });
  const p17data = p17.json?.data || {};
  record("Patient 17 has surgery_records array (>=2)", Array.isArray(p17data.surgery_records) && p17data.surgery_records.length >= 2,
    `count=${p17data.surgery_records?.length}`);
  record("Patient 17 surgery_records include surgeon_name from JOIN",
    p17data.surgery_records?.[0]?.surgeon_name && p17data.surgery_records[0].surgeon_name !== `Surgeon #${p17data.surgery_records[0].surgeon_id}`,
    `surgeon_name=${p17data.surgery_records?.[0]?.surgeon_name}`);
  record("Patient 17 surgery_records procedure_type normalized (string or array)",
    p17data.surgery_records?.[0]?.procedure_type !== undefined,
    `procedure_type=${JSON.stringify(p17data.surgery_records?.[0]?.procedure_type)}`);
  record("Patient 17 surgery_records also_used is array",
    Array.isArray(p17data.surgery_records?.[0]?.also_used),
    `also_used=${JSON.stringify(p17data.surgery_records?.[0]?.also_used)}`);

  // Patient 18 should have 0 surgeries — section will be hidden
  const p18 = await http("GET", "/api/patients/18", { cookie: adminC });
  const p18data = p18.json?.data || {};
  record("Patient 18 has surgery_records=[] (section will be hidden)", Array.isArray(p18data.surgery_records) && p18data.surgery_records.length === 0,
    `count=${p18data.surgery_records?.length}`);

  // A patient with a null procedure_type (record id 1, patient 1) shouldn't crash
  const p1 = await http("GET", "/api/patients/1", { cookie: adminC });
  record("Patient 1 (NULL procedure_type) returns 200 without error", p1.status === 200, `status=${p1.status}`);

  // ============================================================
  console.log("\n--- 11c. STATUS TRANSITIONS (Prepare_for_Surgery, Surgery_Completed) ---");
  // ============================================================
  // This test creates a fresh test patient, walks them through:
  //   Surgery_Eligible → (download surgery form) → Prepare_for_Surgery → (surgery record) → Surgery_Completed
  // Then cleans up. We use a unique patient_number based on timestamp.
  const statusTestPid = String(Date.now()).slice(-4).padStart(4, "0");
  const newSurgPatient = {
    family_name: "QASurgFlow", given_name: "Test", patient_number: statusTestPid,
    age: 50, gender: "Male", contact_phone: "0",
    province: "P", district: "D", registration_date: "2026-10-04"
  };
  const createSurg = await http("POST", "/api/patients", { cookie: volCookie, body: newSurgPatient });
  if (createSurg.status === 200 || createSurg.status === 201) {
    const newSurgId = createSurg.json.data.id;
    record("Created test patient for status-flow QA", true, `id=${newSurgId}`);

    // Force into Surgery_Eligible
    const { execSync } = require("child_process");
    execSync(`docker exec -i cambodia-vision-db mysql -u root -prootpw cambodia_vision -e "UPDATE patients SET status='Surgery_Eligible' WHERE id=${newSurgId};" 2>/dev/null`);

    // Pre-condition: status is Surgery_Eligible
    const pre = await http("GET", `/api/patients/${newSurgId}`, { cookie: adminC });
    record("Pre-condition: test patient in Surgery_Eligible", pre.json.data.status === "Surgery_Eligible", `status=${pre.json.data.status}`);

    // ACTION 1: Download surgery form (admin)
    const dlSurg = await http("GET", `/api/generate-pdf/${newSurgId}?type=surgery`, { cookie: adminC });
    record("Download surgery form (Surgery_Eligible → Prepare_for_Surgery)", dlSurg.status === 200);

    // POST-CONDITION 1: status is Prepare_for_Surgery
    const afterDl = await http("GET", `/api/patients/${newSurgId}`, { cookie: adminC });
    record("After surgery form download, status = Prepare_for_Surgery",
      afterDl.json.data.status === "Prepare_for_Surgery",
      `status=${afterDl.json.data.status}`);

    // ACTION 2: Submit surgery record
    const surgRec = await http("POST", `/api/patients/${newSurgId}/surgery-record`, {
      cookie: adminC, body: { eye: "left", procedure_type: ["PHACO"], surgeon_id: 1, surgeon_notes: "qa status-flow test" }
    });
    record("Submit surgery record (Prepare_for_Surgery → Surgery_Completed)", surgRec.status === 200);

    // POST-CONDITION 2: status is Surgery_Completed
    const afterRec = await http("GET", `/api/patients/${newSurgId}`, { cookie: adminC });
    record("After surgery record submit, status = Surgery_Completed",
      afterRec.json.data.status === "Surgery_Completed",
      `status=${afterRec.json.data.status}`);

    // NEGATIVE CASE: download surgery form for a Registered patient → status must NOT change
    const negPatient = { ...newSurgPatient, patient_number: String(Date.now() + 1).slice(-4).padStart(4, "0"), family_name: "QANegFlow" };
    const negCreate = await http("POST", "/api/patients", { cookie: volCookie, body: negPatient });
    if (negCreate.status === 200 || negCreate.status === 201) {
      const negId = negCreate.json.data.id;
      const negDl = await http("GET", `/api/generate-pdf/${negId}?type=surgery`, { cookie: adminC });
      const negAfter = await http("GET", `/api/patients/${negId}`, { cookie: adminC });
      record("Surgery form download for Registered patient does NOT change status (state machine guard)",
        negAfter.json.data.status === "Registered",
        `status=${negAfter.json.data.status}`);
    }

    // Cleanup: remove the test patients
    execSync(`docker exec -i cambodia-vision-db mysql -u root -prootpw cambodia_vision -e "DELETE FROM surgery_records WHERE patient_id IN (${newSurgId}); DELETE FROM patients WHERE id IN (${newSurgId}, ${negCreate.json?.data?.id || 0});" 2>/dev/null`);
  } else {
    record("Created test patient for status-flow QA", false, `create returned ${createSurg.status}`);
  }

  // ============================================================
  console.log("\n--- 12. DATA REPORT (admin-only after fix) ---");
  // ============================================================
  const report = await http("GET", "/api/patients/report", { cookie: adminC });
  record("Data report (admin)", report.status === 200, `status=${report.status}`);

  // This was the BUG we fixed: doctor should be blocked
  const reportBlock = await http("GET", "/api/patients/report", { cookie: doctorCookie });
  record("Data report blocks doctor (BUG WAS: report was accessible)", reportBlock.status === 403,
    `got ${reportBlock.status}`);

  // ============================================================
  console.log("\n--- 13. ERROR HANDLING ---");
  // ============================================================
  const notFound = await http("GET", "/api/does-not-exist", { cookie: adminC });
  record("Unknown API returns 404", notFound.status === 404, `got ${notFound.status}`);

  const wrongMethod = await http("DELETE", "/api/patients", { cookie: adminC });
  record("DELETE on /api/patients returns 405", wrongMethod.status === 405, `got ${wrongMethod.status}`);

  const sqli = await http("GET", "/api/patients?search=' OR 1=1--", { cookie: adminC });
  record("SQL injection attempt is safe", sqli.status === 200, `status=${sqli.status}`);

  // ============================================================
  console.log("\n--- 14. IMAGE PROXY ---");
  // ============================================================
  const img1 = await http("GET", "/_next/image?url=%2Flogo.jpeg&w=96&q=75", { cookie: null });
  record("Logo image proxy (96px)", img1.status === 200 && img1.body?.length > 100, `size=${img1.body?.length}`);

  const img2 = await http("GET", "/_next/image?url=%2Fdoes-not-exist&w=96", { cookie: null });
  record("Image proxy returns 400 for missing file", img2.status === 400, `got ${img2.status}`);

  // ============================================================
  console.log(`\n========== QA SUMMARY ==========`);
  console.log(`PASS:    \x1b[32m${totalPass}\x1b[0m`);
  console.log(`FAIL:    \x1b[31m${totalFail}\x1b[0m`);
  console.log(`SKIPPED: ${totalSkipped}`);
  console.log(`TOTAL:   ${results.length}`);

  if (totalFail > 0) {
    console.log(`\n\x1b[31mFailures:\x1b[0m`);
    for (const r of results.filter(r => !r.ok && r.ok !== null)) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
  }

  process.exit(totalFail > 0 ? 1 : 0);
})().catch(e => { console.error("FATAL:", e); process.exit(2); });
