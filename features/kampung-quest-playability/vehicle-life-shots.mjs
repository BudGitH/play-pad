// Dev-only probe: takes the daylight screenshots of the vehicle-life round into
// features/kampung-quest-playability/shots/vehicle-life-*.png (door mid-entry, a traffic car with its people, the
// bus at the stop with people boarding, exhaust at pull-away, brake lights at dusk). Not part of CI.
// Run: node tools/serve.mjs 5617 &   then   PW_PORT=5617 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/vehicle-life-shots.mjs [door,traffic,bus,exhaust,dusk]
import { chromium } from "@playwright/test";
import {
  installHelpers,
  installWatchers,
  installViews,
} from "../../tests/vehicle-life-drivers.mjs";

const PORT = process.env.PW_PORT || 5617;
const OUT = "features/kampung-quest-playability/shots/vehicle-life-";
const want = (process.argv[2] || "door,traffic,bus,exhaust,dusk").split(",");
const url = `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low`;

/** Browser-side: the hero beside car1; press Drive and stop in the middle of the get-in, the door open. */
function doorShot() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.setHold(true);
  window.__kq.setMinute(11 * 60);
  T.stand(-22, 4.1, Math.PI);
  G.Vehicles.press("vehicle:car1");
  T.frames(
    100,
    () => !(T.veh().scene && T.veh().scene.phase === "open" && T.veh().scene.door > 0.6),
  );
  const p = window.__kq.state().pos;
  G.Camera.shot({
    target: { x: p.x, y: 0.8, z: p.z - 0.9 },
    yaw: Math.PI - 0.55,
    pitch: 0.14,
    dist: 4.4,
    lift: 0.6,
    rate: 60,
  });
  window.__kq.step(60);
}

/** Browser-side: a traffic car with a driver and two passengers stopped for the hero, seen from its driver's side. */
function trafficShot() {
  const G = window.KQ.Game;
  const T = window.__vl;
  window.__kq.setMinute(11 * 60);
  G.Traffic.setHold(true);
  G.Traffic.clear();
  T.stand(0.95, 12, 0);
  G.Traffic.force({ dir: 1, u: -12, speed: 4, passengers: 2 });
  T.frames(30 * 6, () => {
    window.__kq.place(0.95, 12, 0);
    return !(T.tcar().speed < 0.2);
  });
  const c = T.tcar();
  G.Camera.shot({
    target: { x: c.x, y: 0.85, z: c.z },
    yaw: Math.PI / 2 + 0.5,
    pitch: 0.13,
    dist: 5,
    lift: 0.6,
    rate: 60,
  });
  window.__kq.step(120);
}

/** Browser-side: the bus at the stop with a waiting person walking up to the front door. */
function busShot() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.setHold(true);
  G.Traffic.clear();
  window.__kq.setMinute(450);
  T.view("stop");
  const walking = () =>
    G.S.crowd.members.find((m) => m.onArrive && Math.hypot(m.x - 20, m.z - 4.3) < 2.2);
  T.frames(30 * 60, () => !(T.veh().bus.pending > 0 && T.veh().bus.doors > 0.9 && walking()));
}

/** Browser-side: a diesel car just pulling away from the hero standing behind it (the ordinary chase camera). */
function exhaustShot() {
  const G = window.KQ.Game;
  const T = window.__vl;
  window.__kq.setMinute(11 * 60);
  G.Traffic.setHold(true);
  G.Traffic.clear();
  T.stand(0.95, -20, 0);
  const id = G.Traffic.force({ dir: 1, u: -14, speed: 0.2, passengers: 1 });
  const rig = G.Traffic.byId(id).mesh.rig;
  if (rig && rig.exhaust && rig.exhaust.fuel === "petrol") rig.exhaust.fuel = "diesel"; // greyer, more at pull-away
  T.frames(26);
  window.__kq.step(60);
  return G.Exhaust.debug();
}

/** Browser-side: dusk (18:52), the hero's car braking after a short drive, seen from the chase camera (head and brake lamps). */
function duskShot() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.setHold(true);
  G.Traffic.clear();
  window.__kq.setMinute(1132);
  T.stand(-22, 4.1, Math.PI);
  G.Vehicles.press("vehicle:car1");
  G.Vehicles.finishScene();
  T.frames(4);
  window.__kq.input("up", true);
  T.frames(45);
  window.__kq.input("up", false);
  T.frames(10);
  window.__kq.step(150);
  const card = document.getElementById("kqAzan");
  if (card) card.style.display = "none"; // jumping the clock fired Asar's card; the picture is about the lamps
}

const shots = {
  door: doorShot,
  traffic: trafficShot,
  bus: busShot,
  exhaust: exhaustShot,
  dusk: duskShot,
};
const names = {
  door: "door-entry",
  traffic: "traffic-car",
  bus: "bus-boarding",
  exhaust: "exhaust-pull-away",
  dusk: "brake-lights-dusk",
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto(url);
await page.waitForFunction(() => window.__kq && window.__kq.loaded, null, { timeout: 90000 });
await page.locator("#kq button.primary").first().click();
await page.waitForFunction(() => window.__kq.ready, null, { timeout: 30000 });
await page.evaluate(() => window.__kq.step(300));
for (const f of [installHelpers, installWatchers, installViews]) await page.evaluate(f);
for (const key of want) {
  const out = await page.evaluate(shots[key]);
  if (out) console.log(JSON.stringify(out));
  await page.screenshot({ path: OUT + names[key] + ".png" });
  console.log("shot", OUT + names[key] + ".png");
}
await browser.close();
