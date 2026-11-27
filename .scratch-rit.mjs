import { chromium } from "@playwright/test";
const out = process.argv[2] || "/tmp/claude-0/-home-user-play-pad/01e17b23-f583-5e92-861b-908001ed85c1/scratchpad";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));
await page.goto("http://localhost:5598/games/kampung-quest/index.html?still=1&autoq=0&q=low");
await page.waitForFunction(() => window.__kq?.loaded, null, { timeout: 90000 });
await page.locator("#kq button.primary").first().click();
await page.waitForFunction(() => window.__kq.ready, null, { timeout: 30000 });
await page.evaluate(() => window.__kq.step(300));
await page.evaluate(() => window.__kq.openRite("umrah"));
await page.getByRole("button", { name: "Put on ihram" }).click();
await page.evaluate(() => { window.KQ.Game.Camera.state.yaw += Math.PI; window.__kq.step(600); });
await page.screenshot({ path: out + "/ihram.png" });
const st = async () => JSON.stringify(await page.evaluate(() => window.__kq.ritual()));
for (let i = 0; i < 60; i++) {
  const r = await page.evaluate(() => window.__kq.ritual());
  if (!r.open || r.done) break;
  if (r.step === "tawaf" && r.count === 2) await page.screenshot({ path: out + "/tawaf.png" });
  await page.locator(".kq-step-next").click();
  await page.evaluate(() => window.__kq.step(50));
}
console.log(await st());
await browser.close();
