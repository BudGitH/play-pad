// Dev-only: the speech-bubble screenshot of features/kampung-quest-playability/figures/audit.md. Nenek at
// her block at 07:10, the hero 2.6 m in front of her, five lines at once (hero and Nenek).
// Run: node tools/serve.mjs 5613 &  then
//   BASE_URL=http://localhost:5613 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
//   node features/kampung-quest-playability/figures/shoot-bubbles.mjs shots/figures-after-12-bubbles.png
import { chromium } from "@playwright/test";
import { launchArgs } from "./audit-lib.mjs";

const BASE = process.env.BASE_URL || "http://localhost:5613";

/** Browser-side: stand in front of Nenek and have five lines said at once. */
function scene() {
  const G = window.KQ.Game;
  const k = window.__kq;
  k.setMinute(430);
  for (let i = 0; i < 10 && !k.npc("nenek"); i += 1) k.step(200);
  const n = k.npc("nenek");
  k.place(n.x, n.z + 2.6, Math.PI);
  k.step(3000);
  const lines = [
    ["hero", "Assalamualaikum, Nenek!"],
    ["nenek", "Waalaikumsalam, cucu!"],
    ["nenek", "Can you help me?"],
    ["hero", "Yes, Nenek!"],
    ["nenek", "Thank you!"],
  ];
  lines.forEach((l) => G.Greetings.say(l[0], l[1], 0, 8));
  k.step(500);
  return k.greetings().visible;
}

const b = await chromium.launch(launchArgs());
try {
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } });
  await page.goto(BASE + "/games/kampung-quest/index.html?still=1&autoq=0&q=low");
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
  await page.locator("#kq button.primary").first().click();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
  console.log("bubbles shown", await page.evaluate(scene));
  await page.screenshot({ path: process.argv[2] || "bubbles.png" });
} finally {
  await b.close();
}
