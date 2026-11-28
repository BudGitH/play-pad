// Dev-only: screenshots of the Kampung Quest action flow "as a child sees it" (audit evidence).
// Run: node tools/serve.mjs 5610 &  then  node features/kampung-quest-playability/shoot-actions.mjs
import { chromium } from "@playwright/test";
const URL = "http://localhost:5610/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const OUT = "features/kampung-quest-playability/shots/actions-before-";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const ev = (p, f, a) => p.evaluate(f, a);
const step = (p, ms = 400) => ev(p, (t) => window.__kq.step(t), ms);
const info = (p) =>
  ev(p, () => {
    const s = window.__kq.state();
    return {
      target: s.target && s.target.label + "/" + s.target.id + "/" + s.target.enabled,
      modal: s.ui.modal,
      azan: s.ui.azanCard,
    };
  });
async function clear(p) {
  for (let i = 0; i < 4; i++) {
    const m = await ev(p, () => window.__kq.state().ui.modal);
    if (!m) break;
    await ev(p, () => window.__kq.action("escape"));
    await step(p, 100);
  }
}
const tp = (poi) => async (p) => {
  await clear(p);
  await ev(p, (x) => window.__kq.teleport(x), poi);
  await step(p, 300);
};
const press = (n) => async (p) => {
  await ev(p, (x) => window.__kq.action(x), n);
  await step(p, 300);
};
const nearNpc = (id, d) => async (p) => {
  await clear(p);
  const n = await ev(p, (i) => window.__kq.npc(i), id);
  await ev(p, ([x, z]) => window.__kq.place(x, z, 0), [n.x + d, n.z]);
  await step(p, 300);
};
const scenes = [
  ["01-counter", tp("stall_prata")],
  ["02-home", tp("home")],
  ["03-home-dialog", press("interact")],
  ["04-taps", tp("mosque_wudu")],
  ["05-hall", tp("mosque_hall")],
  ["06-npc-far", nearNpc("nenek", 3.6)],
  ["07-npc-near", nearNpc("nenek", 1.4)],
  [
    "08-azan",
    async (p) => {
      await clear(p);
      await ev(p, () => window.__kq.teleport("home"));
      await ev(p, () => window.__kq.forcePrayer("zohor"));
      await step(p, 600);
    },
  ],
  ["09-daycard", press("pray")],
  [
    "10-wudu",
    async (p) => {
      await clear(p);
      await ev(p, () => window.__kq.teleport("mosque_wudu"));
      await step(p, 200);
      await ev(p, () => window.__kq.interact());
      await step(p, 400);
    },
  ],
];
async function session(name, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
  await page.click("#kq button.primary");
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
  await step(page, 300);
  for (const [id, fn] of scenes) {
    try {
      await fn(page);
    } catch (e) {
      console.log("ERR", id, e.message.slice(0, 80));
    }
    await step(page, 300);
    await page.screenshot({ path: OUT + name + "-" + id + ".png" });
    console.log(name, id, JSON.stringify(await info(page)));
  }
  await ctx.close();
}
await session("desk", { viewport: { width: 1280, height: 720 } });
await session("phone", {
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
});
await browser.close();
