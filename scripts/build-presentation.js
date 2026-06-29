// scripts/build-presentation.js — Build a PowerPoint deck from the SVG diagrams.
// Run from project root:  node scripts/build-presentation.js
// Output: docs/presentation/cambodia-vision-2026-deck.pptx

const path = require("path");
const fs = require("fs");
const PptxGenJS = require("pptxgenjs");

const PRESENTATION_DIR = path.resolve(__dirname, "..", "docs", "presentation");
const OUTPUT = path.join(PRESENTATION_DIR, "cambodia-vision-2026-deck.pptx");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches
pptx.title = "Cambodia Vision 2026 — Patient Management System";
pptx.author = "Cambodia Vision Team";
pptx.company = "Cambodia Vision 2026";
pptx.subject = "Patient management for medical mission trips";

const TEAL = "0F766E";
const TEAL_LIGHT = "F0FDFA";
const NAVY = "1E3A8A";
const AMBER = "92400E";
const GREEN = "065F46";
const SLATE = "374151";
const LIGHT_BG = "F8FAFC";

const SLIDES = [
  {
    title: "Cambodia Vision 2026",
    subtitle: "Patient management for medical mission trips",
    body: [
      { text: "What it is", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "A LAN-deployed web app for registering patients, tracking them through 6 clinical stations, and producing PDF/DOCX records — all on a single laptop, no internet required.", options: { fontSize: 14, color: SLATE, paraSpaceAfter: 12 } },
      { text: "Who uses it", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "• Volunteers at the registration desk", options: { fontSize: 14, color: SLATE } },
      { text: "• Station managers at each clinical station", options: { fontSize: 14, color: SLATE } },
      { text: "• Admins for setup, user management, backups", options: { fontSize: 14, color: SLATE } },
      { text: "Why it matters", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "• Replaces paper-based flow with searchable digital records", options: { fontSize: 14, color: SLATE } },
      { text: "• Photo capture for patient identification", options: { fontSize: 14, color: SLATE } },
      { text: "• Bilingual (English + Khmer) UI for local staff", options: { fontSize: 14, color: SLATE } },
      { text: "• Audit trail + automated daily backups", options: { fontSize: 14, color: SLATE } },
    ],
  },
  {
    image: "01-system-overview.png",
    title: "System Overview",
    subtitle: "How users, devices, the server, and the database fit together",
  },
  {
    image: "02-patient-journey.png",
    title: "Patient Journey",
    subtitle: "From arrival at the registration desk to discharge",
  },
  {
    image: "03-role-admin.png",
    title: "Role: Admin",
    subtitle: "Full system access — setup, user management, backup, reports",
  },
  {
    image: "04-role-station-manager.png",
    title: "Role: Station Manager",
    subtitle: "Runs ONE station — scans patients, records exams, advances care",
  },
  {
    image: "05-role-volunteer.png",
    title: "Role: Volunteer",
    subtitle: "Greets patients, registers them, prints forms — no clinical training needed",
  },
  {
    title: "Key Numbers",
    subtitle: "What we have today",
    bullets: [
      { text: "System capacity", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "Up to 9,999 patients per mission (4-digit patient numbers)", options: { fontSize: 14, color: SLATE } },
      { text: "6 clinical stations: Doctor, Optometry, Refraction, Glasses, Ear Therapy, Surgery", options: { fontSize: 14, color: SLATE } },
      { text: "8-hour auto-logout for unattended tablets", options: { fontSize: 14, color: SLATE, paraSpaceAfter: 12 } },
      { text: "Field deployment", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "Runs on a single Ubuntu server (laptop or small box)", options: { fontSize: 14, color: SLATE } },
      { text: "Self-signed HTTPS certificate (LAN IP auto-detected)", options: { fontSize: 14, color: SLATE } },
      { text: "PM2 supervises the process — auto-restart on crash", options: { fontSize: 14, color: SLATE } },
      { text: "Survives power blips and reconnects automatically", options: { fontSize: 14, color: SLATE, paraSpaceAfter: 12 } },
      { text: "Data safety", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "Bcrypt password hashing (12-round cost factor)", options: { fontSize: 14, color: SLATE } },
      { text: "Rate-limited login (10 attempts / 15 min) with Retry-After", options: { fontSize: 14, color: SLATE } },
      { text: "One-click SQL backup with credentials redacted", options: { fontSize: 14, color: SLATE } },
      { text: "Nightly mysqldump cron + weekly restore drill (recommended)", options: { fontSize: 14, color: SLATE } },
    ],
  },
  {
    title: "How to Use This Deck",
    subtitle: "Pick the slide that fits the audience",
    bullets: [
      { text: "→ For management", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "Slide 1 (intro) + Slide 2 (system overview) + Slide 7 (key numbers)", options: { fontSize: 14, color: SLATE, paraSpaceAfter: 12 } },
      { text: "→ For clinicians & station managers", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "Slide 3 (patient journey) + Slides 5–6 (station manager + volunteer)", options: { fontSize: 14, color: SLATE, paraSpaceAfter: 12 } },
      { text: "→ For IT / setup lead", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "Slide 2 (system overview) + Slide 4 (admin) + docs/DEPLOYMENT.md in the repo", options: { fontSize: 14, color: SLATE, paraSpaceAfter: 12 } },
      { text: "→ For volunteers (training)", options: { bold: true, color: TEAL, fontSize: 18 } },
      { text: "Slide 3 (patient journey) + Slide 6 (volunteer role)", options: { fontSize: 14, color: SLATE } },
    ],
  },
];

(async () => {
  for (let i = 0; i < SLIDES.length; i++) {
    const s = SLIDES[i];
    const slide = pptx.addSlide();

    // Header bar
    slide.background = { color: LIGHT_BG };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.9,
      fill: { color: TEAL }, line: { color: TEAL },
    });
    slide.addText("Cambodia Vision 2026", {
      x: 0.5, y: 0.15, w: 7, h: 0.6,
      fontSize: 22, bold: true, color: "FFFFFF", fontFace: "Calibri",
    });
    slide.addText(s.title, {
      x: 7.5, y: 0.18, w: 5.3, h: 0.55,
      fontSize: 14, color: "A7F3D0", align: "right", fontFace: "Calibri",
    });

    // Title + subtitle
    slide.addText(s.title, {
      x: 0.5, y: 1.0, w: 12.3, h: 0.55,
      fontSize: 28, bold: true, color: TEAL, fontFace: "Calibri",
    });
    if (s.subtitle) {
      slide.addText(s.subtitle, {
        x: 0.5, y: 1.55, w: 12.3, h: 0.4,
        fontSize: 14, italic: true, color: SLATE, fontFace: "Calibri",
      });
    }

    if (s.image) {
      // Image slide — diagram fills the rest of the slide
      const imgPath = path.join(PRESENTATION_DIR, s.image);
      if (!fs.existsSync(imgPath)) {
        console.warn(`Missing image: ${imgPath}`);
        continue;
      }
      const imgW = 12.0;
      const imgH = 5.0;
      const x = (13.33 - imgW) / 2;
      const y = 2.05;
      slide.addImage({ path: imgPath, x, y, w: imgW, h: imgH });
      slide.addText(`Source: docs/presentation/${s.image.replace(/\.png$/, ".svg")} (vector source, editable)`,
        { x: 0.5, y: 7.15, w: 12.3, h: 0.25, fontSize: 10, color: "94a3b8", italic: true, fontFace: "Calibri" });
    } else if (s.bullets) {
      // Bullets slide — render rich text
      slide.addText(s.bullets, {
        x: 0.7, y: 2.1, w: 11.9, h: 4.8,
        fontFace: "Calibri", fontSize: 14, color: SLATE,
        valign: "top",
      });
    } else if (s.body) {
      // Rich body slide
      slide.addText(s.body, {
        x: 0.7, y: 2.1, w: 11.9, h: 4.8,
        fontFace: "Calibri", fontSize: 14, color: SLATE,
        valign: "top",
      });
    }

    // Footer
    slide.addText("Cambodia Vision 2026 — slide " + (i + 1) + " of " + SLIDES.length, {
      x: 0.5, y: 7.3, w: 12.3, h: 0.2,
      fontSize: 9, color: "94a3b8", align: "right", italic: true, fontFace: "Calibri",
    });

    // Add speaker notes for the slide
    if (s.notes) {
      slide.addNotes(s.notes);
    }
  }

  await pptx.writeFile({ fileName: OUTPUT });
  console.log("✓ Wrote " + OUTPUT);
  console.log("  " + SLIDES.length + " slides");
})().catch(e => { console.error(e); process.exit(1); });