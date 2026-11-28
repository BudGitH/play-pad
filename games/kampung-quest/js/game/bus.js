/* ============================================================================
 * FILE: bus.js
 * PURPOSE: The kampung's town bus (route 21, "Kampung"): a generic, unbranded single-deck bus that runs along
 *          the E-W road, westbound on the left-hand lane, pulls in at the bus stop (LAYOUT.busStop), opens its
 *          left-side doors for a few seconds, pulls out, leaves town at the west end, and comes back eastbound
 *          a little later. It is ambient: the hero cannot drive it or ride in it.
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
  const DWELL = 5;
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
    return out;
  }

  /** A vehicle as two points, its nose and its tail (a car in the lane holds the bus short of its whole body). */
  function ends(v) {
    const fx = Math.sin(v.heading) * v.spec.halfLen;
    const fz = Math.cos(v.heading) * v.spec.halfLen;
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
    const cap = SV().speedCap(B.sim, obstacles());
    if (cap < want) B.braked += 1;
    return Math.min(want, cap);
  }

  /** One step of driving: speed toward what it wants, along the lane, then pull in, stop or leave town. */
  function drive(dt) {
    const sim = B.sim;
    const want = wanted();
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

  /** At the stop: stand still and open the doors. */
  function arrive() {
    B.sim.speed = 0;
    B.state = "stop";
    B.t = DWELL;
    B.stops += 1;
  }

  /** At the stop: doors open for DWELL seconds, then shut, then go. */
  function dwell(dt) {
    B.t -= dt;
    const open = B.t > 0 ? 1 : 0;
    B.doors += Math.sign(open - B.doors) * Math.min(Math.abs(open - B.doors), dt * 1.6);
    if (B.t <= 0 && B.doors < 0.02) {
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
    F.suspend(B.mesh, pose.off);
    F.animate(B.mesh, dt, sim.speed, 0);
    F.setDoors(B.mesh, B.doors);
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
      stopX: r(stopX()),
      visible: B.mesh.group.visible,
    };
  }

  G.Bus = { update, debug, LANE, KERB_LANE };
})((window.KQ = window.KQ || {}));
