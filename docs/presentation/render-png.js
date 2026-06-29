// scripts/render-presentation-png.js — Convert SVG diagrams to PNG for slides.
// Run once locally: `node scripts/render-presentation-png.js`
// Outputs PNGs alongside the SVG files.

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;

const FILES = [
  { svg: "01-system-overview.svg",  png: "01-system-overview.png",  width: 1600 },
  { svg: "02-patient-journey.svg",   png: "02-patient-journey.png",   width: 1600 },
  { svg: "03-role-admin.svg",        png: "03-role-admin.png",        width: 1300 },
  { svg: "04-role-station-manager.svg", png: "04-role-station-manager.png", width: 1300 },
  { svg: "05-role-volunteer.svg",    png: "05-role-volunteer.png",    width: 1300 },
];

(async () => {
  for (const f of FILES) {
    const svgPath = path.join(DIR, f.svg);
    const pngPath = path.join(DIR, f.png);
    const svg = fs.readFileSync(svgPath, "utf8");
    // Render at 2x for crisp slide display
    const targetWidth = f.width * 2;
    await sharp(Buffer.from(svg))
      .resize({ width: targetWidth, fit: "inside" })
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
    const size = fs.statSync(pngPath).size;
    console.log(`✓ ${f.png}  (${(size / 1024).toFixed(0)} KB, ${targetWidth}px wide)`);
  }
})().catch(e => { console.error(e); process.exit(1); });