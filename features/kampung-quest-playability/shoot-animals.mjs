// Dev-only: re-takes the animal screenshots for features/kampung-quest-playability/notes-animals.md
// (hero riding a camel, a horse close up, the kampung pony corner) in daylight (__kq.setMinute(600)).
// Needs a server: node tools/serve.mjs 5602. Run: PW_PORT=5602 node features/kampung-quest-playability/shoot-animals.mjs
import { chromium } from "@playwright/test";

const PORT = Number(process.env.PW_PORT) || 5602;
const OUT = "features/kampung-quest-playability/shots/";
const GAME = `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=med`;

/** Boot a page in a region and start the game in daylight. */
async function open(browser, region) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(GAME + (region ? "&region=" + region : ""));
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
  await page.locator("#kqStart").click();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__kq.setMinute(600));
  return page;
}

/** Draw one frame from a fixed camera (pos, look-at) and save it. */
async function frame(page, name, cam, at) {
  await page.evaluate(
    ([c, a]) => {
      const s = window.KQ.Game.S;
      s.camera.position.set(c[0], c[1], c[2]);
      s.camera.lookAt(a[0], a[1], a[2]);
      s.camera.updateMatrixWorld(true);
      s.renderer.render(s.scene, s.camera);
    },
    [cam, at],
  );
  await page.screenshot({ path: OUT + name + ".png" });
}

/** The hero riding a camel across the open sand, seen from the front quarter. */
async function camelRide(browser) {
  const page = await open(browser, "haramain");
  const pose = await page.evaluate(() => {
    const K = window.__kq;
    const G = window.KQ.Game;
    K.place(-193.3, -146, 0);
    K.step(200);
    K.mountAct("mount:ride:camel_sandy");
    K.step(100);
    const a = G.Mounts.byId("camel_sandy");
    Object.assign(a.sim, { x: -284, z: -104, heading: 0.3, speed: 0 });
    K.step(100);
    G.Camera.state.yaw = 0.3;
    K.input("up", true);
    K.step(1100);
    K.input("up", false);
    G.Hud.refs.talk.style.visibility = "hidden"; // the floating Exit button would cover the rider
    return { x: a.sim.x, z: a.sim.z, h: a.sim.heading };
  });
  const f = [Math.sin(pose.h), Math.cos(pose.h)];
  const cam = [pose.x + f[0] * 4.2 - f[1] * 3.6, 2.9, pose.z + f[1] * 4.2 + f[0] * 3.6];
  await frame(page, "animals-camel-ride", cam, [pose.x, 1.9, pose.z]);
  await page.close();
}

/** Two horses at the Makkah stable, close up. */
async function horse(browser) {
  const page = await open(browser, "haramain");
  await page.evaluate(() => {
    window.__kq.place(-170, -138, 0);
    window.__kq.step(400);
    window.KQ.Game.S.player.group.visible = false;
  });
  await frame(page, "animals-horse", [-184.6, 1.35, -146.9], [-186.4, 0.95, -150.4]);
  await page.close();
}

/** The kampung pony corner by the park, the hero at its gate. */
async function pony(browser) {
  const page = await open(browser, "");
  await page.evaluate(() => {
    window.__kq.place(58.2, 40, Math.PI / 2);
    window.__kq.step(400);
  });
  await frame(page, "animals-pony", [52.5, 2.9, 41.5], [64.5, 0.5, 39.8]);
  await page.close();
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
await camelRide(browser);
await horse(browser);
await pony(browser);
await browser.close();
