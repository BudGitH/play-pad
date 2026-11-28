/* ============================================================================
 * FILE: traffic.js
 * PURPOSE: The town's ambient traffic: 2-4 cars (by tier; 1-3 in Makkah) driving the road like the bus, each with
 *          a driver and sometimes passengers seated inside, which now and then pull into a kerbside bay so their
 *          people can get out (and later new people get in and the car drives off).
 * BUSINESS CONTEXT: AC-P26 (features/kampung-quest-playability/requirements.md). Owner request "cars being driven around by other characters, with passengers inside".
 *   Child-friendly: a traffic car brakes for people (any on foot, on a zebra crossing or not), the hero, the bus,
 *   parked and driven vehicles and each other, only ever slows down, uses its indicator before pulling in or out,
 *   never holds the hero up for good (the hero can step aside and walk round it; a car held up by another vehicle
 *   for long, unseen, just goes away), and is a moving solid like the bus (one oriented-box collider).
 * COST: a car is the shared car model (10 draw calls when in view; nothing is drawn beyond DRAW_RANGE or when it
 *   is away), its people are instanced crowd figures (vehicle-occupants.js), its exhaust one shared Points draw.
 * HOW IT FITS: Vehicles.update calls Traffic.update(dt) every sim step (so `?still` tests drive it with
 *   Loop.frame), like Bus.update. Rules are pure in KQ.Sim.Traffic; roads and bays in traffic-routes.js;
 *   parking and boarding in traffic-park.js. Hook: Vehicles.debug().traffic.
 * DEPENDENCIES: KQ.Sim.Traffic / Vehicle / VehicleLife, vehicle-occupants.js, vehicle-lights.js, vehicle-rig.js,
 *   vehicle-sound.js, collide.js, bus.js (its box, for yielding), KQ.Figures.Vehicles.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const ST = () => KQ.Sim.Traffic;
  const SV = () => KQ.Sim.Vehicle;
  const S = () => G.S;
  const R = () => G.TrafficRoutes;
  /** Cruising speeds (m/s), acceleration and the comfortable braking rate; the stop rate for a bay. */
  const CRUISE = [5.2, 7.4];
  const ACCEL = 2.4;
  const DECEL = 7;
  const STOP_RATE = 2;
  /** Metres over which a car eases sideways into or out of its bay. */
  const BAY_LEN = 11;
  /** A new car appears at least this far from the hero and out of view; people and cars are looked at within NEAR. */
  const ENTRY_CLEAR = 35;
  const NEAR = 46;
  /** Draw distance by tier (m). */
  const DRAW_RANGE = { low: 48, med: 62, high: 80 };
  /** Seconds a car stays away between two trips. */
  const AWAY = [5, 14];
  const T = {
    ready: false,
    cars: [],
    t: 0,
    hold: false,
    rng: U.rng(20261128),
    spawned: 0,
    vanished: 0,
    braked: 0,
    honks: 0,
    parks: 0,
    departs: 0,
  };

  /* ------------------------------ the pool ------------------------------ */

  /** Build one car record (hidden, in the scene). */
  function build(i) {
    const s = S();
    const look = R().lookOf(i);
    const lhd = G.VehicleSpots.region() === "haramain";
    const mesh = KQ.Figures.Vehicles.build("car", look.color, {
      style: look.style,
      lhd,
      low: s.quality === "low",
    });
    const c = {
      id: "traffic" + (i + 1),
      kind: "car",
      style: mesh.style,
      sim: SV().create("car", 0, 0, 0),
      mesh,
      y: 0,
      pitch: 0,
      roll: 0,
      state: "away",
      awayT: 2 + i * 3,
      occ: [],
      stuck: 0,
    };
    mesh.group.visible = false;
    mesh.group.position.set(0, -500, 0);
    s.scene.add(mesh.group);
    G.Occupants.register(c);
    T.cars.push(c);
    return c;
  }

  /** Build the pool: one car per allowed slot of the best tier (queued behind the loading bar when given a Defer). */
  function prepare(defer) {
    const s = S();
    if (T.ready || !s || !s.world || !s.scene) return;
    T.ready = true;
    const n = ST().countFor("high", G.VehicleSpots.region());
    for (let i = 0; i < n; i += 1) {
      if (defer) defer.add(() => void build(i), "traffic car");
      else build(i);
    }
  }

  /** How many cars this tier and region allow right now. */
  const allowed = () => ST().countFor(S().quality, G.VehicleSpots.region());

  /** How many cars are out on the road. */
  const active = () => T.cars.filter((c) => c.state !== "away").length;

  /* ------------------------------ colliders ------------------------------ */

  /** NPCs cache the colliders near them; make them look again after one was added or removed. */
  function refreshNear() {
    const npcs = S().npcs;
    if (npcs && npcs.agents) npcs.agents.forEach((A) => (A.nearAt = null));
  }

  /** Put the car's solid box into the world (one oriented box, updated in place each step). */
  function addCollider(c) {
    c.col = G.Collide.orientedBox(SV().box(c.sim, 0.02), c.id);
    c.col.traffic = c.id;
    S().world.colliders.push(c.col);
    refreshNear();
  }

  /** Take the box out of the world. */
  function removeCollider(c) {
    const list = S().world.colliders;
    const i = list.indexOf(c.col);
    if (i !== -1) list.splice(i, 1);
    c.col = null;
    refreshNear();
  }

  /** Keep the box on the car's body. */
  function syncCollider(c) {
    const fresh = G.Collide.orientedBox(SV().box(c.sim, 0.02), c.id);
    Object.assign(c.col, {
      minX: fresh.minX,
      maxX: fresh.maxX,
      minZ: fresh.minZ,
      maxZ: fresh.maxZ,
    });
    Object.assign(c.col.obb, fresh.obb);
  }

  /* ------------------------------ who is around ------------------------------ */

  /** Everyone on foot near the traffic: the hero, visible cast neighbours, crowd extras (not those boarding). */
  function gatherPeople(hero) {
    const s = S();
    const out = [{ x: hero.x, z: hero.z }];
    s.npcs.agents.forEach((A) => !A.hidden && A.group.visible && out.push(A));
    if (s.crowd) s.crowd.members.forEach((m) => m.show > 0.3 && !m.gone && out.push(m));
    return out.concat(G.Actors.positions());
  }

  /** A vehicle sim as an obstacle: {id, x, z, heading, speed, halfLen, halfWid}. */
  function obstacle(sim, id) {
    return {
      id,
      x: sim.x,
      z: sim.z,
      heading: sim.heading,
      speed: sim.speed,
      halfLen: sim.spec.halfLen,
      halfWid: sim.spec.halfWid,
    };
  }

  /** The vehicles a traffic car must not drive into: parked and driven ones, the bus and the other traffic. */
  function gatherVehicles() {
    const out = G.Vehicles.sims().map((v, i) => obstacle(v, "v" + i));
    const bus = G.Bus && G.Bus.obstacle ? G.Bus.obstacle() : null;
    if (bus) out.push(bus);
    T.cars.forEach((c) => c.state !== "away" && out.push(obstacle(c.sim, c.id)));
    return out;
  }

  /** The caps on one car: {cap, person} (person = the part due to someone on foot or on a crossing). */
  function capsOf(c, ctx) {
    const me = obstacle(c.sim, c.id);
    const near = (p) => Math.abs(p.x - me.x) < NEAR && Math.abs(p.z - me.z) < NEAR;
    const people = ctx.people.filter(near);
    const vehicles = ctx.vehicles.filter((o) => o.id !== c.id && near(o));
    const person = ST().capFor(me, people, [], c.route ? R().crossingsOf(c.route) : []);
    const veh = ST().capFor(me, [], vehicles, []);
    c.caps = {
      person: Number.isFinite(person) ? Number(person.toFixed(1)) : null,
      vehicle: Number.isFinite(veh) ? Number(veh.toFixed(1)) : null,
    };
    return { cap: Math.min(person, veh), person, vehicle: veh };
  }

  /* ------------------------------ driving ------------------------------ */

  /** Metres still to go to the bay's stop (positive before it). */
  const toBay = (c) => (c.bayU - c.u) * c.dir;

  /** The lateral coordinate of the car at its place: lane, easing into the bay, or out of it. */
  function lateral(c) {
    const lane = R().laneCoord(c.route, c.dir);
    const bay = R().bayCoord(c.route, c.dir);
    if (c.state === "bay-in") return ST().bayOffset(lane, bay, toBay(c), BAY_LEN);
    if (c.state === "bay-out") return ST().bayOffset(lane, bay, c.exitD, BAY_LEN);
    return c.state === "park" ? bay : lane;
  }

  /** The speed the car wants: its cruise, easing to a halt at the bay. */
  function wanted(c) {
    if (c.state !== "bay-in") return c.cruise;
    return Math.min(c.cruise, Math.max(0.7, Math.sqrt(2 * STOP_RATE * Math.max(0, toBay(c)))));
  }

  /** Change the speed toward the wanted one and the cap (never past it), gently. */
  function setSpeed(c, want, cap, dt) {
    const sim = c.sim;
    const top = Math.min(want, cap);
    if (sim.speed > top) sim.speed = Math.max(top, sim.speed - DECEL * dt);
    else sim.speed = Math.min(top, sim.speed + ACCEL * dt);
    c.braking = cap < want - 0.6 && sim.speed < want - 0.2;
  }

  /** Move along the road for dt and put the car at its place (heading follows the movement). */
  function advance(c, dt) {
    const sim = c.sim;
    const r = c.route;
    c.u += c.dir * sim.speed * dt;
    if (c.state === "bay-out") c.exitD = (c.u - c.bayU) * c.dir;
    const at = R().pointAt(r, c.u, lateral(c));
    if (sim.speed > 0.05) sim.heading = Math.atan2(at.x - sim.x, at.z - sim.z);
    sim.x = at.x;
    sim.z = at.z;
  }

  /** One step of driving (cruise, pull in, pull out). */
  function drive(c, dt, ctx) {
    const caps = capsOf(c, ctx);
    setSpeed(c, wanted(c), caps.cap, dt);
    noteBlocked(c, caps, dt);
    advance(c, dt);
    if (c.state === "bay-in" && toBay(c) < 0.35 && c.sim.speed < 1.2) stopInBay(c);
    if (c.state === "bay-out" && c.exitD > BAY_LEN) c.state = "drive";
    if (c.u * c.dir > c.endU) leave(c, "end");
  }

  /** Track how long the car is held up and by what; honk once at someone in the way; go away if held by cars. */
  function noteBlocked(c, caps, dt) {
    const held = c.sim.speed < 0.2 && caps.cap < 0.5;
    c.stuck = held ? c.stuck + dt : 0;
    if (!held) c.honked = false;
    const byPerson = caps.person < 0.5;
    if (byPerson && c.stuck > 2.5 && !c.honked) {
      c.honked = true;
      T.honks += 1;
      if (G.VehicleSound) G.VehicleSound.honkAt(c.sim);
    }
    if (ST().shouldVanish(c.stuck, byPerson, seen(c))) leave(c, "vanish");
  }

  /** Can the child see this car (in front of the camera and not far)? */
  function seen(c) {
    const C = S().crowd;
    const hero = S().player.pos;
    return (
      Boolean(C && C.canSee && C.canSee(c.sim.x, c.sim.z)) &&
      U.dist(c.sim.x, c.sim.z, hero.x, hero.z) < 60
    );
  }

  /* ------------------------------ parking ------------------------------ */

  /** Stopped in the bay: engine off, people get out. */
  function stopInBay(c) {
    c.state = "park";
    c.sim.speed = 0;
    c.engine = false;
    T.parks += 1;
    G.TrafficPark.arrive(c);
  }

  /** A parked car whose people are aboard again pulls out (right indicator first). */
  function pullOut(c) {
    c.state = "bay-out";
    c.exitD = 0;
    c.engine = true;
    c.park = null;
    c.planned = false;
    T.departs += 1;
  }

  /** One step of a parked car: wait, boarding; pull out when ready; go away when nobody comes and nobody looks. */
  function parked(c, dt) {
    c.sim.speed = 0;
    const r = G.TrafficPark.step(c, dt, c.forceBoard);
    if (r === true) pullOut(c);
    else if (G.TrafficPark.gaveUp(r) && !seen(c)) leave(c, "empty");
  }

  /* ------------------------------ coming and going ------------------------------ */

  /** The next free bay ahead of a car on its route (kampung), or null. */
  function pickBay(c) {
    const taken = T.cars
      .filter((o) => o !== c && o.state !== "away" && o.bayU !== undefined)
      .map((o) => o.bayU);
    const hero = S().player.pos;
    const ahead = c.route.bays
      .filter((z) => (z - c.u) * c.dir > 28 && taken.indexOf(z) === -1 && bayFree(c, z, hero))
      .sort((a, b) => Math.abs(a - c.u) - Math.abs(b - c.u));
    return ahead.length ? ahead[0] : null;
  }

  /** Is a bay clear of walls, props and the hero (so a car can pull in)? */
  function bayFree(c, u, hero) {
    const at = R().pointAt(c.route, u, R().bayCoord(c.route, c.dir));
    const cols = S().world.colliders;
    const probes = [-1.4, 0, 1.4].map((d) =>
      R().pointAt(c.route, u + d, R().bayCoord(c.route, c.dir)),
    );
    return (
      U.dist(at.x, at.z, hero.x, hero.z) > 5 &&
      probes.every((p) => !G.Collide.blockedAt(cols, p.x, p.z, 0.8))
    );
  }

  /** Put a car on the road. opts: {route, dir, u, speed, bay (true / false / a bay's u), passengers}. */
  function launch(c, opts) {
    const r = opts.route;
    Object.assign(c, {
      route: r,
      dir: opts.dir,
      u: opts.u,
      cruise: CRUISE[0] + T.rng() * (CRUISE[1] - CRUISE[0]),
      endU: opts.dir > 0 ? r.to : -r.from,
      state: "drive",
      engine: true,
      stuck: 0,
      exitD: 0,
      bayU: undefined,
      park: null,
      planned: false,
      honked: false,
      forceBoard: Boolean(opts.forceBoard),
    });
    c.endU = opts.dir > 0 ? r.to : -r.from;
    const at = R().pointAt(r, c.u, R().laneCoord(r, c.dir));
    Object.assign(c.sim, {
      x: at.x,
      z: at.z,
      heading: R().headingOf(r, c.dir),
      speed: opts.speed,
      steer: 0,
    });
    if (opts.bay) planBay(c, opts.bay);
    G.Occupants.fillCar(c, opts.passengers);
    addCollider(c);
    c.mesh.group.visible = true;
    T.spawned += 1;
  }

  /** Plan to park: the given bay (a z), or the next free one. */
  function planBay(c, bay) {
    const u = bay === true ? pickBay(c) : bay;
    if (u === null || u === undefined) return;
    c.bayU = u;
    c.planned = true;
  }

  /** Switch the "bay-in" state on once the car is within sight of its bay. */
  function approachBay(c) {
    if (c.planned && c.state === "drive" && toBay(c) < BAY_LEN + 22) c.state = "bay-in";
  }

  /** The car leaves the road (end of its stretch, held up, nobody came): hidden, lights and engine off, box removed. */
  function leave(c, why) {
    if (c.state === "away") return;
    if (why === "vanish") T.vanished += 1;
    G.Occupants.unregister(c);
    G.Occupants.register(c);
    c.state = "away";
    c.awayT = AWAY[0] + T.rng() * (AWAY[1] - AWAY[0]);
    c.planned = false;
    c.sim.speed = 0;
    c.engine = false;
    c.park = null;
    c.mesh.group.visible = false;
    c.mesh.group.position.set(0, -500, 0); // parked far below: nothing draws it even if a test shows every vehicle
    G.VehicleLights.allOff(c);
    if (c.col) removeCollider(c);
  }

  /** Where a new car may appear on a route: a random place 38-85 m from the hero and out of view, else the entry end. */
  function spawnPlace(r, dir, hero) {
    const C = S().crowd;
    const lat = R().laneCoord(r, dir);
    for (let i = 0; i < 8; i += 1) {
      const u = r.from + 8 + T.rng() * (r.to - r.from - 16);
      const p = R().pointAt(r, u, lat);
      const d = U.dist(p.x, p.z, hero.x, hero.z);
      if (d > 38 && d < 85 && (!C || !C.visibleNear(p.x, p.z)) && laneClear(p)) return u;
    }
    const end = dir > 0 ? r.from : r.to;
    const e = R().pointAt(r, end, lat);
    return U.dist(e.x, e.z, hero.x, hero.z) > ENTRY_CLEAR && laneClear(e) ? end : null;
  }

  /** Is no vehicle within 14 m of this point (so a new car does not appear on top of one)? */
  function laneClear(p) {
    return gatherVehicles().every((o) => U.dist(o.x, o.z, p.x, p.z) > 14);
  }

  /** The routes near enough to the hero to be worth driving on (within 130 m of the road's middle). */
  function nearRoutes(hero) {
    return R()
      .routes()
      .filter(function (r) {
        const p = R().pointAt(r, R().alongOf(r, hero.x, hero.z), r.axis === "z" ? 0 : r.centre);
        return U.dist(p.x, p.z, hero.x, hero.z) < 130;
      });
  }

  /** Bring a pooled car onto the road when one is due. */
  function maybeSpawn(dt, hero) {
    T.cars.forEach((c) => c.state === "away" && (c.awayT -= dt));
    if (T.hold || active() >= allowed()) return;
    const c = T.cars.find((x) => x.state === "away" && x.awayT <= 0);
    if (!c) return;
    const routes = nearRoutes(hero);
    if (!routes.length) return;
    const r = routes[Math.floor(T.rng() * routes.length)];
    const dir = T.rng() < 0.5 ? 1 : -1;
    const u = spawnPlace(r, dir, hero);
    if (u === null) return;
    const p = T.rng();
    launch(c, {
      route: r,
      dir,
      u,
      speed: 3,
      bay: r.bays.length > 0 && T.rng() < 0.55,
      passengers: p < 0.45 ? 0 : p < 0.8 ? 1 : 2,
    });
  }

  /** Too many cars for the tier (it dropped)? Send the farthest unseen one away. */
  function trim(hero) {
    if (active() <= allowed()) return;
    const out = T.cars
      .filter((c) => c.state !== "away" && !seen(c))
      .sort(
        (a, b) =>
          U.dist(b.sim.x, b.sim.z, hero.x, hero.z) - U.dist(a.sim.x, a.sim.z, hero.x, hero.z),
      )[0];
    if (out) leave(out, "trim");
  }

  /* ------------------------------ mesh, lights, per frame ------------------------------ */

  /** Put the model where the car is: on the ground under its wheels, wheels turning. */
  function syncMesh(c, dt) {
    const F = KQ.Figures.Vehicles;
    const sim = c.sim;
    const pose = SV().groundPose(sim, c.mesh.contacts, S().world.heightAt);
    const g = c.mesh.group;
    c.y = pose.y;
    g.position.set(sim.x, pose.y, sim.z);
    g.rotation.order = "YXZ";
    g.rotation.set(-pose.pitch, sim.heading, pose.roll);
    F.suspend(c.mesh, pose.off);
    F.animate(c.mesh, dt, sim.speed, 0);
  }

  /** The indicator side the car shows: left to pull in to the kerb (left-hand traffic), right to pull out. */
  function indicatorOf(c) {
    if (c.state === "bay-in") return "L";
    if (c.state === "bay-out" && c.exitD < BAY_LEN * 0.8) return "R";
    return null;
  }

  /** Step one car that is on the road. */
  function stepCar(c, dt, ctx) {
    if (c.state === "park") parked(c, dt);
    else {
      approachBay(c);
      drive(c, dt, ctx);
    }
    if (c.state === "away") return;
    syncMesh(c, dt);
    syncCollider(c);
    G.VehicleLights.update(c, dt, {
      engine: c.engine,
      braking: c.braking,
      indicator: indicatorOf(c),
      t: T.t,
    });
    c.mesh.group.visible =
      U.dist(c.sim.x, c.sim.z, ctx.hero.x, ctx.hero.z) <
      (DRAW_RANGE[S().quality] || DRAW_RANGE.med);
  }

  /** Called every sim step from Vehicles.update. */
  function update(dt) {
    prepare(null);
    if (!T.ready || !T.cars.length || !T.cars[0]) return;
    T.t += dt;
    const hero = S().player.pos;
    const ctx = { hero, people: gatherPeople(hero), vehicles: gatherVehicles() };
    maybeSpawn(dt, hero);
    trim(hero);
    T.cars.forEach((c) => c.state !== "away" && stepCar(c, dt, ctx));
  }

  /* ------------------------------ for the rest of the game ------------------------------ */

  /** Cars on the road that make exhaust: [{v, accel, engine}] (vehicle-lights measures the acceleration). */
  function emitters() {
    return T.cars
      .filter((c) => c.state !== "away" && c.mesh.group.visible)
      .map((c) => ({ v: c, accel: c.life ? c.life.acc : 0, engine: Boolean(c.engine) }));
  }

  /** Cars on the road as sound sources: [{d, speed, top, kind, fuel}] for the hero's ear. */
  function sources(hero) {
    return T.cars
      .filter((c) => c.state !== "away" && c.engine)
      .map((c) => ({
        d: U.dist(c.sim.x, c.sim.z, hero.x, hero.z),
        speed: Math.abs(c.sim.speed),
        top: c.sim.spec.maxFwd,
        kind: "car",
        fuel: G.Rig.exhaustOf(c).fuel,
      }));
  }

  /**
   * Test hook: put a car on the road right now (even beyond the tier's count). opts: {dir, u, speed, bay, passengers,
   * route (index), forceBoard}. Returns its id or null.
   */
  function force(opts) {
    prepare(null);
    const o = opts || {};
    const c = T.cars.find((x) => x.state === "away");
    const r = R().routes()[o.route || 0];
    if (!c || !r) return null;
    const dir = o.dir || 1;
    launch(c, {
      route: r,
      dir,
      u: o.u === undefined ? r.from + 4 : o.u,
      speed: o.speed === undefined ? 4 : o.speed,
      bay: o.bay,
      passengers: o.passengers === undefined ? 1 : o.passengers,
      forceBoard: o.forceBoard,
    });
    c.mesh.group.visible = true;
    return c.id;
  }

  /** Test hook: stop new cars coming (true) or let them (false). */
  function setHold(on) {
    T.hold = Boolean(on);
  }

  /** Test hook: take every car off the road. */
  function clear() {
    T.cars.forEach((c) => leave(c, "clear"));
  }

  /** Test hook: the cars and the counters. */
  function debug() {
    const r = (n) => Number(n.toFixed(2));
    return {
      ready: T.ready,
      allowed: T.ready ? allowed() : 0,
      active: active(),
      spawned: T.spawned,
      vanished: T.vanished,
      parks: T.parks,
      departs: T.departs,
      honks: T.honks,
      park: G.TrafficPark.debug(),
      cars: T.cars.map((c) => ({
        id: c.id,
        style: c.style,
        state: c.state,
        x: r(c.sim.x),
        z: r(c.sim.z),
        heading: r(c.sim.heading),
        speed: r(c.sim.speed),
        dir: c.dir,
        aboard: c.occ.length,
        riders: G.Occupants.riders(c),
        stage: c.park ? c.park.stage : null,
        stuck: r(c.stuck || 0),
        braking: Boolean(c.braking),
        caps: c.caps || null,
        visible: c.mesh.group.visible,
        lights: G.VehicleLights.state(c),
      })),
    };
  }

  G.Traffic = {
    prepare,
    update,
    emitters,
    sources,
    force,
    setHold,
    clear,
    debug,
    /** The record of a traffic car by id (tests: stub its rig, read its box). */
    byId: (id) => T.cars.find((c) => c.id === id) || null,
    obstacles: () => T.cars.filter((c) => c.state !== "away").map((c) => obstacle(c.sim, c.id)),
  };
})((window.KQ = window.KQ || {}));
