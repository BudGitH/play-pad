// Dev-only: the Singapore-estate screenshots for notes-sg.md (HDB block from the street, void deck
// inside, hawker centre inside / outside, a wide estate view) at 10:00, q=med, HUD shown, plus the
// low-tier draw calls at the hawker centre and the void deck (follow camera).
// Run: node tools/serve.mjs 5612 & PW_PORT=5612 node features/kampung-quest-playability/shoot-sg.mjs <tag>
// <tag> = "before" | "after" -> shots/sg-before-<view>.png or shots/sg-<view>.png.
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const PORT = process.env.PW_PORT || 5612;
const TAG = process.argv[2] || "after";
const OUT = "features/kampung-quest-playability/shots";
const exe = process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const ONLY = process.argv[3] || "";

/** Fixed views: the hero stands at `stand`; the camera is pinned at `eye` looking at `look`. */
const VIEWS = [
  { id: "hdb-street", stand: [-26, 3], eye: [-43, 1.7, -4], look: [-40, 14, 16] },
  { id: "void-deck", stand: [-44, 20.5], eye: [-53, 1.65, 19.2], look: [-36, 1.3, 21.5] },
  { id: "hawker-inside", stand: [24, -17], eye: [30, 2.0, -13.5], look: [22, 1.6, -28] },
  { id: "hawker-outside", stand: [8, -6], eye: [6, 3.2, -1], look: [26, 3, -22] },
  { id: "estate-wide", stand: [-10, 10], eye: [20, 34, 70], look: [-24, 4, 20] },
];
const CALLS = [
  { id: "hawker", x: 26, z: -17, yaw: Math.PI },
  { id: "void-deck", x: -44, z: 20.5, yaw: Math.PI / 2 },
];

/** Boot the kampung at a quality tier and set 10:00. */
async function boot(browser, q) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on("pageerror", (e) => process.stdout.write(`pageerror: ${e.message}\n`));
  await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=${q}`);
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 180000 });
  await page.click("#kqStart");
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__kq.setMinute(600));
  await page.evaluate(() => window.__kq.step(400));
  return page;
}

/** Pin the camera on one view and render once. */
async function frame(page, v) {
  await page.evaluate((v) => {
    const k = window.__kq;
    const S = window.KQ.Game.S;
    k.setMinute(600);
    k.place(v.stand[0], v.stand[1], 0);
    k.step(600);
    S.camera.position.set(v.eye[0], v.eye[1], v.eye[2]);
    S.camera.lookAt(v.look[0], v.look[1], v.look[2]);
    S.renderer.render(S.scene, S.camera);
  }, v);
  await page.waitForTimeout(300);
  const name = TAG === "before" ? `sg-before-${v.id}.png` : `sg-${v.id}.png`;
  await page.screenshot({ path: path.join(OUT, name) });
}

/** Low tier, follow camera: draw calls (incl. the shadow pass) at a spot. */
async function calls(page, c) {
  return page.evaluate((c) => {
    const k = window.__kq;
    k.place(c.x, c.z, c.yaw);
    k.step(800);
    return k.stats().calls;
  }, c);
}

const browser = await chromium.launch({
  executablePath: exe,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
fs.mkdirSync(OUT, { recursive: true });
if (ONLY !== "calls") {
  const page = await boot(browser, "med");
  for (const v of VIEWS) if (!ONLY || ONLY === v.id) await frame(page, v);
  await page.close();
}
if (!ONLY || ONLY === "calls") {
  const low = await boot(browser, "low");
  const out = {};
  for (const c of CALLS) out[c.id] = await calls(low, c);
  process.stdout.write(`${TAG} low-tier calls ${JSON.stringify(out)}\n`);
  await low.close();
}
await browser.close();
