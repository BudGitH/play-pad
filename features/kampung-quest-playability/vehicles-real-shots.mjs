// Dev-only: the realism-pass screenshots in the real game (not CI). Daylight (minute 600) on ?q=med, plus a low-tier
// street and a dusk (minute 1140) rear view with head and brake lamps on. Writes
// features/kampung-quest-playability/shots/vehicles-real-*.png.
// Run: node tools/serve.mjs 5615 &  then  PW_PORT=5615 node features/kampung-quest-playability/vehicles-real-shots.mjs [only,names]
import { chromium } from "@playwright/test";

const PORT = process.env.PW_PORT || 5615;
const DIR = "features/kampung-quest-playability/shots/";
const only = process.argv[2] ? process.argv[2].split(",") : null;
const want = (name) => !only || only.includes(name);

/** Browser-side helpers: find vehicles, frame a 3/4 view, step. */
function install() {
  const G = window.KQ.Game;
  const all = () => {
    const out = [];
    G.S.scene.traverse(
      (o) => o.userData && o.userData.vehicle && o.visible && out.push(o.userData.vehicle),
    );
    return out;
  };
  const sims = () => G.Vehicles.debug().list;
  /** Look at (x, z) from angle a off the nose (0 = straight ahead, + = toward the vehicle's left). */
  const look = (x, z, h, a, dist, pitch, lift) => {
    const o = [
      Math.sin(h) * Math.cos(a) + Math.cos(h) * Math.sin(a),
      Math.cos(h) * Math.cos(a) - Math.sin(h) * Math.sin(a),
    ];
    window.__kq.place(x + o[0] * (dist + 2.5), z + o[1] * (dist + 2.5), h);
    window.__kq.step(200);
    G.Camera.shot({
      target: { x, y: 0, z },
      yaw: Math.atan2(-o[0], -o[1]),
      pitch,
      dist,
      lift,
      rate: 60,
    });
    window.__kq.step(900);
  };
  window.__shot = { all, sims, look };
}

/** Browser-side: frame the first parked vehicle matching (kind, style). */
function frameOne([kind, style, a, dist, pitch, lift]) {
  const T = window.__shot;
  window.KQ.Game.Vehicles.returnAll();
  const v = T.sims().find((s) => s.kind === kind && (!style || s.style === style));
  if (!v) return null;
  T.look(v.x, v.z, v.heading, a, dist, pitch, lift);
  return v.id;
}

/** Browser-side: run the town until the bus waits at the stop with its doors open, then frame its windows. */
function busAtStop() {
  const G = window.KQ.Game;
  G.Camera.clearShot();
  window.__kq.place(30, 8, -Math.PI / 2);
  for (let i = 0; i < 4000; i += 1) {
    G.Loop.frame(1 / 30, true);
    const b = G.Vehicles.debug().bus;
    if (b.state === "stop" && b.doors > 0.9) break;
  }
  const b = G.Vehicles.debug().bus;
  window.__kq.place(b.x - 9, 6, Math.PI / 2);
  window.__kq.freeze(true);
  G.Camera.shot({
    target: { x: b.x, y: 0, z: b.z },
    yaw: Math.PI + 0.55,
    pitch: 0.12,
    dist: 11,
    lift: 1.5,
    rate: 60,
  });
  for (let i = 0; i < 30; i += 1) window.__kq.step(30);
  return b;
}

/** Browser-side: open a car's front-left door and frame it. */
function doorOpen() {
  const T = window.__shot;
  const v = T.sims().find((s) => s.kind === "car" && s.style === "suv");
  const rec = T.all().find(
    (r) =>
      r.group.position.distanceTo(new window.THREE.Vector3(v.x, r.group.position.y, v.z)) < 0.1,
  );
  rec.rig.doors[1].open(1);
  rec.rig.doors[3].open(0.8);
  T.look(v.x, v.z, v.heading, 0.95, 5.2, 0.22, 0.7);
  return v.id;
}

/** Browser-side: shut every door again. */
function shutAll() {
  window.__shot
    .all()
    .forEach(
      (r) =>
        r.rig &&
        r.rig.doors.forEach((d) => (d.kind !== "fold" && d.kind !== "slide" ? d.open(0) : null)),
    );
}

/** Browser-side: dusk, head and brake lamps on for every car; frame one from behind. */
function dusk([style, a]) {
  const T = window.__shot;
  window.__kq.setMinute(1140);
  window.__kq.step(400);
  T.all().forEach(function (r) {
    if (!r.rig || r.kind === "bike") return;
    r.rig.lights.setHead(true);
    r.rig.lights.setBrake(true);
  });
  const v = T.sims().find((s) => s.kind === "car" && s.style === style);
  T.look(v.x, v.z, v.heading, a, 6.5, 0.2, 0.7);
  return v.id;
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});

async function open(q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(`http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=${q}`);
  await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
  await page.locator("#kq button.primary").first().click();
  await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__kq.setMinute(600);
    window.__kq.step(400);
  });
  await page.evaluate(install);
  await page.addStyleTag({
    content:
      "#kq .hud, #kq [class*=hud], #kqDock, #kqMap, #kqNeeds, #kqStatus { opacity: 0 !important; }",
  });
  return page;
}

const shoot = async (page, name) => {
  await page.screenshot({ path: `${DIR}vehicles-real-${name}.png`, timeout: 180000 });
  console.log("shot", name);
};

const page = await open("med");
for (const style of ["sedan", "hatch", "suv", "mpv", "taxi"]) {
  if (!want(style)) continue;
  const id = await page.evaluate(frameOne, ["car", style, 0.75, 6.4, 0.18, 0.75]);
  if (id) await shoot(page, style);
}
if (want("lorry") && (await page.evaluate(frameOne, ["lorry", null, 0.8, 9.5, 0.18, 1.0])))
  await shoot(page, "lorry");
if (want("bike") && (await page.evaluate(frameOne, ["bike", null, 1.25, 3.0, 0.22, 0.45])))
  await shoot(page, "bike");
if (want("moto") && (await page.evaluate(frameOne, ["moto", null, -1.1, 3.2, 0.25, 0.55])))
  await shoot(page, "moto");
if (want("door")) {
  await page.evaluate(doorOpen);
  await shoot(page, "door-open");
  await page.evaluate(shutAll);
}
if (want("carpark")) {
  await page.evaluate(() => {
    const T = window.__shot;
    const cars = T.sims().filter((s) => s.kind === "car");
    const c = cars.reduce((a, s) => ({ x: a.x + s.x / cars.length, z: a.z + s.z / cars.length }), {
      x: 0,
      z: 0,
    });
    const near = cars
      .slice()
      .sort((p, q) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z))[0];
    T.look(near.x, near.z, near.heading, 2.4, 13, 0.5, 0.5);
  });
  await shoot(page, "carpark");
}
if (want("bus")) {
  await page.evaluate(busAtStop);
  await shoot(page, "bus");
}
if (want("dusk")) {
  await page.evaluate(dusk, ["sedan", 2.5]);
  await shoot(page, "dusk-brake");
  await page.evaluate(dusk, ["taxi", 0.6]);
  await shoot(page, "dusk-front");
}
await page.close();
if (want("low")) {
  const low = await open("low");
  await low.evaluate(frameOne, ["car", "sedan", 0.6, 7.5, 0.22, 0.75]);
  await shoot(low, "low-tier");
  await low.close();
}
await browser.close();
