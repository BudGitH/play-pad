// Dev-only: re-takes the animal screenshots for features/kampung-quest-playability/notes-animals.md
// (hero riding a camel, a camel close up, the herd in the camel yard, a horse close up, the kampung
// pony corner) in daylight (__kq.setMinute(600)).
// Needs a server: node tools/serve.mjs 5602. Run: PW_PORT=5602 node features/kampung-quest-playability/shoot-animals.mjs [names...]
import { chromium } from "@playwright/test";

const PORT = Number(process.env.PW_PORT) || 5602;
const OUT = "features/kampung-quest-playability/shots/";
const GAME = `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=med`;

/** Boot a page in a region and start the game in daylight. */
async function open(browser, region) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
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

/** A camera `ahead` m in front of and `side` m beside an animal at {x, z, h}, at height y. */
function quarter(p, ahead, side, y) {
  const f = [Math.sin(p.h), Math.cos(p.h)];
  return [p.x + f[0] * ahead - f[1] * side, y, p.z + f[1] * ahead + f[0] * side];
}

/** The hero riding a camel across the open sand, seen from the front quarter. */
async function camelRide(page) {
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
  await frame(page, "animals-camel-ride", quarter(pose, 2.6, 2.9, 2.4), [pose.x, 1.7, pose.z]);
  if (process.env.SIDE) {
    await frame(page, "tmp-side", quarter(pose, 0.3, 1.6, 2.1), [pose.x, 1.9, pose.z + 0.2]);
    await frame(page, "tmp-front", quarter(pose, 1.8, 0.2, 2.3), [pose.x, 1.9, pose.z]);
  }
}

/** A standing camel (no rider), front three-quarter close-up. */
async function camelClose(page) {
  const pose = await page.evaluate(() => {
    const K = window.__kq;
    const G = window.KQ.Game;
    K.place(-188, -136, 0);
    K.step(900);
    G.S.player.group.visible = false;
    const a = G.Mounts.byId("camel_dune");
    return { x: a.sim.x, z: a.sim.z, h: a.sim.heading };
  });
  await frame(page, "animals-camel-close", quarter(pose, 3.3, 2.3, 1.75), [
    pose.x,
    1.3,
    pose.z + 0.3,
  ]);
}

/** The herd in the camel yard (standing, kneeling, grazing). */
async function herd(page) {
  await page.evaluate(() => {
    window.__kq.place(-205, -120, 0);
    window.__kq.step(300);
    window.KQ.Game.S.player.group.visible = false;
  });
  await frame(page, "animals-herd", [-212, 3.2, -128], [-226, 0.9, -142]);
}

/** Two horses at the Makkah stable, close up. */
async function horse(page) {
  await page.evaluate(() => {
    window.__kq.place(-170, -138, 0);
    window.__kq.step(400);
    window.KQ.Game.S.player.group.visible = false;
  });
  await frame(page, "animals-horse", [-184.6, 1.35, -146.9], [-186.4, 0.95, -150.4]);
  if (process.env.SIDE)
    await frame(page, "tmp-horse", [-186.2, 1.55, -148.3], [-187.4, 1.3, -150.2]);
}

/** The kampung pony corner by the park: a pony close up, the hero at the gate behind. */
async function pony(page) {
  const pose = await page.evaluate(() => {
    window.__kq.place(58.2, 40, Math.PI / 2);
    window.__kq.step(900);
    const a = window.KQ.Game.Mounts.byId("pony_kiwi");
    return { x: a.sim.x, z: a.sim.z, h: a.sim.heading };
  });
  await frame(page, "animals-pony", quarter(pose, 2.3, 1.7, 1.35), [pose.x, 0.75, pose.z]);
}

/** Dev check only (SIDE=1): the hero on a horse, side view. */
async function horseRide(page) {
  const pose = await page.evaluate(() => {
    const K = window.__kq;
    const G = window.KQ.Game;
    K.place(-178, -141, 0);
    K.step(200);
    K.mountAct("mount:ride:horse_amber");
    K.step(400);
    G.Hud.refs.talk.style.visibility = "hidden";
    const a = G.Mounts.byId("horse_amber");
    return { x: a.sim.x, z: a.sim.z, h: a.sim.heading };
  });
  await frame(page, "tmp-horse-ride", quarter(pose, 1.2, 2.2, 1.7), [pose.x, 1.3, pose.z]);
}

const SHOTS = { camelClose, herd, horse, camelRide, horseRide };
const want = process.argv.slice(2);
const pick = (n) => !want.length || want.includes(n);
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
for (const [name, shoot] of Object.entries(SHOTS)) {
  if (!pick(name) || (name === "horseRide" && !process.env.SIDE)) continue;
  const page = await open(browser, "haramain");
  await shoot(page);
  await page.close();
}
if (pick("pony")) {
  const page = await open(browser, "");
  await pony(page);
  await page.close();
}
await browser.close();
