// Dev-only: the azan card and its pill with a toast up, at the portrait sizes the HUD spec covers.
// Prints every overlapping HUD pair; screenshots to shots/hud-azan-<tag>-<size>-{card,pill}.png.
// Run: PW_PORT=5619 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/shoot-hud-azan.mjs before|after
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "shots");
const PORT = process.env.PW_PORT || "5619";
const TAG = process.argv[2] || "after";
const SIZES = {
  "ipad-portrait": [820, 1180],
  "narrow-phone": [360, 740],
  "android-360": [360, 640],
  "small-phone-320": [320, 568],
};
const TOAST = "Nenek is waiting by your block. Walk to her and press Talk.";
const url = `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0`;

const BOXES = () => {
  const sel =
    "#kq .kq-hud button,#kq .kq-hud [tabindex='0'],.kq-mission,.kq-coins,.kq-needs,.kq-joy,.kq-azan,.kq-toast,.kq-talk";
  const list = Array.from(document.querySelectorAll(sel)).filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
  });
  const out = list
    .filter((e) => !list.some((o) => o !== e && o.contains(e)))
    .map((e) => {
      const r = e.getBoundingClientRect();
      return {
        n: e.id || e.className.toString().split(" ").slice(0, 2).join("."),
        x: Math.round(r.left),
        y: Math.round(r.top),
        r: Math.round(r.right),
        b: Math.round(r.bottom),
      };
    });
  const bad = [];
  for (let i = 0; i < out.length; i += 1)
    for (let j = i + 1; j < out.length; j += 1) {
      const a = out[i];
      const b = out[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
      const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) bad.push(`${a.n} x ${b.n} (${Math.round(ox)}x${Math.round(oy)})`);
    }
  return {
    bad,
    azan: out.find((o) => o.n === "kqAzan"),
    toast: out.find((o) => /toast/.test(o.n)),
  };
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
for (const [name, [width, height]] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 150000 });
  await page.locator("#kqStart").click();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__kq.step(300));
  await page.evaluate(() => window.__kq.teleport("mosque_wudu"));
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate((n) => {
      window.__kq.setMinute(773 - n);
      window.__kq.setMinute(774);
      window.__kq.step(1500);
    }, i);
    if (await page.evaluate(() => window.__kq.state().ui.azanCard)) break;
  }
  await page.evaluate((t) => {
    window.KQ.Game.UI.toast(t, "good", 60000);
    window.__kq.step(100);
  }, TOAST);
  for (const phase of ["card", "pill"]) {
    if (phase === "pill") {
      await page.evaluate(() => window.KQ.Game.PrayerFlow.collapse());
      await page.evaluate(() => window.__kq.step(300));
    }
    const r = await page.evaluate(BOXES);
    console.log(
      name,
      phase,
      JSON.stringify(r.bad),
      JSON.stringify(r.azan),
      JSON.stringify(r.toast),
    );
    await page.screenshot({ path: join(OUT, `hud-azan-${TAG}-${name}-${phase}.png`) });
  }
  await ctx.close();
}
await browser.close();
