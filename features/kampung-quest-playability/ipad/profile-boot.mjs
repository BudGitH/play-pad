// profile-boot.mjs — CPU profile of Kampung Quest's boot (to Start enabled) on the iPad profile (dev-only).
// Prints the top self-time functions and the top files. Usage (server on PW_PORT):
//   PW_PORT=5605 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/ipad/profile-boot.mjs
//     [--region kampung|haramain] [--cpu 1] [--start] (also profile the Start tap and the first 5 s of play)
import { chromium, devices } from "@playwright/test";

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? def : argv[i + 1];
};
const PORT = Number(process.env.PW_PORT) || 5605;
const REGION = arg("region", "kampung");
const CPU = Number(arg("cpu", 1));
const START = argv.includes("--start");

/** Sum self time per node (function + file:line) and per file. */
function aggregate(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (dt[i] || 0)));
  const fn = new Map();
  const file = new Map();
  for (const [id, us] of self) {
    const cf = byId.get(id).callFrame;
    const f = (cf.url || "(native)").split("/").slice(-2).join("/");
    const key = (cf.functionName || "(anon)") + " " + f + ":" + (cf.lineNumber + 1);
    fn.set(key, (fn.get(key) || 0) + us);
    file.set(f, (file.get(f) || 0) + us);
  }
  const top = (m, n) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, us]) => [Math.round(us / 1000), k]);
  return { fns: top(fn, 40), files: top(file, 25) };
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
  });
  const d = { ...devices["iPad Pro 11 landscape"] };
  delete d.defaultBrowserType;
  const context = await browser.newContext(d);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
  await cdp.send("Profiler.start");
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html?region=${REGION}`);
  const until = arg("until", null); // a BootPerf mark name ("world", "shaders"...), else Start enabled
  await page.waitForFunction(
    (m) =>
      m
        ? window.KQ &&
          window.KQ.Game.BootPerf &&
          window.KQ.Game.BootPerf.timings.some((t) => t[0] === m)
        : window.__kq && window.__kq.loaded,
    until,
    { timeout: 600_000, polling: 20 },
  );
  console.log("loaded in", Date.now() - t0, "ms");
  if (START) {
    await page.locator("#kqStart").tap();
    await page.waitForFunction(() => window.__kq.ready, null, { timeout: 300_000 });
    await page.waitForTimeout(5000);
  }
  const { profile } = await cdp.send("Profiler.stop");
  print(aggregate(profile));
  await browser.close();
}

function print(agg) {
  console.log("--- top files (ms self) ---");
  agg.files.forEach((r) => console.log(r.join("  ")));
  console.log("--- top functions (ms self) ---");
  agg.fns.forEach((r) => console.log(r.join("  ")));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
