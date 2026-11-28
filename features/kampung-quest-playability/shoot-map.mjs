// Dev-only: takes the map screenshots for notes-map.md (radar with icons, full map kampung, full map Makkah
// zoomed in, go-here beacon) on an iPad landscape (1180x820) and a phone portrait (Pixel 7) viewport.
// Run: node tools/serve.mjs 5606 & PW_PORT=5606 node features/kampung-quest-playability/shoot-map.mjs [outDir]
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const PORT = process.env.PW_PORT || 5606;
const OUT = process.argv[2] || "features/kampung-quest-playability/shots";
const GAME = `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low`;
const exe = process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium";
fs.mkdirSync(OUT, { recursive: true });

/** Open the game in a region, start it, daylight. */
async function boot(browser, opts, region) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(GAME + (region === "haramain" ? "&region=haramain" : ""));
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
  await page.locator("#kqStart").click();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__kq.setMinute(600));
  await page.evaluate(() => window.__kq.step(400));
  return page;
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
const kq = (page, fn, arg) => page.evaluate(fn, arg);

/** The kampung: radar close-up, full map, go-here beacon. */
async function kampung(browser, opts, tag) {
  const page = await boot(browser, opts, "kampung");
  await kq(page, () => window.__kq.teleport("hawker"));
  await kq(page, () => window.__kq.step(600));
  await shot(page, `map-${tag}-radar-icons.png`);
  await page.keyboard.press("m");
  await kq(page, () => window.__kq.step(200));
  await shot(page, `map-${tag}-full-kampung.png`);
  await kq(page, () => window.KQ.Game.BigMap.focus("tailor"));
  await page.locator(".kq-bm-card button.primary").click();
  await shot(page, `map-${tag}-go-here-card.png`);
  await page.keyboard.press("Escape");
  await kq(page, () => window.__kq.place(50, 4, 0.85)); // facing the tailor's stall
  await kq(page, () => window.__kq.step(300));
  await shot(page, `map-${tag}-go-here-beacon.png`);
  await page.context().close();
}

/** Makkah: the full map zoomed in on the camel yard. */
async function makkah(browser, opts, tag) {
  const page = await boot(browser, opts, "haramain");
  await page.keyboard.press("m");
  await kq(page, () => window.__kq.step(200));
  await shot(page, `map-${tag}-full-makkah.png`);
  await kq(page, () => window.KQ.Game.BigMap.focus("camel_yard"));
  await shot(page, `map-${tag}-makkah-zoomed-camels.png`);
  await page.context().close();
}

const browser = await chromium.launch({
  executablePath: exe,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const ipad = { viewport: { width: 1180, height: 820 }, hasTouch: true };
const phone = {
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};
await kampung(browser, ipad, "ipad");
await makkah(browser, ipad, "ipad");
await kampung(browser, phone, "phone");
await makkah(browser, phone, "phone");
await browser.close();
