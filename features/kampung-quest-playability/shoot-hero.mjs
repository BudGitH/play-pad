// Dev-only: screenshots of the hero choice (AC-P8..P10): the "Who are you?" picker, the girl hero in a few
// looks, the girl in ihram, and the boy hero, all front close-ups in daylight.
// Run: node tools/serve.mjs 5603 &  then  PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/shoot-hero.mjs
import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:5603";
const out = (n) => resolve("features/kampung-quest-playability/shots", `hero-${n}.png`);
const ARGS = [
  "--use-gl=angle",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--no-sandbox",
];

/** Boot the game (optionally choosing a hero card first) and wait until it runs. */
async function boot(browser, gender, shootPicker) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));
  await page.goto(BASE + "/games/kampung-quest/index.html?still=1&autoq=0&q=med");
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
  await page.locator(`.kq-hero-card[data-hero="${gender}"]`).click();
  if (shootPicker) await page.screenshot({ path: out("picker") });
  await page.locator("#kqStart").click();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__kq.setMinute(600);
    window.__kq.teleport("bus_stop");
    window.__kq.step(600);
  });
  return { ctx, page };
}

/** Dress the hero (optional) and take a front close-up of the head and shoulders. */
async function closeUp(page, name, look) {
  await page.evaluate((lk) => {
    const G = window.KQ.Game;
    const S = G.S;
    if (lk) {
      Object.assign(S.sim.hero, lk.hero || {});
      if (lk.wardrobe) S.sim.wardrobe = lk.wardrobe;
      if (lk.ihram !== undefined) S.sim.umrah.setIhram(lk.ihram);
      G.Player.applyOutfit(S.player, S.sim.outfit);
    }
    const P = S.player;
    const spot = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
    G.Camera.shot({
      target: spot,
      lift: 0.62,
      yaw: P.heading + Math.PI - 0.25 + ((lk && lk.turn) || 0),
      pitch: 0.06,
      dist: 1.25,
      rate: 50,
    });
    window.__kq.step(1500);
  }, look || null);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out(name) });
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ARGS });
const girl = await boot(browser, "girl", true);
await closeUp(girl.page, "girl-1-hijab-kurung");
await closeUp(girl.page, "girl-2-ponytail-dress", {
  hero: { style: "ponytail", scarf: "lilac" },
  wardrobe: { wear: "dress", tone: "purple" },
});
await closeUp(girl.page, "girl-3-sporty-tracksuit", {
  hero: { style: "hijab_sport", scarf: "sky" },
  wardrobe: { wear: "tracksuit", tone: "teal" },
});
await closeUp(girl.page, "girl-4-braids-tunic", {
  hero: { style: "braids", scarf: "sunny" },
  wardrobe: { wear: "tunic", tone: "coral" },
});
await closeUp(girl.page, "girl-5-bob-three-quarter", {
  hero: { style: "bob", scarf: "rose" },
  wardrobe: { wear: "kurung", tone: "pink" },
  turn: 0.9,
});
await closeUp(girl.page, "girl-6-ihram", { ihram: true });
await girl.ctx.close();
const boy = await boot(browser, "boy", false);
await closeUp(boy.page, "boy-1-default");
await boy.ctx.close();
await browser.close();
