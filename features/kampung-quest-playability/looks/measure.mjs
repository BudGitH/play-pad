// Kampung Quest looks (AC-P20): screenshot fixed views per region at 10:00 (plus one 21:00 view)
// and measure mean luminance, mean HSV saturation and the clipped-white share of the 3D canvas
// (the HUD is hidden first). Dev-only.
// Run: node tools/serve.mjs 5604 &   then
//      PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/looks/measure.mjs before
// Writes features/kampung-quest-playability/shots/looks-<tag>-<view>.png and looks/<tag>.json.
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const TAG = process.argv[2] || "now";
const PORT = Number(process.env.PW_PORT || 5604);
const HERE = import.meta.dirname;
const SHOTS = resolve(HERE, "../shots");
const DAY = 600;
const NIGHT = 1260;

/**
 * Fixed views: `eye` / `look` pin the camera (the hero stands at `look`, so the sun's shadow box
 * is there too); without them the follow camera at the spawn is used.
 */
const STREET = { eye: [22, 3.6, -7], look: [22, 1.2, 4] };
const PLAZA = { eye: [0, 3.2, -82], look: [0, 1.2, -70] };
const REGIONS = {
  kampung: [
    { id: "spawn" },
    { id: "street", ...STREET },
    { id: "wide", eye: [52, 14, -2], look: [30, 1, 20] },
    { id: "night", ...STREET, minute: NIGHT },
  ],
  haramain: [
    { id: "spawn" },
    { id: "plaza", ...PLAZA },
    { id: "wide", eye: [60, 28, -130], look: [0, 2, -70] },
    { id: "night", ...PLAZA, minute: NIGHT },
  ],
};

/** Mean luminance (0..255, Rec.709 on display values), mean HSV saturation and clipped share. */
function statsOf(data) {
  let lum = 0;
  let sat = 0;
  let clip = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const mx = Math.max(r, g, b);
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sat += mx ? (mx - Math.min(r, g, b)) / mx : 0;
    if (r >= 250 && g >= 250 && b >= 250) clip++;
  }
  return { lum: lum / n, sat: sat / n, clip: clip / n };
}

/** Decode a PNG buffer in the page and return its RGBA pixels as a plain array. */
async function pixels(page, png) {
  const url = "data:image/png;base64," + png.toString("base64");
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, c.width, c.height).data);
  }, url);
}

/** Boot a region to a running game with the HUD hidden. */
async function boot(browser, region) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const q = `?region=${region}&still=1&autoq=0&q=med`;
  await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html${q}`);
  await page.waitForFunction(() => window.__kq?.loaded, null, { timeout: 150_000 });
  await page.click("#kqStart");
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60_000 });
  await page.addStyleTag({ content: "#kq > *:not(#kqStage){visibility:hidden!important}" });
  return page;
}

/** Frame one view at its minute and return the canvas screenshot. */
async function frame(page, view) {
  await page.evaluate(
    ({ v, m }) => {
      const k = window.__kq;
      const S = window.KQ.Game.S;
      k.setMinute(m);
      if (v.look) k.place(v.look[0], v.look[2], 0);
      k.step(500);
      if (!v.eye) return;
      S.camera.position.set(v.eye[0], v.eye[1], v.eye[2]);
      S.camera.lookAt(v.look[0], v.look[1], v.look[2]);
      S.renderer.render(S.scene, S.camera);
    },
    { v: view, m: view.minute || DAY },
  );
  await page.waitForTimeout(300);
  return page.locator("#kqStage").screenshot();
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
  });
  mkdirSync(SHOTS, { recursive: true });
  const out = {};
  for (const [region, views] of Object.entries(REGIONS)) {
    const page = await boot(browser, region);
    for (const view of views) {
      const png = await frame(page, view);
      const name = `${region}-${view.id}`;
      writeFileSync(resolve(SHOTS, `looks-${TAG}-${name}.png`), png);
      const s = statsOf(await pixels(page, png));
      out[name] = { lum: +s.lum.toFixed(1), sat: +s.sat.toFixed(3), clip: +s.clip.toFixed(4) };
      process.stdout.write(`${name} ${JSON.stringify(out[name])}\n`);
    }
    await page.close();
  }
  await browser.close();
  writeFileSync(resolve(HERE, `${TAG}.json`), JSON.stringify(out, null, 2) + "\n");
}

main().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e) + "\n");
  process.exit(1);
});
