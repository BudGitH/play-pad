// profile-world.mjs — time each part of the world build on the throttled iPad profile (dev-only).
// Wraps the world builder's exported steps (KQ.World.parts.*, KQ.WorldParts.<Module>.<fn>) with
// timers by prepending a small script to boot.js through request interception; no game code changes.
// Usage: PW_PORT=5605 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/ipad/profile-world.mjs [kampung|haramain] [cpu]
import { chromium, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORT = Number(process.env.PW_PORT) || 5605;
const region = process.argv[2] || "kampung";
const CPU = Number(process.argv[3] || 4);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Runs in the page before boot.js: wrap every function of every KQ.WorldParts module + KQ.World.parts. */
const WRAP = `(function () {
  const T = (window.__wt = {});
  function wrap(obj, name, label) {
    const f = obj[name];
    if (typeof f !== "function" || f.__wrapped) return;
    const w = function () {
      const t0 = performance.now();
      try { return f.apply(this, arguments); }
      finally { const ms = performance.now() - t0; T[label] = (T[label] || 0) + ms; }
    };
    w.__wrapped = true;
    Object.assign(w, f);
    w.prototype = f.prototype;
    obj[name] = w;
  }
  const P = window.KQ.WorldParts;
  Object.keys(P).forEach((m) => {
    const mod = P[m];
    if (mod && typeof mod === "object") Object.keys(mod).forEach((k) => wrap(mod, k, m + "." + k));
  });
  ["makeKit", "buildAreas", "buildInstanced"].forEach((k) => wrap(window.KQ.World.parts, k, "World." + k));
  wrap(window.KQ.World, "build", "World.build");
  if (window.KQ.Holy) Object.keys(window.KQ.Holy).forEach((k) => wrap(window.KQ.Holy, k, "Holy." + k));
  const Gm = window.KQ.Game;
  ["Player.create", "Npcs.create", "Crowd.create", "Markers.create", "Collectibles.create", "Loop.studioShine"].forEach((p) => {
    const [a, b] = p.split(".");
    if (Gm[a]) wrap(Gm[a], b, p);
  });
})();
`;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const d = { ...devices["iPad Pro 11 landscape"] };
delete d.defaultBrowserType;
const context = await browser.newContext(d);
const page = await context.newPage();
await page.route("**/js/game/boot.js", (route) =>
  route.fulfill({
    contentType: "text/javascript",
    body: WRAP + readFileSync(path.join(ROOT, "games/kampung-quest/js/game/boot.js"), "utf8"),
  }),
);
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html?region=${region}`);
await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 600_000 });
/** In the page: replace the build timers with timers on the game modules' functions. */
function wrapGame() {
  const T = (window.__wt = {});
  const Gm = window.KQ.Game;
  const mods = ["Crowd", "Npcs", "Vehicles", "Loop", "PrayerFlow", "Audio", "HudView"];
  const more = ["Greetings", "Interact", "Camera", "Player", "MissionFlow", "Ambience"];
  mods
    .concat(more, ["Collectibles", "CrowdZones", "CrowdMembers", "CrowdWalkers", "CrowdHoly"])
    .forEach((m) => {
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
            T[m + "." + k] = (T[m + "." + k] || 0) + performance.now() - t0;
          }
        };
      });
    });
}

// --start [ms]: time the Start tap and the first ms of play (inclusive times) instead of the build
const si = process.argv.indexOf("--start");
if (si !== -1) {
  await page.evaluate(wrapGame);
  await page.locator("#kqStart").tap();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 300_000 });
  await page.waitForTimeout(Number(process.argv[si + 1]) || 3000);
}
const t = await page.evaluate(() => window.__wt);
Object.entries(t)
  .filter(([, ms]) => ms > 15)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, ms]) => console.log(String(Math.round(ms)).padStart(6), k));
await browser.close();
