import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=angle","--enable-unsafe-swiftshader","--no-sandbox"] });
const page = await b.newPage({ viewport: { width: 1100, height: 700 } });
page.on("pageerror", (e) => console.log("PAGEERR", e.message));
await page.goto("http://localhost:5599/games/kampung-quest/index.html?still=1&autoq=0&q=low");
await page.waitForFunction(() => window.__kq?.loaded, null, { timeout: 120000 });
await page.locator("#kq button.primary").first().click();
await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
await page.evaluate(() => { window.__kq.place(-22, 4.1, Math.PI); window.__kq.step(200); window.__kq.place(-33, 7.2, Math.PI); window.__kq.step(200); window.__kq.place(-22, 12, Math.PI); window.__kq.step(200);window.__kq.place(-22, 4.1, Math.PI); window.__kq.step(200);
console.log(JSON.stringify(window.__kq.state().target));
window.__kq.interact(); window.__kq.step(400); });
for (let i=0;i<4;i++){
await page.evaluate(() => { window.__kq.input("up", true); window.__kq.step(500); });
console.log(JSON.stringify(await page.evaluate(() => [window.__kq.state().pos, window.__kq.vehicles().list[0], window.__kq.vehicles().mounted])));
}
await b.close();
