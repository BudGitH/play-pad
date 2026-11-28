// shoot.mjs — screenshots for the iPad notes (dev-only): the loading screen mid-progress and the game
// running, on the emulated iPad (iPadOS UA + touch points). Also usable to compare two servers
// pixel for pixel (before / after) in one pose: `--port 5606 --tag before`.
// Usage: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/ipad/shoot.mjs
//          [--port 5605] [--tag ipad] [--q low] [--region kampung] [--loading]
import { chromium, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? def : argv[i + 1];
};
const PORT = Number(arg("port", process.env.PW_PORT || 5605));
const TAG = arg("tag", "ipad");
const Q = arg("q", "low");
const REGION = arg("region", "kampung");
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../shots");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

function fakeIpadOs() {
  Object.defineProperty(navigator, "platform", { get: () => "MacIntel", configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5, configurable: true });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
  });
  const d = { ...devices["iPad Pro 11 landscape"], userAgent: UA };
  delete d.defaultBrowserType;
  const context = await browser.newContext(d);
  await context.addInitScript(fakeIpadOs);
  const page = await context.newPage();
  const q = `?still=1&autoq=0&q=${Q}&region=${REGION}`;
  // --loading: slow the CPU 4x while loading so the bar can be caught part-way
  const cdp = await context.newCDPSession(page);
  if (argv.includes("--loading")) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html${q}`);
  if (argv.includes("--loading")) {
    await page.waitForFunction(
      () => {
        const v = Number(
          document.querySelector("#kqTitle .kq-progress").getAttribute("aria-valuenow"),
        );
        return v >= 50 && v < 100;
      },
      null,
      { timeout: 300_000, polling: 10 },
    );
    await page.screenshot({ path: path.join(OUT, `${TAG}-loading.png`) });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 300_000 });
  await page.locator("#kqStart").tap();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__kq.setMinute(600);
    window.__kq.step(600);
  });
  await page.screenshot({ path: path.join(OUT, `${TAG}-game.png`) });
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
