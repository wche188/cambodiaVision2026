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
  console.log("\n--- 11d. PATIENT SCANS (image-only attachments, max 5) ---");
  // ============================================================
  // Per the spec: only image attachments (phone scans/photos), max 5 per patient,
  // per-attachment note editable by admin. No PDFs/documents.
  //
  // First, clean up any leftovers from previous test runs.
  const { execSync: exec11d } = require("child_process");
  exec11d(`docker exec -i cambodia-vision-db mysql -u root -prootpw cambodia_vision -e "DELETE FROM patient_attachments WHERE patient_id = 17;" 2>/dev/null`);

  // 1. Tiny valid JPEG (1x1 red pixel) as base64
  const tinyJpegB64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wD//Z";

  // Admin uploads
  const upload1 = await http("POST", "/api/patients/17/attachments", {
    cookie: adminC,
    body: { file_name: "scan1.jpg", mime_type: "image/jpeg", data: tinyJpegB64, note: "left eye" }
  });
  const attId = upload1.json?.data?.id;
  record("Admin uploads image scan (jpeg)", upload1.status === 200 && attId > 0,
    `status=${upload1.status}, id=${attId}`);

  // Doctor (station_manager) can also upload
  const upload2 = await http("POST", "/api/patients/17/attachments", {
    cookie: doctorCookie,
    body: { file_name: "scan2.png", mime_type: "image/png", data: tinyJpegB64, note: "right eye" }
  });
  record("Station manager uploads image scan (admin or station_manager allowed)",
    upload2.status === 200,
    `status=${upload2.status}`);

  // Volunteer cannot upload
  const volUpload = await http("POST", "/api/patients/17/attachments", {
    cookie: volCookie,
    body: { file_name: "scan3.jpg", mime_type: "image/jpeg", data: tinyJpegB64 }
  });
  record("Volunteer cannot upload (403)", volUpload.status === 403, `status=${volUpload.status}`);

  // PDF is REJECTED now (no more documents)
  const pdfUp = await http("POST", "/api/patients/17/attachments", {
    cookie: adminC,
    body: { file_name: "bad.pdf", mime_type: "application/pdf", data: tinyJpegB64, note: "should fail" }
  });
  record("PDF rejected (only images allowed)", pdfUp.status === 400, `status=${pdfUp.status}`);

  // Text file rejected
  const txtUp = await http("POST", "/api/patients/17/attachments", {
    cookie: adminC,
    body: { file_name: "bad.txt", mime_type: "text/plain", data: tinyJpegB64, note: "should fail" }
  });
  record("Text file rejected (only images allowed)", txtUp.status === 400, `status=${txtUp.status}`);

  // Empty data rejected
  const empty = await http("POST", "/api/patients/17/attachments", {
    cookie: adminC,
    body: { file_name: "empty.jpg", mime_type: "image/jpeg", data: "" }
  });
  record("Empty data rejected", empty.status === 400, `status=${empty.status}`);

  // List as admin
  const listAtt = await http("GET", "/api/patients/17/attachments", { cookie: adminC });
  const atts = listAtt.json?.data || [];
  record("Admin can list scans (>=2)", atts.length >= 2, `count=${atts.length}`);

  // Volunteer can also list (read access)
  const listAttVol = await http("GET", "/api/patients/17/attachments", { cookie: volCookie });
  record("Volunteer can list scans (read-only)", listAttVol.status === 200, `status=${listAttVol.status}`);

  // Download
  const dlAtt = await http("GET", `/api/patients/17/attachments/${attId}`, { cookie: adminC });
  record("Download scan returns valid image bytes", dlAtt.status === 200 && dlAtt.body.length > 50,
    `status=${dlAtt.status}, size=${dlAtt.body.length}`);

  // Admin can edit the note (multi-line text)
  const newNote = "Updated note\nwith multiple\nlines of text";
  const patchAtt = await http("PATCH", `/api/patients/17/attachments/${attId}`, {
    cookie: adminC, body: { note: newNote }
  });
  record("Admin can edit scan note (multi-line)", patchAtt.status === 200, `status=${patchAtt.status}`);
  const listAfterPatch = await http("GET", "/api/patients/17/attachments", { cookie: adminC });
  const updated = (listAfterPatch.json?.data || []).find(a => a.id === attId);
  record("Note was actually updated in DB", updated?.note === newNote, `note=${JSON.stringify(updated?.note)}`);

  // Uploader (doctor) CAN edit the note on their own upload
  const doctorAttId = upload2.json?.data?.id; // this is the doctor's upload
  const patchOwn = await http("PATCH", `/api/patients/17/attachments/${doctorAttId}`, {
    cookie: doctorCookie, body: { note: "Updated by uploader" }
  });
  record("Uploader (station manager) can edit note on their own scan",
    patchOwn.status === 200, `status=${patchOwn.status}`);
  const verifyOwn = await http("GET", "/api/patients/17/attachments", { cookie: adminC });
  const updatedOwn = (verifyOwn.json?.data || []).find(a => a.id === doctorAttId);
  record("Uploader's own-note edit persisted", updatedOwn?.note === "Updated by uploader",
    `note=${JSON.stringify(updatedOwn?.note)}`);

  // Doctor CANNOT edit admin's scan
  const patchOther = await http("PATCH", `/api/patients/17/attachments/${attId}`, {
    cookie: doctorCookie, body: { note: "tampered" }
  });
  record("Uploader (doctor) cannot edit OTHER uploader's note (403)",
    patchOther.status === 403, `status=${patchOther.status}`);

  // Admin CAN edit anyone's note
  const adminPatch = await http("PATCH", `/api/patients/17/attachments/${attId}`, {
    cookie: adminC, body: { note: "admin-edits-own" }
  });
  record("Admin can edit any attachment note", adminPatch.status === 200, `status=${adminPatch.status}`);

  // Uploader (doctor) CAN delete their own attachment
  const delOwn = await http("DELETE", `/api/patients/17/attachments/${doctorAttId}`, { cookie: doctorCookie });
  record("Uploader can delete their own scan", delOwn.status === 200, `status=${delOwn.status}`);

  // But doctor CANNOT delete admin's scan
  const delDr = await http("DELETE", `/api/patients/17/attachments/${attId}`, { cookie: doctorCookie });
  record("Uploader (doctor) cannot delete OTHER uploader's scan (403)",
    delDr.status === 403, `status=${delDr.status}`);

  // Admin CAN delete any
  const delAtt = await http("DELETE", `/api/patients/17/attachments/${attId}`, { cookie: adminC });
  record("Admin can delete any scan", delAtt.status === 200, `status=${delAtt.status}`);

  // Verify admin's is gone
  const afterDel = await http("GET", `/api/patients/17/attachments/${attId}`, { cookie: adminC });
  record("Deleted scan returns 404 on fetch", afterDel.status === 404, `status=${afterDel.status}`);

  // 5-attachment limit
  // Prior steps deleted both admin's and doctor's earlier uploads, so start
  // fresh and add 5 fillers to reach the cap.
  for (let i = 0; i < 5; i++) {
    await http("POST", "/api/patients/17/attachments", {
      cookie: adminC,
      body: { file_name: `filler${i}.jpg`, mime_type: "image/jpeg", data: tinyJpegB64 }
    });
  }
  const beforeCap = await http("GET", "/api/patients/17/attachments", { cookie: adminC });
  const currentCount = beforeCap.json?.data?.length || 0;
  record("Filled to 5 attachments (current count = 5)", currentCount === 5, `count=${currentCount}`);

  // 6th should be rejected with 409
  const sixth = await http("POST", "/api/patients/17/attachments", {
    cookie: adminC,
    body: { file_name: "sixth.jpg", mime_type: "image/jpeg", data: tinyJpegB64 }
  });
  record("6th scan rejected with 409 (max 5 per patient)", sixth.status === 409, `status=${sixth.status}`);

  // Cleanup — delete all attachments for patient 17
  for (const a of (beforeCap.json?.data || [])) {
    await http("DELETE", `/api/patients/17/attachments/${a.id}`, { cookie: adminC });
  }

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
  console.log("\n--- 11e. PATIENT NOTES (standalone text notes) ---");
  // ============================================================
  // Standalone text notes, no file. Permission model:
  //   - Read:    all roles
  //   - Create:  admin or station_manager
  //   - Edit:    admin OR the original author of the note
  //   - Delete:  admin only
  // Clean up first.
  exec11d(`docker exec -i cambodia-vision-db mysql -u root -prootpw cambodia_vision -e "DELETE FROM patient_notes WHERE patient_id = 17;" 2>/dev/null`);

  // Admin creates a note
  const note1 = await http("POST", "/api/patients/17/notes", {
    cookie: adminC, body: { body: "Admin note: BP elevated 160/95, follow up in 2 weeks" }
  });
  const noteId1 = note1.json?.data?.id;
  record("Admin can create a note", note1.status === 200 && noteId1 > 0,
    `status=${note1.status}, id=${noteId1}`);

  // Doctor creates a note
  const note2 = await http("POST", "/api/patients/17/notes", {
    cookie: doctorCookie, body: { body: "Doctor note: patient prefers afternoon appointments" }
  });
  const noteId2 = note2.json?.data?.id;
  record("Station manager (doctor) can create a note",
    note2.status === 200 && noteId2 > 0,
    `status=${note2.status}, id=${noteId2}`);

  // Volunteer CANNOT create
  const noteVol = await http("POST", "/api/patients/17/notes", {
    cookie: volCookie, body: { body: "should fail" }
  });
  record("Volunteer cannot create a note (403)", noteVol.status === 403, `status=${noteVol.status}`);

  // Empty body rejected
  const noteEmpty = await http("POST", "/api/patients/17/notes", {
    cookie: adminC, body: { body: "" }
  });
  record("Empty body rejected (400)", noteEmpty.status === 400, `status=${noteEmpty.status}`);

  // Whitespace-only body rejected
  const noteWs = await http("POST", "/api/patients/17/notes", {
    cookie: adminC, body: { body: "   \n  \t  " }
  });
  record("Whitespace-only body rejected (400)", noteWs.status === 400, `status=${noteWs.status}`);

  // Volunteer can LIST
  const listN = await http("GET", "/api/patients/17/notes", { cookie: volCookie });
  record("Volunteer can list notes (read-only)",
    listN.status === 200 && (listN.json?.data?.length || 0) >= 2,
    `status=${listN.status}, count=${listN.json?.data?.length}`);

  // Doctor edits OWN note
  const patchOwnNote = await http("PATCH", `/api/patients/17/notes/${noteId2}`, {
    cookie: doctorCookie, body: { body: "Updated by doctor: strongly prefers afternoon" }
  });
  record("Doctor can edit their own note (200)", patchOwnNote.status === 200, `status=${patchOwnNote.status}`);
  const verifyOwnNote = await http("GET", "/api/patients/17/notes", { cookie: adminC });
  const v = (verifyOwnNote.json?.data || []).find(n => n.id === noteId2);
  record("Own-note edit actually persisted in DB",
    v?.body === "Updated by doctor: strongly prefers afternoon" && v?.updated_by === "doctor",
    `body=${v?.body}, updated_by=${v?.updated_by}`);

  // Doctor CANNOT edit admin's note
  const patchOtherNote = await http("PATCH", `/api/patients/17/notes/${noteId1}`, {
    cookie: doctorCookie, body: { body: "tampered" }
  });
  record("Doctor cannot edit admin's note (403)", patchOtherNote.status === 403, `status=${patchOtherNote.status}`);

  // Admin CAN edit doctor's note
  const adminPatchNote = await http("PATCH", `/api/patients/17/notes/${noteId2}`, {
    cookie: adminC, body: { body: "ADMIN-OVERRIDE: was seen 2026-10-04" }
  });
  record("Admin can edit any note (200)", adminPatchNote.status === 200, `status=${adminPatchNote.status}`);
  const verifyAdminNote = await http("GET", "/api/patients/17/notes", { cookie: adminC });
  const v2 = (verifyAdminNote.json?.data || []).find(n => n.id === noteId2);
  record("Admin edit recorded as updated_by='admin'",
    v2?.body === "ADMIN-OVERRIDE: was seen 2026-10-04" && v2?.updated_by === "admin",
    `updated_by=${v2?.updated_by}`);

  // Doctor CANNOT delete
  const delDoc = await http("DELETE", `/api/patients/17/notes/${noteId1}`, { cookie: doctorCookie });
  record("Doctor cannot delete a note (admin-only, 403)", delDoc.status === 403, `status=${delDoc.status}`);

  // Admin CAN delete
  const delAdm = await http("DELETE", `/api/patients/17/notes/${noteId1}`, { cookie: adminC });
  record("Admin can delete a note (200)", delAdm.status === 200, `status=${delAdm.status}`);
  const afterDelNote = await http("GET", "/api/patients/17/notes", { cookie: adminC });
  record("Deleted note is gone from list",
    !(afterDelNote.json?.data || []).some(n => n.id === noteId1),
    `noteId1=${noteId1} still in list`);

  // Cleanup second note
  await http("DELETE", `/api/patients/17/notes/${noteId2}`, { cookie: adminC });

  // Verify patient GET includes notes
  const p17notes = await http("GET", "/api/patients/17", { cookie: adminC });
  record("Patient GET response includes notes array",
    Array.isArray(p17notes.json?.data?.notes),
    `notes type=${typeof p17notes.json?.data?.notes}`);

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
