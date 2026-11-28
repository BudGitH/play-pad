// shoot.mjs — low-tier phone screenshots of busy views for the draw-call work (dev-only).
// Usage: PW_PORT=5617 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/perf/shoot.mjs
//   <tag> <spot> [event] [yaw] [--port N] [--big]   (writes shots/<tag>.png and prints the draw calls)
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? def : argv[i + 1];
};
const [tag, spot, ev = "", yaw = "0"] = argv.filter(
  (a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--port"),
);
const PORT = Number(flag("port", process.env.PW_PORT || 5617));
const REGION = flag("region", "kampung");
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../shots");

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
await page.goto(
  `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low&region=${REGION}`,
);
await page.waitForFunction(() => window.__kq?.loaded, null, { timeout: 300_000 });
await page.locator("#kq button.primary").first().click();
await page.waitForFunction(() => window.__kq?.ready, null, { timeout: 120_000 });
const calls = await page.evaluate(
  ({ spot, ev, yaw }) => {
    const k = window.__kq;
    k.setMinute(600);
    k.step(500);
    k.teleport(spot);
    if (ev) k.forceEvent(ev);
    k.step(4000);
    const st = k.state();
    k.place(st.x ?? st.pos.x, st.z ?? st.pos.z, Number(yaw));
    k.step(400);
    return k.stats().calls;
  },
  { spot, ev, yaw },
);
await page.screenshot({ path: path.join(OUT, tag + ".png") });
console.log(tag, spot, ev, yaw, "calls", calls);
await browser.close();
