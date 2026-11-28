// Kampung Quest: vehicles that feel lived in (features/kampung-quest-playability/notes-vehicle-life.md).
//   - getting in and out: walk to the door, open it, climb in, shut it (1.2-1.8 s, input locked, skippable);
//   - brake, reverse and head lights; exhaust for petrol and diesel only, never electric;
//   - ambient traffic: cars with drivers and passengers, braking for people, stopping before a zebra crossing, parking
//     (people step out, others get in), a moving solid like the bus;
//   - the bus's passengers: seated people, 1-3 off and 1-3 on at the stop; its indicators and brake lights;
//   - sounds that start and stop with the vehicle and obey mute, pause and the azan;
//   - the draw-call budget (< 400 on the low tier) at the bus stop and on the street with traffic on.
// The page runs `?still=1` (time moves only through Loop.frame). The doors and lamps are the model's own (the rig API in
// js/game/vehicle-rig.js); these specs stub them so they pass before and after the looks branch. Pure rules:
// tests/kampung-quest/{vehicle-life,traffic,vehicle-mix}.test.mjs. Set KQ_SHOTS=1 to write the screenshots into
// features/kampung-quest-playability/shots/vehicle-life-*.png.
// Run: PW_PORT=5616 npx playwright test tests/kampung-quest-vehicle-life.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";
import * as D from "./vehicle-life-drivers.mjs";

const BASE = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

async function boot(page, region) {
  await page.goto(BASE + (region === "haramain" ? "&region=haramain" : ""));
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await kq(page, () => window.__kq.step(300));
  await kq(page, D.installHelpers);
  await kq(page, D.installWatchers);
  await kq(page, D.installViews);
}

/* ------------------------------ getting in and out ------------------------------ */

async function checkGetIn(page) {
  const r = await kq(page, D.getIn);
  const phases = r.log.map((l) => l.phase).filter((p, i, a) => p && p !== a[i - 1]);
  expect(phases.slice(0, 4), JSON.stringify(phases)).toEqual(["walk", "open", "climb", "close"]);
  expect(r.secs, "1.2 - 1.8 s").toBeGreaterThanOrEqual(1.2);
  expect(r.secs).toBeLessThanOrEqual(1.8);
  expect(r.log.filter((l) => l.phase).every((l) => l.entering && !l.mounted)).toBe(true);
  expect(r.rec.door.length, "the driver's door was driven").toBeGreaterThan(5);
  expect(Math.max(...r.rec.door)).toBe(1);
  expect(r.rec.door[r.rec.door.length - 1], "and shut again").toBe(0);
  expect(
    r.rec.other.every((t) => t === 0),
    "the far door never opened",
  ).toBe(true);
  expect(r.moved.speed, "the held stick did nothing during the scene").toBeLessThan(0.5);
  expect((await kq(page, () => window.__kq.vehicles())).mounted).toBe("car1");
}

async function checkGetOut(page) {
  const r = await kq(page, D.getOut);
  expect(r.phases, JSON.stringify(r)).toEqual(["open", "climb", "close"]);
  expect(r.secs).toBeLessThan(6);
  expect(r.mounted).toBeNull();
  expect(r.free, "set down on free ground").toBe(true);
  expect(r.lat, "on the driver's (right-hand) side in the kampung").toBeLessThan(-0.8);
  expect(await kq(page, () => window.__kq.vehicles().exiting)).toBe(false);
}

async function checkSkip(page) {
  const r = await kq(page, D.skipScene);
  expect(r).toMatchObject({ during: true, mounted: "car1", after: null, scene: null });
}

async function checkTwoWheelers(page) {
  const r = await kq(page, D.twoWheelers);
  for (const kind of ["bike", "moto"]) {
    expect(r[kind].mounted, kind).toBe(true);
    expect(r[kind].secs, kind).toBeLessThan(2);
    expect(r[kind].phases[r[kind].phases.length - 1], kind).toBe("swing");
  }
}

function sceneTests(getPage) {
  test("getting in: walk to the right-hand door, it opens, he climbs in, it shuts; input is locked", () =>
    checkGetIn(getPage()));
  test("getting out: the door opens, he steps out on the driver's side onto free ground", () =>
    checkGetOut(getPage()));
  test("pressing the button again skips the scene in both directions", () => checkSkip(getPage()));
  test("a bicycle and a scooter: a short step and swing, no door, input locked meanwhile", () =>
    checkTwoWheelers(getPage()));
}

/* ------------------------------ lights and exhaust ------------------------------ */

async function checkBrakeLights(page) {
  const r = await kq(page, D.lightsDrive);
  expect(r.still.engine && r.still.brake, "stopped, engine on: brake lights").toBe(true);
  expect(r.accel.speed).toBeGreaterThan(4);
  expect(r.accel.brake, "speeding up: off").toBe(false);
  expect(r.coast.brake, "letting go and slowing: on").toBe(true);
  expect(r.halt.brake && Math.abs(r.halt.speed) < 0.3, "halted: on").toBe(true);
  expect(r.reverse.speed).toBeLessThan(-0.3);
  expect(r.reverse.reverse, "rolling backwards: reverse light").toBe(true);
  expect(r.reverse.brake, "reversing is not braking").toBe(false);
  expect(r.rigNow.reverse, "the rig was told").toBe(true);
  expect(r.still.rig, "the stub rig has lamps").toBe(true);
}

async function checkHeadLights(page) {
  const r = await kq(page, D.headLights);
  expect(r.day, "no headlights at noon").toBe(false);
  expect(r.dusk, "headlights at 19:00").toBe(true);
  expect(r.off).toEqual({ brake: false, head: false, engine: false });
  expect(r.mounted).toBeNull();
}

async function checkExhaust(page) {
  await kq(page, () => window.__kq.setMinute(12 * 60));
  const petrol = await kq(page, D.exhaustDrive, ["car1", null]);
  expect(petrol.puffs, "a petrol car: " + JSON.stringify(petrol)).toBeGreaterThan(2);
  expect(petrol.peak).toBeGreaterThan(0);
  expect(petrol.peak, "a capped pool").toBeLessThanOrEqual(petrol.cap);
  const lorry = await kq(page, () => window.__vl.veh().list.find((v) => v.kind === "lorry").id);
  const diesel = await kq(page, D.exhaustDrive, [lorry, null]);
  expect(diesel.puffs, "a diesel lorry: " + JSON.stringify(diesel)).toBeGreaterThan(petrol.puffs);
  const electric = await kq(page, D.exhaustDrive, ["car2", "electric"]);
  expect(electric.puffs, "an electric car never puffs: " + JSON.stringify(electric)).toBe(0);
  expect(electric.silent, "it was seen with its engine on").toBeGreaterThan(0);
  expect(await kq(page, D.pointsCount), "one Points for all puffs").toBe(1);
}

async function checkExhaustRange(page) {
  expect(await kq(page, D.farExhaust), "too far to matter: no puffs").toBe(0);
}

function lightTests(getPage) {
  test("lights: brake when stopped or slowing with the engine on, not while speeding up; reverse light", () =>
    checkBrakeLights(getPage()));
  test("lights: headlights from dusk, off by day; everything off once he gets out", () =>
    checkHeadLights(getPage()));
  test("exhaust: a petrol car puffs, a diesel lorry puffs, an electric car never; one Points", () =>
    checkExhaust(getPage()));
  test("exhaust: nothing is made for a vehicle far from the hero", () =>
    checkExhaustRange(getPage()));
}

/* ------------------------------ traffic ------------------------------ */

async function checkTrafficRuns(page) {
  const r = await kq(page, D.trafficRuns);
  expect(r.allowed).toBe(2);
  expect(r.spawned, JSON.stringify(r)).toBeGreaterThanOrEqual(1);
  expect(r.max).toBeLessThanOrEqual(r.allowed);
  expect(r.moved, "they drive").toBeGreaterThan(30);
  expect(r.empty, "every car has a driver").toBe(false);
}

async function checkCrossing(page) {
  const r = await kq(page, D.crossingCase);
  expect(r.braked, JSON.stringify(r)).toBe(true);
  expect(r.held.speed, JSON.stringify(r)).toBeLessThan(0.3);
  expect(r.held.z, "stopped before the stripes at z 10 (its bumper is 1.9 m ahead)").toBeLessThan(
    7.5,
  );
  expect(r.after.z, "and on its way once the crossing was clear").toBeGreaterThan(12);
}

async function checkHeroInLane(page) {
  const r = await kq(page, D.laneCase);
  expect(r.gap, JSON.stringify(r)).toBeGreaterThan(0.3);
  expect(r.speed).toBeLessThan(0.3);
  expect(r.honked, "a polite honk").toBe(1);
  expect(r.moved).toBe(true);
}

async function checkSolid(page) {
  const r = await kq(page, D.solidCase);
  expect(r.none).toBe(0);
  expect(r.has).toBe(true);
  expect(r.onCar).toBeLessThan(0.3);
  expect(r.vehicles, "not counted among the parked vehicles").toBe(r.before);
  expect(r.gone).toBe(0);
}

async function checkParking(page) {
  const r = await kq(page, D.parkCase);
  expect(r.states, JSON.stringify(r.states)).toEqual(
    expect.arrayContaining(["bay-in", "park", "bay-out"]),
  );
  expect(r.ind.L, "left indicator while pulling in").toBe(true);
  expect(r.ind.R, "right indicator while pulling out").toBe(true);
  expect(r.aboardMin, "everybody got out").toBe(0);
  expect(r.aboardMax).toBe(3);
  expect(r.exited, "they walked off into the crowd").toBeGreaterThanOrEqual(3);
  expect(r.boarded, "new people got in").toBeGreaterThanOrEqual(1);
  expect(r.doorL, "the kerb-side door opened and shut").toEqual({ max: 1, last: 0 });
  expect(r.doorR, "so did the driver's").toEqual({ max: 1, last: 0 });
  expect(r.driverBack, "it drove off with a driver").toBe(true);
}

function trafficTests(getPage) {
  test("traffic: cars drive the road with a driver (and sometimes passengers), up to the tier's count", () =>
    checkTrafficRuns(getPage()));
  test("traffic: a person on the zebra crossing (even off its lane) stops the car before it", () =>
    checkCrossing(getPage()));
  test("traffic: it stops short of the hero in its lane, honks once, and goes on when he steps aside", () =>
    checkHeroInLane(getPage()));
  test("traffic: each car is a moving solid (an oriented box), not counted among the parked vehicles", () =>
    checkSolid(getPage()));
  test("traffic: a car pulls into a bay, its people step out through their doors, others get in, it drives off", () =>
    checkParking(getPage()));
}

/* ------------------------------ the bus ------------------------------ */

async function checkBusPeople(page) {
  const r = await kq(page, D.busStop);
  expect(r.seated, "passengers on board before the stop").toBeGreaterThanOrEqual(2);
  expect(r.door).toBeGreaterThan(0.9);
  expect(r.alighted, JSON.stringify(r)).toBeGreaterThanOrEqual(1);
  expect(r.alighted).toBeLessThanOrEqual(3);
  expect(r.boarded, JSON.stringify(r)).toBeGreaterThanOrEqual(1);
  expect(r.boarded).toBeLessThanOrEqual(3);
  expect(r.pending, "nobody left walking up to a bus that has gone").toBe(0);
  const walkers = await kq(
    page,
    () => window.KQ.Game.S.crowd.members.filter((m) => m.walker).length,
  );
  expect(walkers, "the people who got off joined the crowd").toBeGreaterThan(0);
}

async function checkBusLights(page) {
  expect(await kq(page, D.busLights)).toEqual({ L: true, R: true, brake: true });
}

function busTests(getPage) {
  test("the bus: seated passengers, doors open at the stop, 1-3 get off and walk away, 1-3 get on", () =>
    checkBusPeople(getPage()));
  test("the bus: brake lights at the stop, the left indicator pulling in, the right pulling out", () =>
    checkBusLights(getPage()));
}

/* ------------------------------ budget ------------------------------ */

async function checkBudget(page, view) {
  const r = await kq(page, D.callsAt, [view, 4]);
  console.log("calls at the " + view + ":", JSON.stringify(r));
  expect(r.cars, "the cars are in the view").toBeGreaterThanOrEqual(2);
  expect(r.withCars, JSON.stringify(r)).toBeLessThan(400);
  expect(r.withCars - r.base, "four cars with people cost little").toBeLessThan(90);
}

function budgetTests(getPage) {
  test("draw calls on the low tier stay under 400 at the bus stop with traffic on", () =>
    checkBudget(getPage(), "stop"));
  test("draw calls on the low tier stay under 400 on the kampung street with traffic on", () =>
    checkBudget(getPage(), "street"));
}

/* ------------------------------ sound ------------------------------ */

async function checkSoundLifecycle(page) {
  const r = await kq(page, D.soundDrive);
  const n = (d, k) => (d.played[k] || 0) - (r.s0.played[k] || 0);
  expect(n(r.scene, "doorOpen"), JSON.stringify(r.scene)).toBeGreaterThanOrEqual(1);
  expect(n(r.driving, "doorClose")).toBeGreaterThanOrEqual(1);
  expect(n(r.driving, "start"), "a short engine start on entering").toBeGreaterThanOrEqual(1);
  expect(r.driving.engine, "the hum plays while driving").toBe(true);
  expect(r.driving.level, "and it is quiet").toBeLessThan(0.04);
  expect(r.out.engine, "no hum once he is out").toBe(false);
  const audio = await kq(page, () => window.KQ.Game.Audio.debug());
  expect(audio.vehicle, "counted on its own gate").toBeGreaterThan(0);
  expect(audio.vehicleSound.played.doorOpen).toBeGreaterThan(0);
}

async function checkBicycleSound(page) {
  const r = await kq(page, D.bicycleSound);
  expect(r.whirr, "the chain whirrs while pedalling").toBe(true);
  expect(r.ticks, "the freewheel ticks while coasting").toBeGreaterThan(2);
}

async function checkOtherHum(page) {
  const r = await kq(page, D.otherHum);
  expect(r.near.engine, JSON.stringify(r)).toBe(true);
  expect(r.near.level).toBeLessThan(0.03);
  expect(r.far.engine, "out of earshot").toBe(false);
  expect(r.none.engine).toBe(false);
}

async function checkSoundGates(page) {
  const r = await kq(page, D.soundGates);
  expect(r.hum).toBe(true);
  expect(r.muted).toMatchObject({ engine: false, cue: false });
  expect(r.muted.more).toBeGreaterThanOrEqual(1);
  expect(r.back, "the hum comes back when unmuted").toBe(true);
  expect(r.paused).toMatchObject({ cue: false });
  expect(r.paused.more).toBeGreaterThanOrEqual(1);
  expect(r.azan.quietBy).toMatch(/azan|prayer/);
  expect(r.azan).toMatchObject({ engine: false, cue: false, horn: false });
  expect(r.azan.more).toBeGreaterThanOrEqual(2);
}

function soundTests(getPage) {
  test("sound: door clunks, the engine starts and hums while driving, and stops when he gets out", () =>
    checkSoundLifecycle(getPage()));
  test("sound: a bicycle ticks while it coasts and whirrs while pedalled", () =>
    checkBicycleSound(getPage()));
  test("sound: the nearest traffic car is a faint hum that fades with distance", () =>
    checkOtherHum(getPage()));
  test("sound: nothing under mute, pause or the azan (hum, door clunks, horn)", () =>
    checkSoundGates(getPage()));
}

/* ------------------------------ the two pages ------------------------------ */

test.describe("kampung", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });
  let page;
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(150_000);
    page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
    await boot(page, "kampung");
  });
  test.afterAll(async () => page && (await page.close()));
  const get = () => page;
  sceneTests(get);
  lightTests(get);
  trafficTests(get);
  busTests(get);
  budgetTests(get);
  soundTests(get); // last: it ends with the azan, which leaves the prayer flow open
});

async function checkMakkahTraffic(page) {
  const r = await kq(page, D.makkahTraffic);
  expect(r.routes.length).toBeGreaterThanOrEqual(1);
  expect(r.routes.every((id) => /^holy:/.test(id))).toBe(true);
  expect(r.inside, "never inside a no-drive zone").toBe(0);
  expect(r.moved).toBeGreaterThan(30);
  expect(r.aboard).toBeGreaterThanOrEqual(1);
  expect(r.driverSide, "driver on the left in Makkah").toBeGreaterThan(0);
  expect(r.allowed).toBeLessThanOrEqual(3);
}

test.describe("haramain", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  let page;
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(150_000);
    page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
    await boot(page, "haramain");
  });
  test.afterAll(async () => page && (await page.close()));

  test("Makkah: traffic drives only the outer streets, clear of every no-drive zone, driver on the left", () =>
    checkMakkahTraffic(page));
  test("Makkah: every outer lane stays 6 m clear of the Haram, the mataf, the mas'a and the plazas", async () => {
    expect(await kq(page, D.laneClearance)).toEqual([]);
  });
  test("Makkah: the budget holds with cars and their people in view (low tier)", async () => {
    const r = await kq(page, D.makkahCalls);
    expect(r.withCars, JSON.stringify(r)).toBeLessThan(400);
  });
});
