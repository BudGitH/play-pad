// Dev-only probe for the vehicles workstream (AC-P11..P14): measures how far each vehicle's wheels sit above
// the ground actually drawn under them (a downward raycast that ignores vehicles and people), and optionally
// takes close-up screenshots in daylight. Not part of CI; tests/kampung-quest-vehicles-ground.spec.mjs asserts it.
// Run: node tools/serve.mjs 5601 &   then   node features/kampung-quest-playability/vehicles-measure.mjs [haramain] [shots]
import { chromium } from "@playwright/test";

const PORT = process.env.PW_PORT || 5601;
const region = process.argv.includes("haramain") ? "haramain" : "kampung";
const shots = process.argv.includes("shots");
const flag = region === "haramain" ? "&region=haramain" : "";
const url = `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low${flag}`;

/** Browser-side: wheel bottoms vs the drawn ground for every visible vehicle. */
function measure() {
  const S = window.KQ.Game.S;
  const ray = new THREE.Raycaster();
  const skip = (o) => {
    for (let p = o; p; p = p.parent) {
      if (/^vehicle-/.test(p.name || "") || p === S.player.group) return true;
    }
    return o.isInstancedMesh || o.isSprite || o.isPoints || o.isLine;
  };
  const solid = [];
  S.scene.traverse((o) => o.isMesh && o.visible && !skip(o) && solid.push(o));
  const groundY = (x, z, top) => {
    ray.set(new THREE.Vector3(x, top + 2, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(solid, false)[0];
    return hit ? hit.point.y : null;
  };
  const out = [];
  S.scene.traverse((g) => {
    if (!/^vehicle-/.test(g.name || "") || !g.visible) return;
    g.updateMatrixWorld(true);
    let worst = 0;
    g.traverse((m) => {
      if (m.name !== "wheel") return;
      const b = new THREE.Box3().setFromObject(m);
      const c = b.getCenter(new THREE.Vector3());
      const gy = groundY(c.x, c.z, b.min.y);
      if (gy !== null && Math.abs(b.min.y - gy) > Math.abs(worst)) worst = b.min.y - gy;
    });
    out.push({
      name: g.name,
      x: Number(g.position.x.toFixed(1)),
      z: Number(g.position.z.toFixed(1)),
      y: Number(g.position.y.toFixed(3)),
      gap: Number(worst.toFixed(3)),
    });
  });
  return out;
}

/** Browser-side: stand beside a vehicle and frame it from a three-quarter side view. */
function frame([x, z, h, k, side]) {
  const f = [Math.sin(h), Math.cos(h)];
  const l = [Math.cos(h), -Math.sin(h)];
  const lat = (k === "car" ? 1.45 : 0.75) * side;
  const fwd = k === "car" ? 0.6 : 0.2;
  window.__kq.place(x + l[0] * lat + f[0] * fwd, z + l[1] * lat + f[1] * fwd, h);
  window.__kq.step(300);
  const back = side > 0 ? 1 : -1;
  const d = [
    -(f[0] * 0.75 * back + l[0] * 0.66 * side),
    -(f[1] * 0.75 * back + l[1] * 0.66 * side),
  ];
  window.KQ.Game.Camera.shot({
    target: { x, y: 0, z },
    yaw: Math.atan2(d[0], d[1]),
    pitch: 0.28,
    dist: k === "car" ? 6.2 : 3.6,
    lift: 0.55,
    rate: 60,
  });
  window.__kq.step(900);
}

/** Browser-side: get on a vehicle and frame the rider from the side, to check the seat fits. */
function ride(id) {
  const G = window.KQ.Game;
  G.Camera.clearShot();
  G.Vehicles.press("vehicle:" + id);
  window.__kq.step(600);
  const v = G.Vehicles.debug().list.find((x) => x.id === id);
  const h = v.heading;
  G.Camera.shot({
    target: { x: v.x, y: 0, z: v.z },
    yaw: h - Math.PI / 2 - 0.35,
    pitch: 0.12,
    dist: v.kind === "car" ? 5.5 : 3.2,
    lift: 0.6,
    rate: 60,
  });
  window.__kq.step(900);
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.goto(url);
await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 120000 });
await page.locator("#kq button.primary").first().click();
await page.waitForFunction(() => window.__kq.ready, null, { timeout: 60000 });
await page.evaluate(() => {
  window.__kq.setMinute(600);
  window.__kq.step(400);
});
const list = await page.evaluate(() => window.__kq.vehicles().list);
if (process.argv.includes("calls")) {
  const calls = await page.evaluate(() => {
    const all = window.KQ.Game.Vehicles.debug().list;
    const mid = all[Math.floor(all.length / 2)];
    window.__kq.place(mid.x, mid.z + 3, 0);
    window.__kq.step(700);
    return window.__kq.stats().calls;
  });
  console.log("street view draw calls (low tier, incl. shadows)", calls);
}
const rows = [];
const skipMeasure = process.argv.includes("nomeasure");
for (const v of skipMeasure ? [] : list) {
  await page.evaluate(
    ([x, z]) => {
      window.__kq.place(x + 6, z + 6, 0);
      window.__kq.step(700);
    },
    [v.x, v.z],
  );
  const m = await page.evaluate(measure);
  const mine = m.filter((r) => Math.abs(r.x - v.x) < 0.2 && Math.abs(r.z - v.z) < 0.2);
  rows.push(...mine.map((r) => ({ id: v.id, ...r })));
}
console.table(rows.filter((r) => Math.abs(r.gap) > 0.02));
const gaps = rows.filter((r) => r.gap !== null).map((r) => r.gap);
if (rows.length)
  console.log("vehicles", rows.length, "max gap", Math.max(...gaps), "min gap", Math.min(...gaps));

if (shots) {
  for (const kind of ["car", "bike", "moto"]) {
    const pick = Number(process.env.PICK || 0);
    const v = list.filter((x) => x.kind === kind)[pick];
    if (!v) continue;
    await page.evaluate(frame, [v.x, v.z, v.heading, kind, 1]);
    const path = `features/kampung-quest-playability/shots/vehicles-${kind}-${region}.png`;
    await page.screenshot({ path });
    console.log("shot", path);
    await page.evaluate(ride, v.id);
    await page.screenshot({ path: path.replace(".png", "-ride.png") });
    await page.evaluate(() => window.KQ.Game.Camera.clearShot());
    await page.evaluate(() => window.KQ.Game.Vehicles.press("vehicle:exit"));
    await page.evaluate(() => window.__kq.step(1500));
  }
}
await browser.close();
