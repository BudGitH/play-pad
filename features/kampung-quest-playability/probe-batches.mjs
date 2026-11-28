// Dev-only: list the kampung's batched meshes (name, triangles) and the low-tier draw calls at
// a spot, to see which material buckets are split into ground cells.
// Run: node tools/serve.mjs 5612 & PW_PORT=5612 node features/kampung-quest-playability/probe-batches.mjs
import { chromium } from "@playwright/test";

const PORT = process.env.PW_PORT || 5612;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
page.on("pageerror", (e) => process.stdout.write(`pageerror: ${e.message}\n`));
// BLOCK=Estate,HdbDeck: build without those optional world parts (their setters are ignored).
const BLOCK = (process.env.BLOCK || "").split(",").filter(Boolean);
await page.addInitScript((names) => {
  const P = {};
  names.forEach((n) => Object.defineProperty(P, n, { get: () => undefined, set: () => {} }));
  window.KQ = { WorldParts: P };
}, BLOCK);
await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low`);
await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 180000 });
await page.click("#kqStart");
await page.waitForFunction(() => window.__kq.ready, null, { timeout: 90000 });
const out = await page.evaluate(() => {
  const k = window.__kq;
  k.setMinute(600);
  const S = window.KQ.Game.S;
  const rows = [];
  S.scene.traverse((o) => {
    if (o.isMesh && o.name.indexOf("batch:") === 0)
      rows.push(`${o.name} ${(o.geometry.attributes.position.count / 3) | 0}`);
  });
  k.place(-44, 20.5, Math.PI / 2);
  k.step(800);
  const deck = k.stats().calls;
  const visible = [];
  S.renderer.info.autoReset = false;
  S.renderer.info.reset();
  S.renderer.render(S.scene, S.camera);
  return { rows, deck, atlasY: S.world && S.world.kit ? S.world.kit.atlas.y : null, visible };
});
process.stdout.write(out.rows.sort().join("\n") + `\ndeck calls ${out.deck}\n`);
await browser.close();
