// Dev-only: screenshots of the Kampung Quest HUD (desktop, iPhone landscape, iPad) for the HUD redesign.
// Run: node tools/serve.mjs 5599 &  then  PW_CHROMIUM_PATH=/usr/bin/google-chrome node features/kampung-quest-haramain/shoot-hud.mjs <prefix>
import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:5599";
const prefix = process.argv[2] || "after";
const out = (n) => resolve("features/kampung-quest-haramain/shots", `hud-${prefix}-${n}.png`);
const VIEWS = [
  ["desktop", 1280, 720, false],
  ["iphone-landscape", 844, 390, true],
  ["ipad", 1180, 820, true],
  ["iphone-portrait", 390, 844, true],
];
const ARGS = ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"];
const only = process.argv[3];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ARGS });
for (const [name, width, height, touch] of VIEWS) {
  if (only && only !== name) continue;
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto(BASE + "/games/kampung-quest/index.html?still=1&autoq=0" + (process.env.REGION ? "&region=" + process.env.REGION : ""));
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 90000 });
  await page.locator("#kqStart").click();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__kq.step(400));
  await page.evaluate(() => { window.KQ.Game.S.sim.missions.accept("recycling_hero"); window.__kq.step(300); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out(name + "-explore") });
  await page.evaluate(() => { window.KQ.Game.S.sim.needs.restore({ hunger: 18, energy: 12 }); window.__kq.step(400); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out(name + "-low") });
  await page.evaluate(() => { window.KQ.Game.S.sim.needs.restore({ hunger: 80, energy: 90 }); window.__kq.forcePrayer("zohor"); window.__kq.step(600); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out(name + "-prayer") });
  await ctx.close();
}
await browser.close();
