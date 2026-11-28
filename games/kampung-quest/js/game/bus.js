/* ============================================================================
 * FILE: bus.js
 * PURPOSE: The kampung's town bus (route 21, "Kampung"): a generic, unbranded single-deck bus that runs along
 *          the E-W road, westbound on the left-hand lane, pulls in at the bus stop (LAYOUT.busStop), opens its
 *          left-side doors for a few seconds, pulls out, leaves town at the west end, and comes back eastbound
 *          a little later. The hero cannot drive it or ride in it, but he can watch it: a driver and seated
 *          passengers show through its windows, at the stop the doors open, 1-3 people get off and walk away
 *          into the crowd and 1-3 waiting people get on (vehicle-occupants.js); its lights, indicators, exhaust
 *          and sounds (door hiss, kneel) come from the vehicle-life files.
 * BUSINESS CONTEXT: owner request in the playability round ("add a bus or lorry"), notes in
 *   features/kampung-quest-playability/notes-vehicles.md. Child-friendly: the bus brakes for anyone on foot and
 *   for every vehicle ahead (Sim.Vehicle.speedCap), never pushes or hurts anyone, and is a moving solid (one
 *   oriented-box collider updated every frame) so nobody walks through it.
 * HOW IT FITS: Vehicles.update calls Bus.update(dt) every sim step (so `?still` tests drive it with Loop.frame).
 *   Kampung only. It leaves and enters town only out of the hero's reach (ENTRY_CLEAR). Hook: Vehicles.debug().bus.
 * DEPENDENCIES: KQ.Sim.Vehicle, KQ.Figures.Vehicles (the "bus" model), collide.js, vehicles.js, vehicle-spots.js,
 *   KQ.WorldParts.LAYOUT (road and bus stop).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const SV = () => KQ.Sim.Vehicle;
  const S = () => G.S;
  /** Lane centre off the road's middle (left-hand traffic: westbound on +z, eastbound on -z), and at the stop. */
  const LANE = 0.3;
  const KERB_LANE = 1.9;
  /** Where it leaves and enters town (|x|), its cruising speed (m/s), how long it waits with the doors open (s). */
  const END = 70;
  const CRUISE = 7;
  const DWELL = 8;
  /** The bus waits at most this long (s) beyond DWELL for people still walking up to it. */
  const WAIT_MORE = 6;
  /** Held this long (s) by someone beside its path, the bus creeps past at CREEP m/s (see creepCap). */
  const CREEP_AFTER = 6;
  const CREEP = 0.8;
  /** Held this long (s), the bus stops holding back for the crossing's people for the next 12 s (loiterers). */
  const CROSSING_PATIENCE = 3;
  /** The middle door and the front door (z in the bus frame) and how far out the pavement spot is (lateral). */
  const DOOR_MID = 0.35;
  const DOOR_FRONT = 3.95;
  const OUTSIDE = 2.4;
  /** Passengers walk at this pace (m/s); a stop's waiting people within this reach of the door may board (m). */
  const WALK = 1.7;
  const BOARD_REACH = 9;
  /** Seconds out of town between runs, and how far the hero must be from the entry for it to appear. */
  const AWAY = 6;
  const ENTRY_CLEAR = 35;
  /** It pulls in over this many metres before the stop and back out over PULL_OUT after it. */
  const PULL = 24;
  const PULL_OUT = 15;
  /** The front door's distance ahead of the bus's middle (it stops with this door at the shelter). */
  const FRONT_DOOR = 3.95;
  /** Comfortable stopping rate for the stop (m/s^2) and how quickly it speeds up again. */
  const STOP_RATE = 1.5;
  /** Anyone or anything farther than this is not looked at (m). */
  const NEAR = 30;
  const B = {
    ready: false,
    state: "away",
    dir: 1,
    t: 1,
    served: false,
    doors: 0,
    stops: 0,
    braked: 0,
    runs: 0,
    clock: 0,
    heldT: 0,
    noHoldUntil: 0,
    elapsed: 0,
    plan: [],
    pending: 0,
    alighted: 0,
    boarded: 0,
    waitingSeen: 0,
  };

  const smoothstep = (a, b, v) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  /** The middle of the bus when its front door is at the shelter (westbound). */
  function stopX() {
    const bs = KQ.WorldParts.LAYOUT.busStop;
    return (bs.x0 + bs.x1) / 2 + FRONT_DOOR;
  }

  /** Build the bus once the kampung world exists. */
  function ensure() {
    const s = S();
    if (B.ready || !s || !s.world || !s.scene || G.VehicleSpots.region() !== "kampung") return;
    if (!KQ.WorldParts || !KQ.WorldParts.LAYOUT) return;
    B.ready = true;
    B.sim = SV().create("bus", END, -LANE, Math.PI / 2);
    B.mesh = KQ.Figures.Vehicles.build("bus");
    B.mesh.group.visible = false;
    s.scene.add(B.mesh.group);
    B.col = G.Collide.orientedBox(SV().box(B.sim, 0), "bus");
    B.col.vehicle = "bus";
    s.world.colliders.push(B.col);
    B.car = { id: "bus", kind: "bus", style: "bus", sim: B.sim, mesh: B.mesh, y: 0, occ: [] };
    G.Occupants.register(B.car);
    park();
  }

  /** Move the collider out of the world while the bus is out of town. */
  function park() {
    Object.assign(B.col, { minX: 1e5, maxX: 1e5 + 1, minZ: 1e5, maxZ: 1e5 + 1 });
    B.col.obb.x = B.col.obb.z = 1e5;
  }

  /** Keep the collider on the bus's body (one oriented box, updated in place). */
  function syncCollider() {
    const fresh = G.Collide.orientedBox(SV().box(B.sim, 0.02), "bus");
    Object.assign(B.col, {
      minX: fresh.minX,
      maxX: fresh.maxX,
      minZ: fresh.minZ,
      maxZ: fresh.maxZ,
    });
    Object.assign(B.col.obb, fresh.obb);
  }

  /** The lane's z at x: westbound it eases to the kerb before the stop and back out after it; eastbound it keeps -LANE. */
  function laneZ(x) {
    if (B.dir > 0) return -LANE;
    const d = x - stopX();
    const into = 1 - smoothstep(0, PULL, d);
    const out = smoothstep(-PULL_OUT, 0, d);
    const k = d >= 0 ? (B.served ? 1 : into) : out;
    return LANE + (KERB_LANE - LANE) * k;
  }

  /** Everyone and everything the bus must not reach: people on foot, the hero, every drivable vehicle. */
  function obstacles() {
    const s = S();
    const sim = B.sim;
    const out = [];
    const near = (p) => Math.abs(p.x - sim.x) < NEAR && Math.abs(p.z - sim.z) < NEAR;
    s.npcs.agents.forEach((A) => !A.hidden && A.group.visible && near(A) && out.push(A));
    if (s.crowd) s.crowd.members.forEach((m) => m.show > 0.3 && near(m) && out.push(m));
    if (near(s.player.pos)) out.push(s.player.pos);
    G.Vehicles.sims().forEach((v) => near(v) && out.push(...ends(v)));
    if (G.Traffic) G.Traffic.obstacles().forEach((v) => near(v) && out.push(...ends(v)));
    return out.concat(crossingHolds(out));
  }

  /** Test hook: what holds the bus still right now ({x, z}), or null. */
  function blockedBy() {
    if (B.sim.speed > 0.2) return null;
    const hit = obstacles().find((o) => SV().speedCap(B.sim, [o]) < 0.5);
    return hit ? { x: Number(hit.x.toFixed(1)), z: Number(hit.z.toFixed(1)) } : null;
  }

  /**
   * The bus never stops ON a zebra crossing (it would block the very people it is waiting for): for anyone standing
   * on or at the edge of a crossing over its road, it also holds back at a point just before the stripes, so
   * they can cross in front of its nose and it then goes on.
   */
  function crossingHolds(people) {
    const L = KQ.WorldParts && KQ.WorldParts.LAYOUT;
    if (!L || B.clock < B.noHoldUntil) return []; // someone loitering at the crossing must not hold it for good
    const sim = B.sim;
    const nose = sim.x + B.dir * sim.spec.halfLen;
    const out = [];
    L.crossings.forEach(function (c) {
      const hold = c.at - B.dir * 2.6; // just before the stripes, on the side the bus comes from
      if (c.axis !== "x" || (nose - hold) * -B.dir < 0.3) return; // not a crossing over this road, or already past it
      const busy = people.some(
        (p) => Math.abs(p.x - c.at) < 2.2 && Math.abs(p.z) < L.road.half + 0.7,
      );
      if (busy) out.push({ x: hold, z: sim.z });
    });
    return out;
  }

  /** A vehicle as two points, its nose and its tail (a car in the lane holds the bus short of its whole body). */
  function ends(v) {
    const h = v.spec ? v.spec.halfLen : v.halfLen; // a vehicle sim, or a traffic obstacle
    const fx = Math.sin(v.heading) * h;
    const fz = Math.cos(v.heading) * h;
    return [
      { x: v.x + fx, z: v.z + fz },
      { x: v.x - fx, z: v.z - fz },
    ];
  }

  /** The speed the bus wants now: cruising, easing to a halt at the stop, never past anyone ahead. */
  function wanted() {
    let want = CRUISE;
    if (B.dir < 0 && !B.served)
      want = Math.min(want, Math.sqrt(2 * STOP_RATE * Math.max(0, B.sim.x - stopX())));
    const all = obstacles();
    let cap = SV().speedCap(B.sim, all);
    if (cap < 0.5 && B.heldT > CREEP_AFTER) cap = creepCap(all);
    if (cap < want) B.braked += 1;
    B.wantedNow = Math.min(want, cap);
    return B.wantedNow;
  }

  /**
   * Held for a long time by someone standing beside its path (a stroller waiting at the kerb who is waiting for the bus
   * in turn), the bus goes on at a walking pace once nobody is in its way: the same rule with the side margin cut to
   * the body's edge. Anyone in front of it still holds it still.
   */
  function creepCap(all) {
    const narrow = { ...B.sim, spec: { ...B.sim.spec, halfWid: B.sim.spec.halfWid - 0.5 } };
    return Math.min(CREEP, SV().speedCap(narrow, all));
  }

  /** One step of driving: speed toward what it wants, along the lane, then pull in, stop or leave town. */
  function drive(dt) {
    const sim = B.sim;
    const want = wanted();
    B.heldT = sim.speed < 0.2 && want < 0.5 ? B.heldT + dt : 0;
    if (B.heldT > CROSSING_PATIENCE) B.noHoldUntil = B.clock + 12;
    if (sim.speed > want) SV().brakeFor(sim, want, dt);
    else sim.speed = Math.min(want, sim.speed + sim.spec.accel * dt);
    const nx = sim.x + B.dir * sim.speed * dt;
    const nz = laneZ(nx);
    if (Math.abs(nx - sim.x) > 1e-5) sim.heading = Math.atan2(nx - sim.x, nz - sim.z);
    sim.x = nx;
    sim.z = nz;
    if (B.dir < 0 && !B.served && sim.x - stopX() < 0.05 && sim.speed < 0.25) arrive();
    if (B.dir * sim.x > END) leave();
  }

  /** At the stop: stand still, kneel, open the doors and plan who gets off and on. */
  function arrive() {
    B.sim.speed = 0;
    B.state = "stop";
    B.t = DWELL;
    B.elapsed = 0;
    B.stops += 1;
    G.VehicleSound.cue("kneel", B.sim);
    G.VehicleSound.cue("hiss", B.sim);
    G.BusPeople.plan(B);
  }

  /** At the stop: doors open, people get off and on, then the doors shut (hiss) and it goes. */
  function dwell(dt) {
    B.t -= dt;
    B.elapsed += dt;
    G.BusPeople.step(B);
    const wait = B.pending > 0 && B.t > -WAIT_MORE;
    const open = B.t > 0 || wait ? 1 : 0;
    const was = B.doors;
    B.doors += Math.sign(open - B.doors) * Math.min(Math.abs(open - B.doors), dt * 1.6);
    if (was > 0.5 && B.doors <= 0.5) G.VehicleSound.cue("hiss", B.sim);
    if (B.t <= 0 && !wait && B.doors < 0.02) {
      B.served = true;
      B.state = "drive";
    }
  }

  /** Out of town: hide and wait. */
  function leave() {
    B.state = "away";
    B.t = AWAY;
    B.runs += 1;
    B.mesh.group.visible = false;
    G.Occupants.unregister(B.car);
    G.Occupants.register(B.car);
    G.VehicleLights.allOff(B.car);
    park();
  }

  /** Come back into town at the far end, the other way round, once nobody is near the entry. */
  function enter() {
    const P = S().player.pos;
    const dir = -B.dir;
    const x = -dir * END;
    if (Math.hypot(P.x - x, P.z) < ENTRY_CLEAR) return;
    B.dir = dir;
    B.served = false;
    B.state = "drive";
    Object.assign(B.sim, {
      x,
      z: dir > 0 ? -LANE : LANE,
      heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
    });
    B.sim.speed = CRUISE * 0.6;
    B.mesh.group.visible = true;
    B.pending = 0;
    G.Occupants.fillBus(B.car, 2 + Math.floor(G.Occupants.rng() * 4));
  }

  /** Put the model where the bus is: on the ground under its wheels, doors as they are. */
  function syncMesh(dt) {
    const F = KQ.Figures.Vehicles;
    const sim = B.sim;
    const pose = SV().groundPose(sim, B.mesh.contacts, S().world.heightAt);
    const g = B.mesh.group;
    g.position.set(sim.x, pose.y, sim.z);
    g.rotation.order = "YXZ";
    g.rotation.set(-pose.pitch, sim.heading, pose.roll);
    B.car.y = pose.y;
    F.suspend(B.mesh, pose.off);
    F.animate(B.mesh, dt, sim.speed, 0);
    G.Rig.setBusDoors(B.mesh, B.doors);
  }

  /** The indicator the bus shows: left while pulling in to the kerb, right while pulling out into the road. */
  function indicator() {
    if (B.dir > 0) return null;
    const d = B.sim.x - stopX();
    if (!B.served && B.state === "drive" && d > 0.5 && d < PULL) return "L";
    return B.served && d < 0.5 && d > -PULL_OUT ? "R" : null;
  }

  /** Keep the lights, indicator and sound of the bus up to date. */
  function dress(dt) {
    B.clock += dt;
    const braking =
      B.state === "drive" && B.wantedNow !== undefined && B.sim.speed < B.wantedNow - 0.3;
    G.VehicleLights.update(B.car, dt, {
      engine: true,
      braking,
      indicator: indicator(),
      t: B.clock,
    });
  }

  /** Called every sim step (from Vehicles.update). */
  function update(dt) {
    ensure();
    if (!B.ready) return;
    if (B.state === "away") {
      B.t -= dt;
      if (B.t <= 0) enter();
      return;
    }
    if (B.state === "stop") dwell(dt);
    else drive(dt);
    if (B.state === "away") return;
    syncCollider();
    syncMesh(dt);
    dress(dt);
  }

  /** Test hook: where the bus is and what it is doing. */
  function debug() {
    if (!B.ready) return { ready: false };
    const r = (n) => Number(n.toFixed(2));
    return {
      ready: true,
      state: B.state,
      dir: B.dir,
      x: r(B.sim.x),
      z: r(B.sim.z),
      heading: r(B.sim.heading),
      speed: r(B.sim.speed),
      doors: r(B.doors),
      stops: B.stops,
      runs: B.runs,
      braked: B.braked,
      blockedBy: blockedBy(),
      stopX: r(stopX()),
      visible: B.mesh.group.visible,
      aboard: B.car.occ.length,
      riders: G.Occupants.riders(B.car),
      alighted: B.alighted,
      boarded: B.boarded,
      pending: B.pending,
      lights: G.VehicleLights.state(B.car),
    };
  }

  /** The bus as an obstacle for the traffic cars ({id, x, z, heading, speed, halfLen, halfWid}), or null while away. */
  function obstacle() {
    if (!B.ready || B.state === "away") return null;
    const s = B.sim;
    return {
      id: "bus",
      x: s.x,
      z: s.z,
      heading: s.heading,
      speed: s.speed,
      halfLen: s.spec.halfLen,
      halfWid: s.spec.halfWid,
    };
  }

  /** The bus as an exhaust emitter ({v, accel, engine}), or null while away. */
  function emitter() {
    if (!B.ready || B.state === "away") return null;
    return { v: B.car, accel: B.car.life ? B.car.life.acc : 0, engine: true };
  }

  /** The bus as a sound source for the hero's ear ([{d, speed, top, kind, fuel}]), or null while away. */
  function sourceFor(hero) {
    if (!B.ready || B.state === "away") return null;
    const s = B.sim;
    return [
      {
        d: Math.hypot(s.x - hero.x, s.z - hero.z),
        speed: Math.abs(s.speed),
        top: s.spec.maxFwd,
        kind: "bus",
        fuel: "diesel",
      },
    ];
  }

  /** State the passenger code (bus-people.js) works on. */
  const model = () => ({ B, DOOR_MID, DOOR_FRONT, OUTSIDE, WALK, BOARD_REACH });

  G.Bus = { update, debug, obstacle, emitter, sourceFor, model, LANE, KERB_LANE };
})((window.KQ = window.KQ || {}));
