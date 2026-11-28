// textures.mjs — list the textures in the loaded Kampung Quest scene, biggest first (dev-only).
// Usage: PW_PORT=5605 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/ipad/textures.mjs [kampung|haramain] [query]
import { chromium } from "@playwright/test";

const PORT = Number(process.env.PW_PORT) || 5605;
const region = process.argv[2] || "kampung";
const extra = process.argv[3] || "&q=low";
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1194, height: 834 } });
await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html?region=${region}${extra}`);
await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 300_000 });
const rows = await page.evaluate(() => {
  const s = window.KQ.Game.S;
  const seen = new Map();
  s.scene.traverse((o) => {
    [].concat(o.material || []).forEach((m) =>
      Object.entries(m).forEach(([k, t]) => {
        if (t && t.isTexture && !seen.has(t)) seen.set(t, (o.name || o.type) + "." + k);
      }),
    );
  });
  return [...seen]
    .map(([t, n]) => {
      const im = t.image || {};
      return [
        n,
        im.width,
        im.height,
        im.constructor && im.constructor.name,
        (im.src || "").split("/").pop(),
      ];
    })
    .sort((a, b) => b[1] * b[2] - a[1] * a[2]);
});
console.log(rows.map((x) => x.join(" ")).join("\n"));
await browser.close();
