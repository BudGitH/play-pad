// at-ready.mjs — what the world holds the instant `__kq.ready` is true, under ?still=1 (dev-only).
// The specs drive game time with __kq.step and never wait on real time, so everything they sample
// (vehicles, traffic, the bus, the crowd, ambience) must already be placed when the game starts.
// Usage: PW_PORT=5635 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/perf/at-ready.mjs [steps]
import { chromium } from "@playwright/test";

const PORT = Number(process.env.PW_PORT || 5635);
const STEPS = Number(process.argv[2] || 0);

function snapshot() {
  const G = window.KQ.Game;
  const v = window.__kq.vehicles();
  return {
    defer: G.Defer.stats(),
    parked: v.parked !== undefined ? v.parked : (v.list || []).length,
    traffic: v.traffic,
    bus: v.bus && { state: v.bus.state, runs: v.bus.runs, ready: v.bus.ready },
    crowd: window.__kq.state().crowd || (G.Crowd.debug ? G.Crowd.debug(G.S.crowd).people : null),
    ambience: G.Audio.debug().ambience,
    frames: window.__kq.stats().frames,
  };
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low`);
await page.waitForFunction(() => window.__kq?.loaded, null, { timeout: 180_000 });
await page.locator("#kq button.primary").first().click();
await page.waitForFunction(() => window.__kq?.ready, null, { timeout: 120_000, polling: 1 });
console.log("at ready:", JSON.stringify(await page.evaluate(snapshot), null, 1));
if (STEPS) {
  await page.evaluate((ms) => window.__kq.step(ms), STEPS);
  console.log(`after step(${STEPS}):`, JSON.stringify(await page.evaluate(snapshot), null, 1));
}
await browser.close();
