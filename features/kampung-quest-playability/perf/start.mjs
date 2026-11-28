// start.mjs — desktop load vs Start->ready timing (dev-only; the smoke test's round budget).
// Mirrors tests/round-drivers.mjs: 1366x800, software GL, wait for `__kq.loaded`, click Start,
// wait for `__kq.ready`. Reports both halves separately, median of N runs, plus (with --breakdown)
// how long each game module spent inside the Start tap.
// Usage: PW_PORT=5635 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
//   node features/kampung-quest-playability/perf/start.mjs [--runs 3] [--region kampung] [--breakdown]
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? def : argv[i + 1];
};
const PORT = Number(arg("port", process.env.PW_PORT || 5635));
const RUNS = Number(arg("runs", 3));
const REGION = arg("region", "kampung");
const BREAKDOWN = argv.includes("--breakdown");

/** In the page: time every function of the game modules that could run inside the Start tap. */
function wrapGame() {
  const T = (window.__wt = {});
  const Gm = window.KQ.Game;
  const mods = ["Crowd", "Npcs", "Vehicles", "Traffic", "Bus", "Loop", "PrayerFlow", "Audio"];
  const more = ["HudView", "Hud", "ActionBar", "Greetings", "Interact", "Camera", "Player"];
  const last = ["MissionFlow", "Ambience", "Collectibles", "WorldEvents", "Mounts", "Actors"];
  mods.concat(more, last).forEach((m) => {
    const mod = Gm[m];
    if (!mod) return;
    Object.keys(mod).forEach((k) => {
      const f = mod[k];
      if (typeof f !== "function") return;
      mod[k] = function () {
        const t0 = performance.now();
        try {
          return f.apply(this, arguments);
        } finally {
          T[m + "." + k] = (T[m + "." + k] || 0) + (performance.now() - t0);
        }
      };
    });
  });
}

async function oneRun(browser) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html?region=${REGION}`);
  await page.waitForFunction(() => window.__kq?.loaded, null, { timeout: 180_000, polling: 20 });
  const loadMs = Date.now() - t0;
  if (BREAKDOWN) await page.evaluate(wrapGame);
  const defer = await page.evaluate(() =>
    window.KQ.Game.Defer ? window.KQ.Game.Defer.stats() : null,
  );
  if (argv.includes("--prefinish"))
    await page.evaluate(() => window.KQ.Game.Pictures.finishPostures());
  await page.evaluate(() => {
    window.__t = {};
    document.addEventListener("pointerdown", () => (window.__t.down = performance.now()), true);
  });
  const t1 = Date.now();
  await page.locator("#kq button.primary").first().click();
  const clickMs = Date.now() - t1;
  await page.waitForFunction(() => window.__kq?.ready, null, { timeout: 120_000, polling: 10 });
  const readyMs = Date.now() - t1;
  const inPage = await page.evaluate(() => performance.now() - window.__t.down);
  const wt = BREAKDOWN ? await page.evaluate(() => window.__wt) : null;
  const marks = await page.evaluate(() =>
    window.KQ.Game.BootPerf ? window.KQ.Game.BootPerf.timings : null,
  );
  await page.close();
  return { loadMs, clickMs, readyMs, inPage: Math.round(inPage), defer, wt, marks, errors };
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const rows = [];
for (let i = 0; i < RUNS; i += 1) {
  const r = await oneRun(browser);
  rows.push(r);
  console.log(
    `run ${i + 1}: load ${r.loadMs} ms, click ${r.clickMs} ms, in-page ${r.inPage} ms, Start->ready ${r.readyMs} ms ` +
      JSON.stringify(r.defer),
    r.errors.slice(0, 2),
  );
  if (r.wt) {
    Object.entries(r.wt)
      .filter(([, ms]) => ms > 20)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .forEach(([k, ms]) => console.log("   ", Math.round(ms), k));
  }
}
await browser.close();
console.log(
  `median: load ${median(rows.map((r) => r.loadMs))} ms, Start->ready ${median(rows.map((r) => r.readyMs))} ms`,
);
if (rows[0].marks) console.log("boot marks:", JSON.stringify(rows[rows.length - 1].marks));
