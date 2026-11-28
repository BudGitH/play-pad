// Browser-side drivers for tests/kampung-quest-vehicle-life.spec.mjs. Each function is sent to the page with
// page.evaluate(fn), so it may use only `window` globals (the shared helpers are installed as window.__vl by
// installHelpers), never other names from this module. Kept as functions of at most 40 lines (lint).

/** Install the shared helpers on window.__vl: frames, vehicle lookups, a stub rig and a place-the-hero shortcut. */
export function installHelpers() {
  const G = window.KQ.Game;
  const frames = (n, each) => {
    for (let i = 0; i < n; i += 1) {
      G.Loop.frame(1 / 30, true);
      if (each && each(i) === false) return i;
    }
    return n;
  };
  const veh = () => G.Vehicles.debug();
  const car = (id) => veh().list.find((v) => v.id === id);
  const tcar = () => G.Traffic.debug().cars.find((c) => c.state !== "away");
  /** A rig stand-in: doors that record how open they are, and lamps that record what is lit. */
  const stubRig = (id, side) => {
    const mesh = G.Vehicles.byId(id).mesh;
    const rig = mesh.rig || mesh; // the looks branch's rig, or the record
    const rec = { door: [], lamps: {}, other: [] };
    rig.doors = [
      { side: side === "R" ? "L" : "R", seat: 1, open: (t) => rec.other.push(t) },
      { side, seat: "driver", open: (t) => rec.door.push(t) },
    ];
    rig.lights = {
      setBrake: (on) => (rec.lamps.brake = on),
      setHead: (on) => (rec.lamps.head = on),
      setReverse: (on) => (rec.lamps.reverse = on),
      setIndicator: (s) => (rec.lamps.indicator = s),
      setRunning: () => null,
      state: () => ({}),
    };
    return rec;
  };
  const stand = (x, z, h) => {
    window.__kq.place(x, z, h);
    G.Camera.state.yaw = h;
    window.__kq.step(150);
  };
  window.__vl = { frames, veh, car, tcar, stubRig, stand };
}

/** Install the watchers that need the helpers above: parking cycle and camera views (window.__vl). */
export function installWatchers() {
  const G = window.KQ.Game;
  const { frames, tcar, veh } = window.__vl;
  /** Press Exit and run until he is out: brake to a stop, skip the step-out scene. */
  const leave = () => {
    G.Vehicles.press("vehicle:exit");
    frames(240, () => {
      if (veh().scene) G.Vehicles.finishScene();
      return veh().mounted !== null;
    });
  };
  /** Step until the traffic car has parked, let its people out, taken new ones aboard and driven off. */
  const watchPark = () => {
    const out = { states: [], ind: {}, aboardMin: 9, aboardMax: 0, driverBack: false };
    frames(3000, function () {
      const c = tcar();
      if (!c) return false;
      if (out.states[out.states.length - 1] !== c.state) out.states.push(c.state);
      if (c.lights.indicator) out.ind[c.lights.indicator] = true;
      out.aboardMin = Math.min(out.aboardMin, c.aboard);
      out.aboardMax = Math.max(out.aboardMax, c.aboard);
      if (c.state === "drive" && out.states.includes("bay-out") && c.aboard > 0)
        out.driverBack = true;
      return !out.driverBack;
    });
    return out;
  };
  Object.assign(window.__vl, { watchPark, leave });
}

/** Install the camera views (window.__vl.view): the bus at its stop, or the N-S street. */
export function installViews() {
  const G = window.KQ.Game;
  const { veh, stand } = window.__vl;
  /** Put the camera on a view: the bus at its stop with the doors open, or the N-S street. */
  const view = (name) => {
    G.Camera.clearShot();
    if (name === "street") {
      stand(0.95, 22, Math.PI);
      G.Camera.shot({
        target: { x: 0, y: 0, z: 10 },
        yaw: Math.PI,
        pitch: 0.3,
        dist: 14,
        lift: 0.7,
        rate: 60,
      });
      return;
    }
    stand(30, 8, -Math.PI / 2);
    for (let i = 0; i < 4000 && !(veh().bus.state === "stop" && veh().bus.doors > 0.9); i += 1)
      G.Loop.frame(1 / 30, true);
    const b = veh().bus;
    window.__kq.place(b.x - 7.6, 4.4, Math.PI / 2);
    G.Camera.shot({
      target: { x: b.x - 2, y: 0, z: b.z },
      yaw: 1.85,
      pitch: 0.3,
      dist: 9,
      lift: 0.7,
      rate: 60,
    });
  };
  Object.assign(window.__vl, { view });
}

/** Press Drive beside car1 and record every phase of the scene, the door and whether the held stick did anything. */
export function getIn() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.setHold(true);
  T.stand(-22, 4.1, Math.PI);
  const rec = T.stubRig("car1", "R");
  const log = [];
  G.Vehicles.press("vehicle:car1");
  window.__kq.input("up", true); // held through the whole scene: input is locked
  const n = T.frames(120, function () {
    const d = T.veh();
    log.push({ phase: d.scene ? d.scene.phase : null, entering: d.entering, mounted: d.mounted });
    return !d.mounted;
  });
  const moved = T.car("car1");
  window.__kq.input("up", false);
  return { secs: n / 30, log, rec, moved: { x: moved.x, z: moved.z, speed: moved.speed } };
}

/** Drive a few seconds then press Exit; the phases, where the hero ends (driver's side, free ground). */
export function getOut() {
  const G = window.KQ.Game;
  const T = window.__vl;
  window.__kq.input("up", true);
  T.frames(75);
  window.__kq.input("up", false);
  G.Vehicles.press("vehicle:exit");
  const phases = [];
  const n = T.frames(240, function () {
    const d = T.veh();
    const p = d.scene ? d.scene.phase : null;
    if (p && phases[phases.length - 1] !== p) phases.push(p);
    return d.mounted || d.exiting;
  });
  const hero = window.__kq.state().pos;
  const v = T.car("car1");
  const lat = (hero.x - v.x) * Math.cos(v.heading) - (hero.z - v.z) * Math.sin(v.heading);
  const free = !G.Collide.blockedAt(G.S.world.colliders, hero.x, hero.z, G.Player.RADIUS - 0.02);
  return { phases, secs: n / 30, lat, free, mounted: T.veh().mounted };
}

/** Press Drive, press again (skips), press Exit, wait for the stop, press again (skips). */
export function skipScene() {
  const G = window.KQ.Game;
  const T = window.__vl;
  T.stand(-22, 4.1, Math.PI);
  G.Vehicles.press("vehicle:car1");
  T.frames(10);
  const during = T.veh().entering;
  G.Vehicles.press("vehicle:car1");
  T.frames(2);
  const mounted = T.veh().mounted;
  G.Vehicles.press("vehicle:exit");
  T.frames(60);
  G.Vehicles.press("vehicle:exit");
  T.frames(3);
  return { during, mounted, after: T.veh().mounted, scene: T.veh().scene };
}

/** Get on and off a bicycle and a scooter: the phases, how long, whether he ended up on it. */
export function twoWheelers() {
  const G = window.KQ.Game;
  const T = window.__vl;
  const out = {};
  for (const kind of ["bike", "moto"]) {
    const v = T.veh().list.find((x) => x.kind === kind);
    T.stand(v.x + 0.7, v.z + 0.2, 0);
    G.Vehicles.press("vehicle:" + v.id);
    const phases = [];
    const n = T.frames(60, () => {
      const s = T.veh().scene;
      if (s && phases[phases.length - 1] !== s.phase) phases.push(s.phase);
      return !T.veh().mounted;
    });
    out[kind] = { phases, secs: n / 30, mounted: T.veh().mounted === v.id };
    G.Vehicles.press("vehicle:exit");
    T.frames(120, () => T.veh().mounted !== null);
  }
  return out;
}

/** Mount car1 (scene skipped) with a stub rig, drive and brake, and record the lit lamps at each moment. */
export function lightsDrive() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.setHold(true);
  window.__kq.setMinute(12 * 60);
  T.stand(-22, 4.1, Math.PI);
  const rec = T.stubRig("car1", "R");
  G.Vehicles.press("vehicle:car1");
  G.Vehicles.finishScene();
  T.frames(4);
  const at = () => Object.assign({}, T.veh().lights, { speed: T.car("car1").speed });
  const out = { still: at() };
  window.__kq.input("up", true);
  T.frames(50);
  out.accel = at();
  window.__kq.input("up", false);
  T.frames(6);
  out.coast = at();
  T.frames(60);
  out.halt = at();
  window.__kq.input("down", true);
  T.frames(45);
  out.reverse = at();
  window.__kq.input("down", false);
  return Object.assign(out, { rigNow: Object.assign({}, rec.lamps) });
}

/** Noon, dusk, then get out: the headlights, and the lamps once he is out. */
export function headLights() {
  const G = window.KQ.Game;
  const T = window.__vl;
  window.__kq.setMinute(12 * 60);
  T.frames(5);
  const day = T.veh().lights.head;
  window.__kq.setMinute(1132); // 18:52, dusk, just before the Maghrib azan
  T.frames(5);
  const dusk = T.veh().lights.head;
  G.Audio.stopAzan(); // jumping the clock forward fired the earlier prayers' azans
  window.__kq.setMinute(12 * 60); // and back to noon rebuilds the prayer tracker
  T.frames(3);
  T.leave();
  const off = G.Vehicles.byId("car1").life;
  return {
    day,
    dusk,
    off: { brake: off.brake, head: off.head, engine: off.engine },
    mounted: T.veh().mounted,
  };
}

/** Mount a vehicle (optionally giving it a fuel through a stub exhaust), accelerate, report ITS puffs (and the pool). */
export function exhaustDrive([id, fuel]) {
  const G = window.KQ.Game;
  const T = window.__vl;
  const v = G.Vehicles.byId(id);
  if (fuel)
    (v.mesh.rig || v.mesh).exhaust = { pos: { x: 0.4, y: 0.3, z: -(v.mesh.foot.hl || 1.9) }, fuel };
  const before = { puffs: v.puffs || 0, silent: v.silent || 0 };
  T.stand(v.sim.x + 1.4, v.sim.z + 1.2, 0);
  G.Vehicles.press("vehicle:" + id);
  G.Vehicles.finishScene();
  T.frames(3);
  window.__kq.input("up", true);
  let peak = 0;
  T.frames(90, () => {
    peak = Math.max(peak, G.Exhaust.debug().alive);
  });
  window.__kq.input("up", false);
  const pool = G.Exhaust.debug();
  T.leave();
  return {
    puffs: (v.puffs || 0) - before.puffs,
    silent: (v.silent || 0) - before.silent,
    peak,
    cap: pool.cap,
  };
}

/** How many exhaust Points the scene holds. */
export function pointsCount() {
  return window.KQ.Game.S.scene.children.filter((o) => o.isPoints && o.name === "exhaust").length;
}

/** A traffic car far from the hero: the puffs it made. */
export function farExhaust() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.clear();
  G.Traffic.setHold(true);
  T.stand(60, 50, 0);
  const before = G.Exhaust.debug().spawned;
  G.Traffic.force({ dir: 1, u: -60, speed: 5, passengers: 0 });
  T.frames(90);
  const far = G.Exhaust.debug().spawned - before;
  G.Traffic.clear();
  return far;
}

/** Let the traffic run for 90 s of game time at a quiet hour; how many cars, did they move, did each have a driver. */
export function trafficRuns() {
  const G = window.KQ.Game;
  const T = window.__vl;
  window.__kq.setMinute(210); // 03:30, a quiet hour
  G.Traffic.clear();
  G.Traffic.setHold(false);
  window.__kq.place(30, -45, 0);
  const out = { max: 0, moved: 0, empty: false };
  T.frames(2700, function () {
    const list = G.Traffic.debug().cars.filter((c) => c.state !== "away");
    out.max = Math.max(out.max, list.length);
    list.forEach((c) => {
      if (c.aboard < 1 && (c.state === "drive" || c.state === "bay-in")) out.empty = true;
      if (c.speed > 2) out.moved += 1;
    });
  });
  G.Traffic.setHold(true);
  const d = G.Traffic.debug();
  return Object.assign(out, { spawned: d.spawned, allowed: d.allowed });
}

/** A southbound car, a person on the zebra crossing at z 10 (not in its lane): it must stop before it, then go on. */
export function crossingCase() {
  const G = window.KQ.Game;
  const T = window.__vl;
  window.__kq.setMinute(210);
  G.Traffic.clear();
  G.Traffic.setHold(true);
  T.stand(-2.4, 10.2, Math.PI / 2);
  G.Traffic.force({ dir: 1, u: -8, speed: 6, passengers: 1 });
  let braked = false;
  T.frames(120, () => {
    braked = braked || T.tcar().braking;
  });
  const held = T.tcar();
  const out = { held: { z: held.z, speed: held.speed }, braked };
  T.stand(-12, 12, 0); // the person leaves the crossing
  T.frames(150);
  out.after = { z: T.tcar() ? T.tcar().z : 999 };
  return out;
}

/** The hero stands in a car's lane 20 m ahead: it stops short, honks once; he steps aside and it goes on. */
export function laneCase() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.clear();
  T.stand(0.95, -20, 0);
  G.Traffic.force({ dir: 1, u: -50, speed: 7, passengers: 0 });
  let gap = Infinity;
  const honks = G.Traffic.debug().honks;
  T.frames(330, function () {
    window.__kq.place(0.95, -20, 0);
    gap = Math.min(gap, -20 - T.tcar().z - 1.9);
  });
  const c = T.tcar();
  const out = { gap, speed: c.speed, honked: G.Traffic.debug().honks - honks };
  T.stand(8, -20, 0);
  T.frames(150);
  out.moved = T.tcar() ? T.tcar().z > -18 : true;
  return out;
}

/** A traffic car's collider: an oriented box on the car, not counted among the parked vehicles, gone when it leaves. */
export function solidCase() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.clear();
  const before = G.S.world.colliders.filter((c) => c.vehicle).length;
  const none = G.S.world.colliders.filter((c) => c.traffic).length;
  T.stand(0.95, -40, 0);
  const id = G.Traffic.force({ dir: 1, u: -30, speed: 3, passengers: 0 });
  T.frames(30);
  const col = G.S.world.colliders.find((c) => c.traffic === id);
  const c = T.tcar();
  const onCar = col ? Math.hypot(col.obb.x - c.x, col.obb.z - c.z) : 99;
  const vehicles = G.S.world.colliders.filter((x) => x.vehicle).length;
  G.Traffic.clear();
  return {
    before,
    none,
    has: Boolean(col && col.obb),
    onCar,
    vehicles,
    gone: G.S.world.colliders.filter((x) => x.traffic).length,
  };
}

/** One parking cycle with stub doors: states, indicators, who was aboard, who walked off and who got in. */
export function parkCase() {
  const G = window.KQ.Game;
  const T = window.__vl;
  window.__kq.setMinute(660); // 11:00
  G.Traffic.clear();
  G.Traffic.setHold(true);
  T.stand(10, -21, Math.PI / 2);
  const id = G.Traffic.force({
    dir: 1,
    u: -50,
    speed: 5,
    passengers: 2,
    bay: true,
    forceBoard: true,
  });
  const L = [];
  const R = [];
  (G.Traffic.byId(id).mesh.rig || G.Traffic.byId(id).mesh).doors = [
    { side: "L", seat: 1, open: (t) => L.push(t) },
    { side: "R", seat: "driver", open: (t) => R.push(t) },
  ];
  const base = G.Traffic.debug().park;
  const out = T.watchPark();
  const p = G.Traffic.debug().park;
  G.Traffic.clear();
  const end = (a) => ({ max: Math.max(...a), last: a[a.length - 1] });
  return Object.assign(out, {
    exited: p.exited - base.exited,
    boarded: p.boarded - base.boarded,
    doorL: end(L),
    doorR: end(R),
  });
}

/** Run the bus to its stop at the busy hour (7:30) and watch who is aboard, who gets off and who gets on. */
export function busStop() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.clear();
  G.Traffic.setHold(true);
  window.__kq.setMinute(450);
  T.stand(30, 8, -Math.PI / 2);
  window.__kq.step(1500);
  const s0 = T.veh().bus;
  const out = { seated: 0, door: 0 };
  T.frames(30 * 120, function () {
    const b = T.veh().bus;
    if (b.state !== "away") out.seated = Math.max(out.seated, b.riders);
    if (b.state === "stop") out.door = Math.max(out.door, b.doors);
    const done =
      b.stops > s0.stops &&
      b.state === "drive" &&
      b.boarded + b.alighted > s0.boarded + s0.alighted;
    return !done;
  });
  const b = T.veh().bus;
  return Object.assign(out, {
    alighted: b.alighted - s0.alighted,
    boarded: b.boarded - s0.boarded,
    riders: b.riders,
    pending: b.pending,
  });
}

/** Watch the bus for a whole stop: which indicators and brake lights it showed. */
export function busLights() {
  const T = window.__vl;
  const seen = { L: false, R: false, brake: false };
  T.stand(30, 8, -Math.PI / 2);
  window.__kq.step(1500);
  T.frames(30 * 120, () => {
    const b = T.veh().bus;
    if (b.state === "away") return true;
    if (b.lights.indicator) seen[b.lights.indicator] = true;
    if (b.state === "stop" && b.lights.brake) seen.brake = true;
    return !(seen.L && seen.R && seen.brake);
  });
  return seen;
}

/** Draw calls (the whole frame, shadows included) in a view, before and after four traffic cars are put in it. */
export function callsAt([view, cars]) {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.clear();
  G.Traffic.setHold(true);
  window.__kq.setMinute(450);
  T.view(view);
  window.__kq.step(400);
  const base = window.__kq.stats().calls;
  const place = view === "stop" ? [-3, 4, -8, 2] : [8, 0, 14, -8];
  for (let i = 0; i < cars; i += 1)
    G.Traffic.force({ dir: i % 2 ? -1 : 1, u: place[i], speed: 0.001, passengers: 2 });
  window.__kq.step(300);
  const shown = G.Traffic.debug().cars.filter((c) => c.state !== "away" && c.visible).length;
  const out = { base, withCars: window.__kq.stats().calls, cars: shown };
  G.Traffic.clear();
  return out;
}

/** Mount car1 and report the sound counters before, during the scene, while driving, and after getting out. */
export function soundDrive() {
  const G = window.KQ.Game;
  const T = window.__vl;
  window.__kq.setMinute(12 * 60);
  G.Traffic.setHold(true);
  T.stand(-22, 4.1, Math.PI);
  const s0 = G.VehicleSound.debug();
  G.Vehicles.press("vehicle:car1");
  T.frames(60); // the scene plays: a door opens, a door shuts
  const scene = G.VehicleSound.debug();
  T.frames(30);
  const driving = G.VehicleSound.debug();
  T.leave();
  return { s0, scene, driving, out: G.VehicleSound.debug() };
}

/** A bicycle: the whirr while pedalled, the freewheel ticks while it coasts. */
export function bicycleSound() {
  const G = window.KQ.Game;
  const T = window.__vl;
  const bike = T.veh().list.find((v) => v.kind === "bike");
  T.stand(bike.x + 0.7, bike.z + 0.2, 0);
  G.Vehicles.press("vehicle:" + bike.id);
  G.Vehicles.finishScene();
  T.frames(3);
  window.__kq.input("up", true);
  T.frames(70);
  const pedalling = G.VehicleSound.debug();
  window.__kq.input("up", false);
  T.frames(70);
  const coasting = G.VehicleSound.debug();
  T.leave();
  return { whirr: pedalling.engine, ticks: coasting.ticks - pedalling.ticks };
}

/** The hum of the nearest traffic car: close by, then far away, then none. */
export function otherHum() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.clear();
  T.stand(8, -20, 0);
  G.Traffic.force({ dir: 1, u: -26, speed: 5, passengers: 0 });
  T.frames(20);
  const near = G.VehicleSound.debug().other;
  T.stand(60, 60, 0);
  T.frames(60);
  const far = G.VehicleSound.debug().other;
  G.Traffic.clear();
  T.frames(40);
  return { near, far, none: G.VehicleSound.debug().other };
}

/** Mount car1 and silence it three ways: mute, pause, the azan (the last one leaves the prayer flow open). */
export function soundGates() {
  const G = window.KQ.Game;
  const T = window.__vl;
  T.stand(-22, 4.1, Math.PI);
  G.Vehicles.press("vehicle:car1");
  G.Vehicles.finishScene();
  T.frames(40);
  const out = { hum: G.VehicleSound.debug().engine };
  const refused = () => G.VehicleSound.debug().refused;
  let r0 = refused();
  window.__kq.action("mute");
  T.frames(30);
  out.muted = {
    engine: G.VehicleSound.debug().engine,
    cue: G.VehicleSound.cue("doorOpen"),
    more: refused() - r0,
  };
  window.__kq.action("mute");
  T.frames(30);
  out.back = G.VehicleSound.debug().engine;
  G.Audio.setPaused(true);
  r0 = refused();
  out.paused = { cue: G.VehicleSound.cue("hiss"), more: refused() - r0 };
  G.Audio.setPaused(false);
  window.__kq.forcePrayer("zohor");
  T.frames(40);
  r0 = refused();
  const d = G.VehicleSound.debug();
  const horn = G.VehicleSound.horn("car");
  out.azan = {
    engine: d.engine,
    quietBy: d.quietBy,
    cue: G.VehicleSound.cue("doorClose"),
    horn,
    more: refused() - r0,
  };
  return out;
}

/** Makkah: a car on the outer street, never inside a no-drive zone; which side the driver sits. */
export function makkahTraffic() {
  const G = window.KQ.Game;
  const T = window.__vl;
  const routes = G.TrafficRoutes.routes();
  G.Traffic.setHold(true);
  T.stand(0, 70, 0);
  const id = G.Traffic.force({ dir: 1, u: -60, speed: 6, passengers: 1 });
  const out = { routes: routes.map((x) => x.id), inside: 0, moved: 0 };
  T.frames(30 * 12, () => {
    const c = T.tcar();
    if (!c) return false;
    if (window.KQ.Holy.inNoDrive(c.x, c.z, 0)) out.inside += 1;
    if (c.speed > 2) out.moved += 1;
    return true;
  });
  const c = T.tcar();
  return Object.assign(out, {
    aboard: c ? c.aboard : 0,
    driverSide: G.Traffic.byId(id).mesh.seatX,
    allowed: G.Traffic.debug().allowed,
  });
}

/** Every sample of every outer lane that comes within 6 m of a no-drive zone (should be none). */
export function laneClearance() {
  const G = window.KQ.Game;
  const holy = window.KQ.Holy;
  const out = [];
  G.TrafficRoutes.routes().forEach((r) => {
    for (const side of [-1, 1]) {
      for (let u = r.from; u <= r.to; u += 4) {
        if (holy.inNoDrive(u, r.centre + side * r.lane, 6)) out.push([r.id, u, side]);
      }
    }
  });
  return out;
}

/** Draw calls in Makkah with and without two traffic cars and their people in view. */
export function makkahCalls() {
  const G = window.KQ.Game;
  const T = window.__vl;
  G.Traffic.clear();
  T.stand(-10, 70, Math.PI / 2);
  window.__kq.step(300);
  const base = window.__kq.stats().calls;
  G.Traffic.force({ dir: 1, u: -4, speed: 0.001, passengers: 2 });
  G.Traffic.force({ dir: -1, u: 8, speed: 0.001, passengers: 2 });
  window.__kq.step(300);
  return { base, withCars: window.__kq.stats().calls };
}
