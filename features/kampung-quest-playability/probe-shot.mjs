// Takes the life-round screenshots: node features/kampung-quest-playability/life-probe.mjs ./probe-shot.mjs
// env: SHOTS=hi,football,kompang,...  (kampung)  or REGION=haramain SHOTS=dates,photo,pigeons,missions
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(fileURLToPath(import.meta.url), "../shots");

/** Browser-side: run `secs` of game time without drawing, then draw one frame. */
const runFn = `(secs) => { const G = window.KQ.Game; for (let t = 0; t < secs; t += 0.1) G.Loop.frame(0.1, true); window.__kq.step(120); }`;

async function run(page, secs) {
  await page.evaluate(`(${runFn})(${secs})`);
}

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, "life-" + name + ".png") });
  console.log("shot", name);
}

const SETUPS = {
  async hi(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      const G = window.KQ.Game;
      k.kidChance(0);
      k.setMinute(600);
      k.teleport("playground");
      for (let i = 0; i < 12; i += 1) k.step(200);
      const hero = G.S.player.pos;
      const away = (m) =>
        G.S.npcs.agents.every((a) => a.hidden || Math.hypot(a.x - m.x, a.z - m.z) > 7);
      const ok = (m) =>
        !m.leaving && !m.slot.sit && m.show > 0.9 && (m.walker || m.kind === "play") && away(m);
      const near = G.S.crowd.members
        .filter(ok)
        .sort(
          (a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z),
        );
      const kid = near.find((m) => m.kid) || near[0];
      const dx = hero.x - kid.x;
      const dz = hero.z - kid.z;
      const d = Math.hypot(dx, dz) || 1;
      const spot = G.Collide.freeSpot(
        G.S.world.colliders,
        kid.x + (dx / d) * 2,
        kid.z + (dz / d) * 2,
        0.4,
      );
      k.place(spot.x, spot.z, Math.atan2(kid.x - spot.x, kid.z - spot.z));
      k.step(300);
      k.interact();
    });
    await run(page, 1.6);
  },
  async football(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      k.setMinute(600);
      k.teleport("playground");
      k.step(200);
      k.forceEvent("football");
    });
    await run(page, 7);
  },
  async kompang(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      k.setMinute(600);
      k.teleport("playground");
      k.step(200);
      k.forceEvent("kompang");
    });
    await run(page, 3.5);
  },
  async icecream(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      k.setMinute(660);
      k.teleport("playground");
      k.step(200);
      k.forceEvent("icecream");
    });
    await run(page, 14);
  },
  async rain(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      k.setMinute(600);
      k.teleport("playground");
      k.step(200);
      k.forceEvent("rain");
    });
    await run(page, 10);
  },
  async balloon(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      k.setMinute(600);
      k.teleport("playground");
      k.step(200);
      k.forceEvent("balloon");
    });
    await run(page, 3);
  },
  async dates(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      k.setMinute(600);
      k.step(200);
      k.forceEvent("dates");
    });
    await run(page, 4);
  },
  async photo(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      k.setMinute(600);
      k.step(200);
      k.forceEvent("photo");
    });
    await run(page, 4);
  },
  async pigeons(page) {
    await page.evaluate(() => {
      const k = window.__kq;
      k.setMinute(600);
      k.place(-20, -84, 0);
      k.step(200);
      k.forceEvent("pigeons");
    });
    await run(page, 5);
  },
  async missions(page) {
    await page.evaluate(() => window.__kq.action("missions"));
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const grid = document.querySelector(".kq-grid-missions");
      let el = grid;
      while (el && el.scrollHeight <= el.clientHeight + 4) el = el.parentElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);
  },
};

export default async function (page) {
  const list = (process.env.SHOTS || "hi").split(",");
  for (const name of list) {
    await SETUPS[name](page);
    await shoot(page, (process.env.REGION === "haramain" ? "makkah-" : "") + name);
    await page.evaluate(() => window.__kq.stopEvent());
  }
}
