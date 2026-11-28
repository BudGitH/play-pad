// Dev-only: screenshots of the instruction cards (open, minimised chip) at iPad and phone sizes.
// Run: PW_PORT=5607 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/shoot-cards.mjs [tag]
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "shots");
const PORT = process.env.PW_PORT || "5607";
const TAG = process.argv[2] || "";
const SIZES = {
  ipad: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true },
  phone: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  portrait: { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true },
};
const url = `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low&region=haramain`;

async function boot(browser, ctxOpts) {
  const ctx = await browser.newContext({ ...ctxOpts, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 150000 });
  await page.locator("#kq button.primary").first().click();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__kq.step(500));
  return page;
}

async function toTawaf(page) {
  await page.evaluate(() => {
    window.__kq.setMinute(420);
    window.__kq.openRite("umrah");
  });
  for (let i = 0; i < 80; i += 1) {
    const s = await page.evaluate(() => window.__kq.ritual().step);
    if (s === "tawaf") break;
    await page.locator(".kq-step-next").click();
  }
  await page.evaluate(() => window.__kq.step(300));
}

/** Wudu "right here" from the Pray card, minimised to its chip. */
async function wuduChip(page, name) {
  await page.evaluate(() => {
    window.__kq.place(0, -95, 0);
    window.__kq.forcePrayer("zohor");
    window.__kq.step(300);
  });
  await page.locator("#kqStatus").click();
  await page.locator(".kq-pray-here").click();
  await page.locator(".kq-wudu-act").click();
  await shot(page, `${name}-wudu-open`);
  await page.locator(".kq-minimise").click();
  await page.evaluate(() => window.__kq.step(300));
  await shot(page, `${name}-wudu-chip`);
}

const shot = (page, name) => page.screenshot({ path: join(OUT, `cards-${name}${TAG}.png`) });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
for (const [name, opts] of Object.entries(SIZES)) {
  const page = await boot(browser, opts);
  await toTawaf(page);
  await shot(page, `${name}-tawaf-open`);
  const min = page.locator(".kq-minimise");
  if (await min.count()) {
    await min.click();
    await page.evaluate(() => window.__kq.step(300));
    await shot(page, `${name}-tawaf-chip`);
  }
  await page.evaluate(() => {
    window.KQ.Game.RitualUI.active.close("shoot");
    window.KQ.Game.UI.closeSheet("shoot");
  });
  await page.evaluate(() => window.__kq.step(300));
  await shot(page, `${name}-tawaf-notnow-chip`);
  await wuduChip(page, name);
  await page.context().close();
}
await browser.close();
