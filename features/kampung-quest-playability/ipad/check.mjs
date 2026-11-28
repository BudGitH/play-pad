// check.mjs — load the game once (no throttle) and print boot timings + console errors (dev-only).
// Usage: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/ipad/check.mjs [port] [query]
import { chromium } from "@playwright/test";

const port = process.argv[2] || 5605;
const query = process.argv[3] || "?region=kampung";
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1194, height: 834 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(m.text()));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/games/kampung-quest/index.html${query}`);
const ok = await page
  .waitForFunction(
    () => (window.__kq && window.__kq.loaded) || !document.getElementById("kqError").hidden,
    null,
    { timeout: 240_000 },
  )
  .then(() => true)
  .catch(() => false);
console.log("loaded:", ok, Date.now() - t0, "ms");
console.log(
  await page.evaluate(() => (window.KQ.Game.BootPerf ? window.KQ.Game.BootPerf.timings : null)),
);
console.log(errors.slice(0, 20));
await browser.close();
