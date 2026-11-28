// Dev-only: "after" screenshots of the simple-actions round (pairs with shoot-actions.mjs "before").
// Run: node tools/serve.mjs 5614 &  then  PW_PORT=5614 node features/kampung-quest-playability/shoot-actions-after.mjs [desk|ipad|phone] [scene prefix, e.g. 08]
import { chromium } from "@playwright/test";
const PORT = process.env.PW_PORT || 5614;
const URL = `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low`;
const OUT = "features/kampung-quest-playability/shots/actions-after-";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const ev = (p, f, a) => p.evaluate(f, a);
const step = (p, ms = 300) => ev(p, (t) => window.__kq.step(t), ms);

async function nearNenek(p) {
  await ev(p, () => window.KQ.Game.UI.closeSheet("shoot"));
  const n = await ev(p, () => window.__kq.npc("nenek"));
  await ev(p, ([x, z]) => window.__kq.place(x, z, -Math.PI / 2), [n.x + 1.6, n.z]);
  await step(p, 1500);
}

async function chooser(p) {
  await ev(p, () => {
    const k = window.__kq;
    k.setMinute(660);
    k.teleport("playground");
    k.stopEvent();
    k.forceEvent("icecream");
  });
  for (let i = 0; i < 40 && !(await ev(p, () => window.__kq.events().info?.phase === "serve")); i++)
    await step(p, 1000);
  await ev(p, () => {
    const G = window.KQ.Game;
    const cart = window.__kq.events().info.cart;
    window.__kq.place(cart.x, cart.z - 2, 0);
    const A = G.S.npcs.byId.imam_hakim;
    A.hidden = false;
    A.x = A.goal.x = cart.x + 1.1;
    A.z = A.goal.z = cart.z - 2.2;
    A.path = [];
  });
  await step(p, 1500);
}

async function restOffer(p) {
  await ev(p, () => window.KQ.Game.UI.closeSheet("shoot"));
  await ev(p, () => window.KQ.Game.S.sim.needs.restore({ hunger: 80, energy: 30 }));
  await ev(p, () => window.__kq.teleport("home"));
  await step(p, 1500);
}

async function restSit(p) {
  // anywhere when Tired: the Tired bar is the one-tap Rest shortcut (shown here on open ground)
  await ev(p, () => window.KQ.Game.UI.closeSheet("shoot"));
  await ev(p, () => window.KQ.Game.S.sim.needs.restore({ hunger: 80, energy: 20 }));
  await ev(p, () => window.__kq.place(-20, 40, 0));
  await step(p, 1500);
  await p.locator("#kqNeeds").click();
  await step(p, 600); // the hero sits down where they are
  await p.waitForTimeout(100);
}

async function restZzz(p) {
  await p.waitForTimeout(1500); // then the screen fades with "Zzz"
}

async function restDone(p) {
  await p.waitForTimeout(2400);
  await step(p, 600);
}

async function prayOffer(p) {
  await ev(p, () => window.KQ.Game.UI.closeSheet("shoot"));
  await ev(p, () => window.__kq.forcePrayer("zohor"));
  await ev(p, () => window.__kq.teleport("mosque_wudu"));
  await step(p, 1500);
}

async function prayFromCard(p) {
  await p.locator("#kqStatus").click();
  await step(p, 1200);
}

/** Nenek stands free beside the hero: the chooser shows Talk and Say hi (AC-P17, option a). */
async function castSayHi(p) {
  await ev(p, () => window.KQ.Game.UI.closeSheet("shoot"));
  await ev(p, () => {
    const k = window.__kq;
    const G = window.KQ.Game;
    k.greetChance(0); // no passer-by bubbles in the picture
    k.setMinute(600);
    k.teleport("playground");
    const hero = G.S.player.pos;
    const A = G.S.npcs.byId.nenek;
    Object.assign(A, { hidden: false, show: 1, path: [], idleT: 999 });
    A.group.visible = true;
    A.goal = { kind: "wander", x: hero.x + 0.7, z: hero.z + 2 };
    A.x = A.goal.x;
    A.z = A.goal.z;
    k.place(hero.x, hero.z, 0); // facing her
  });
  await step(p, 6000); // earlier passer-by bubbles fade away
}

const scenes = [
  ["01-neighbour", nearNenek],
  ["02-chooser", chooser],
  ["03-rest-offer", restOffer],
  ["04-rest-sit", restSit],
  ["04b-rest-zzz", restZzz],
  ["05-rest-done", restDone],
  ["06-pray-offer", prayOffer],
  ["07-pray-from-status-card", prayFromCard],
  ["08-cast-sayhi", castSayHi],
];

async function session(name, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
  await page.click("#kq button.primary");
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
  await ev(page, () => window.__kq.setMinute(600));
  await step(page, 400);
  for (const [id, fn] of scenes) {
    if (process.argv[3] && !id.startsWith(process.argv[3])) continue; // e.g. "08" shoots one scene
    try {
      await fn(page);
    } catch (e) {
      console.log("ERR", name, id, e.message.slice(0, 120));
    }
    await page.screenshot({ path: OUT + name + "-" + id + ".png" });
    console.log("shot", name, id);
  }
  await ctx.close();
}
const only = process.argv[2];
const sessions = {
  desk: { viewport: { width: 1280, height: 720 } },
  ipad: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true },
  phone: {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  },
};
for (const [name, opts] of Object.entries(sessions))
  if (!only || only === name) await session(name, opts);
await browser.close();
