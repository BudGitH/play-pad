// Dev probe for the life round (say hi, world events, missions): boots the game headless and prints
// what happens. Run: node tools/serve.mjs 5608 & PW_PORT=5608 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/life-probe.mjs
import { chromium } from "@playwright/test";

const PORT = process.env.PW_PORT || 5608;
const REGION = process.env.REGION || "kampung";
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("CONSOLE " + m.text()));
const q = REGION === "haramain" ? "&region=haramain" : "";
await page.goto(
  `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low${q}`,
);
await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
await page.locator("#kq button.primary").first().click();
await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
const script = process.argv[2];
if (script) {
  const fn = (await import(new URL(script, import.meta.url))).default;
  await fn(page);
}
console.log("ERRORS", JSON.stringify(errors, null, 1));
await browser.close();
