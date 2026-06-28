// scripts/seed-patients.js — Seed 100 mock patients for development/testing.
//
// Inserts directly into the database (bypasses the API for speed and idempotency).
// Skips patients whose patient_number already exists. Safe to re-run.
//
// Usage on the server:
//   cd /home/ubuntu/cambodia-vision
//   set -a && source .env.production && set +a
//   node scripts/seed-patients.js              # default: 100 patients
//   node scripts/seed-patients.js --count 250 # custom count (max 9999)
//   node scripts/seed-patients.js --count 100 --wipe   # delete existing first

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

// Arg parsing
const args = process.argv.slice(2);
let count = 100;
let wipe = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--count") count = parseInt(args[++i], 10);
  else if (args[i] === "--wipe") wipe = true;
}

// Cambodian provinces (subset of data/cambodiaLocations.js)
const PROVINCES = [
  { name: "Phnom Penh", districts: ["Chamkarmon", "Daun Penh", "Prampir Makara", "Toul Kouk", "Russey Keo"] },
  { name: "Siem Reap", districts: ["Siem Reap", "Sotr Nikum", "Chi Kraeng", "Kralanh", "Prasat Bakong"] },
  { name: "Battambang", districts: ["Battambang", "Banan", "Thma Koul", "Bavel", "Ek Phnom"] },
  { name: "Kampong Cham", districts: ["Kampong Cham", "Kampong Siem", "Cheung Prey", "Prey Chhor", "Srei Santhor"] },
  { name: "Takeo", districts: ["Doun Kaev", "Bati", "Tram Kak", "Angkor Borei", "Kirivong"] },
  { name: "Kandal", districts: ["Ta Khmau", "Kien Svay", "Khsach Kandal", "Ponhea Leu", "Mukh Kampul"] },
  { name: "Svay Rieng", districts: ["Svay Rieng", "Bavet", "Kampong Rou", "Romeas Haek", "Chantrea"] },
  { name: "Prey Veng", districts: ["Prey Veng", "Kampong Leav", "Peam Ro", "Sithor Kandal", "Kanhchriech"] },
  { name: "Kampot", districts: ["Kampot", "Bokor", "Chhuk", "Chum Kiri", "Angkor Chey"] },
  { name: "Koh Kong", districts: ["Koh Kong", "Botum Sakor", "Kiri Sakor", "Smach Meanchey", "Sre Ambel"] },
  { name: "Banteay Meanchey", districts: ["Serei Saophoan", "Poipet", "Phnum Srok", "Preah Netr Preah", "Thma Puok"] },
  { name: "Pursat", districts: ["Pursat", "Bakan", "Krakor", "Phnum Kravanh", "Sampov Meas"] },
];

// Common Khmer surnames + given names (transliterated)
const SURNAMES = ["Sok", "Chea", "Chan", "Touch", "Lim", "Heng", "Sun", "Mao", "Tith", "Chhim", "Yim", "Leng", "Sann", "Pich", "Rith", "Vann", "Noun", "Khem"];
const GIVEN_M = ["Vireak", "Sovann", "Dara", "Pisey", "Bunthorn", "Sothea", "Chetra", "Ratanak", "Visal", "Theary"];
const GIVEN_F = ["Sreypov", "Channary", "Sokha", "Pisey", "Maly", "Sovannary", "Bopha", "Kanitha", "Leakhena", "Sreymom"];

const VILLAGE_PREFIXES = ["Wat", "Svay", "Prey", "Ta", "Kampong", "Chrey", "Kbal", "Phum", "Rum", "Sala"];
const VILLAGE_SUFFIXES = ["Kandal", "Chas", "Thom", "Cheung", "Tboung", "Leu", "Kraom", "Mean", "Reach", "Banteay"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pad(n, w) { return String(n).padStart(w, "0"); }
function randomAge() { return Math.floor(Math.random() * 85) + 1; } // 1..85
function randomPhone() { return "+855 " + (10 + Math.floor(Math.random() * 90)) + " " + pad(Math.floor(Math.random() * 1000), 3) + " " + pad(Math.floor(Math.random() * 1000), 3); }
function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString().slice(0, 10);
}
function randomGender(age) {
  if (age < 12) return "Child";
  return Math.random() < 0.5 ? "Male" : "Female";
}
function randomVillage() { return `${pick(VILLAGE_PREFIXES)} ${pick(VILLAGE_SUFFIXES)}`; }
function randomReason() {
  const reasons = [
    "Cataract - left eye", "Cataract - right eye", "Cataract - both eyes",
    "Pterygium", "Glaucoma screening", "Reading glasses",
    "Distance glasses", "Ear infection", "Hearing check",
    "Diabetic retinopathy", "Eye irritation", "Routine check",
  ];
  return pick(reasons);
}

async function main() {
  if (count < 1 || count > 9999) {
    console.error("ERROR: --count must be 1..9999"); process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  if (wipe) {
    console.log("Wiping existing patients + related rows...");
    // FK constraints cascade-delete via status_history, gp_examinations, surgery_decisions
    await conn.query("DELETE FROM surgery_records");
    await conn.query("DELETE FROM patients");
    console.log("  wiped.");
  }

  // Find a starting patient_number that doesn't collide
  const [taken] = await conn.query(
    "SELECT patient_number FROM patients WHERE patient_number REGEXP '^[0-9]{4}$'"
  );
  const takenNums = new Set(taken.map(r => parseInt(r.patient_number, 10)));
  const freeNums = [];
  for (let n = 1; n <= 9999 && freeNums.length < count; n++) {
    if (!takenNums.has(n)) freeNums.push(n);
  }
  if (freeNums.length < count) {
    console.error(`Only ${freeNums.length} free patient_numbers remain (need ${count}).`);
    process.exit(1);
  }

  console.log(`Seeding ${count} mock patients...`);
  let inserted = 0;
  for (let i = 0; i < count; i++) {
    const age = randomAge();
    const gender = randomGender(age);
    const province = pick(PROVINCES);
    const district = pick(province.districts);
    const isPregnant = (gender === "Female" && age >= 13 && age <= 50) ? (Math.random() < 0.15 ? "Yes" : "No") : "No";
    const hasTb = Math.random() < 0.05;
    const registrationDate = randomDate(45); // up to 45 days back

    const values = [
      pad(freeNums[i], 4),                                  // patient_number
      gender,                                                // gender
      isPregnant,                                            // is_pregnant
      pick(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", null]), // blood_group
      pick(SURNAMES),                                        // family_name
      gender === "Child" ? null : pick(gender === "Male" ? GIVEN_M : GIVEN_F), // given_name
      age,                                                   // age
      hasTb ? 1 : 0,                                         // has_tb
      randomPhone(),                                         // contact_phone
      province.name,                                         // province
      district,                                              // district
      randomVillage(),                                       // village
      randomVillage(),                                       // commune
      randomReason(),                                        // reason_for_visit
      null,                                                  // photo
      registrationDate,                                      // registration_date
    ];

    await conn.query(
      "INSERT INTO patients (patient_number, gender, is_pregnant, blood_group, family_name, given_name, age, has_tb, contact_phone, province, district, village, commune, reason_for_visit, photo, registration_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')",
      values
    );
    inserted++;
  }

  // Status breakdown
  const [breakdown] = await conn.query(
    "SELECT status, COUNT(*) AS n FROM patients GROUP BY status ORDER BY status"
  );
  console.log("");
  console.log(`✓ Inserted ${inserted} patients.`);
  console.log("Status breakdown:");
  for (const r of breakdown) {
    console.log(`  ${r.status.padEnd(20)} ${r.n}`);
  }
  console.log("");
  console.log(`Try the dashboard: https://<server>/`);
  await conn.end();
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
