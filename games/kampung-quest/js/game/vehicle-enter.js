/* ============================================================================
 * FILE: vehicle-enter.js
 * PURPOSE: The little get-in / get-out scene. Getting in: the hero walks to the driver's door, the door opens,
 *          he climbs into the seat, the door closes (about 1.2-1.8 s). Getting out is the same turned round and
 *          sets him down on free ground. A bicycle or scooter gets a short step and a swing over. Input is
 *          locked while it plays and pressing the button again skips to the end.
 * BUSINESS CONTEXT: owner request: "something similar to GTA, opening the car and going in". Only the feel is
 *   borrowed: this is the hero's own car, nobody is ever pulled out of one.
 * HOW IT FITS: vehicles.js starts it from press() and from the stop-then-exit step and calls step(dt) every sim
 *   frame while active(); the timeline and the geometry of the path are pure (KQ.Sim.VehicleLife), the doors
 *   are driven through vehicle-rig.js (a no-op when the model has no doors). `pose()` is shared with the
 *   people in traffic cars (traffic.js), who step out of the same doors.
 * DEPENDENCIES: KQ.Sim.VehicleLife, vehicle-rig.js, vehicle-sound.js, player.js, util.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const VL = () => KQ.Sim.VehicleLife;
  /** The hero's pose once seated, per vehicle kind (the same names vehicles.js uses). */
  const SEATED = { car: "drive", bike: "pedal", moto: "drive", lorry: "drive" };
  /** How far outside the body the door point is (m): the hero's radius plus a step. */
  const DOOR_GAP = 0.6;
  const E = { on: false };
  let scene = null;

  /** Is the scene switched on? `?enter=0` in the page address skips it (tests, quick play). */
  function enabled() {
    if (scene === null) {
      try {
        scene = new URLSearchParams(location.search).get("enter") !== "0";
      } catch (err) {
        scene = true;
      }
    }
    return scene;
  }

  /** A vehicle-frame point {fwd, lat} as a world {x, z}. */
  function worldOf(sim, p) {
    const fx = Math.sin(sim.heading);
    const fz = Math.cos(sim.heading);
    return { x: sim.x + fx * p.fwd + fz * p.lat, z: sim.z + fz * p.fwd - fx * p.lat };
  }

  /**
   * The door point of a vehicle in its frame: beside the driver's seat on the driver's side (a car or lorry), or
   * beside the saddle on the left (a bicycle or scooter).
   */
  function doorLocal(kind, seatX, seatZ, halfWid) {
    const side = VL().hasDoor(kind) ? Math.sign(seatX || -1) : 1;
    return { fwd: seatZ, lat: side * (halfWid + DOOR_GAP) };
  }

  /**
   * Describe a get-in / get-out for the stepper: the path of the walk, the door and seat points, the heading.
   * @param {{kind:string, dir:string, sim:object, mesh:object, from:{x,z}, seatPt:{x,y,z}, seatX:number,
   *   away?:{x,z}}} o
   */
  function describe(o) {
    const sim = o.sim;
    const spec = sim.spec;
    const seatLoc = KQ.Sim.Vehicle.local(sim, o.seatPt.x, o.seatPt.z);
    const door = doorLocal(o.kind, o.seatX, seatLoc.fwd, spec.halfWid);
    const start = o.dir === "in" ? KQ.Sim.Vehicle.local(sim, o.from.x, o.from.z) : door;
    const goal = o.dir === "in" ? door : KQ.Sim.Vehicle.local(sim, o.away.x, o.away.z);
    const path = VL().approachPath(start, goal, spec.halfLen, spec.halfWid);
    return { o, door, path, doorW: worldOf(sim, door), walk: VL().walkSecs(VL().pathLength(path)) };
  }

  /** Ground height at a world point. */
  const groundAt = (x, z) => G.S.world.heightAt(x, z);

  /** The figure's place and facing at a moment `s` of the timeline: {x, y, z, heading, fwdSeat, moving}. */
  function pose(d, s) {
    const o = d.o;
    const sim = o.sim;
    const seat = o.seatPt;
    const doorW = d.doorW;
    const gy = groundAt(doorW.x, doorW.z);
    const e = s.seat;
    let p;
    if (o.dir === "in" && s.seat === 0) p = worldOf(sim, VL().alongPath(d.path, s.approach));
    else if (o.dir === "out" && s.away > 0) p = worldOf(sim, VL().alongPath(d.path, s.away));
    else p = { x: doorW.x + (seat.x - doorW.x) * e, z: doorW.z + (seat.z - doorW.z) * e };
    const base = e === 0 ? groundAt(p.x, p.z) : gy;
    const y = base + VL().climbHeight(e, seat.y - gy, o.kind);
    return { x: p.x, y, z: p.z, heading: facing(d, s, p) };
  }

  /** Which way he faces: along the walk, toward the car at the door, then the way the vehicle points once seated. */
  function facing(d, s, p) {
    const sim = d.o.sim;
    const toCar = Math.atan2(d.o.seatPt.x - d.doorW.x, d.o.seatPt.z - d.doorW.z);
    if (s.seat >= 1 || (d.o.dir === "out" && s.phase === "open")) return sim.heading;
    if (s.seat > 0) return toCar + U.angleDiff(toCar, sim.heading) * s.seat;
    if (d.o.dir === "in" && s.phase === "walk") return walkHeading(d, s, p);
    if (d.o.dir === "out") return walkHeadingOut(d, p);
    return toCar;
  }

  /** The way he heads while walking in: toward the next point of the path (toward the car at its end). */
  function walkHeading(d, s, p) {
    const ahead = worldOf(d.o.sim, VL().alongPath(d.path, Math.min(1, s.approach + 0.08)));
    const dx = ahead.x - p.x;
    const dz = ahead.z - p.z;
    return Math.hypot(dx, dz) > 0.02 ? Math.atan2(dx, dz) : d.o.sim.heading;
  }

  /** The way he heads stepping away after getting out: from the door toward the place he is set down. */
  function walkHeadingOut(d, p) {
    const to = d.o.away;
    const dx = to.x - p.x;
    const dz = to.z - p.z;
    return Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : d.o.sim.heading;
  }

  /** Which hero pose goes with a phase. */
  function poseName(d, s) {
    const o = d.o;
    const seated = SEATED[o.kind] || "drive";
    if (o.dir === "in") return s.phase === "walk" ? "walk" : s.phase === "open" ? "idle" : seated;
    if (s.phase === "open" || s.phase === "swing") return seated;
    return s.phase === "climb" ? "idle" : "walk";
  }

  /** Start the scene. Returns false if one is already playing. */
  function start(o) {
    if (E.on) return false;
    const d = describe(o);
    const door = G.Rig.doorFor(o.mesh, d.door.lat >= 0 ? "L" : "R");
    Object.assign(E, {
      on: true,
      d,
      t: 0,
      door,
      fired: { open: false, close: false },
      s: VL().at(o.kind, o.dir, 0, d.walk),
      skipped: false,
      last: null,
    });
    return true;
  }

  /** Play a door sound for a cue. */
  function sound(cue) {
    if (cue && G.VehicleSound) G.VehicleSound.door(cue);
  }

  /** Put the hero where the timeline says and animate him; open or shut the door. */
  function apply(P, dt) {
    const d = E.d;
    const s = E.s;
    const p = pose(d, s);
    P.pos.set(p.x, p.y, p.z);
    P.heading = p.heading;
    P.vx = P.vz = 0;
    P.speed = s.phase === "walk" || s.phase === "step" ? 1.6 : 0;
    P.base = p.y;
    P.anim.play(poseName(d, s), 0.15);
    P.anim.setRate(P.speed > 0 ? 1.4 : 1);
    P.anim.update(dt);
    G.Player.sync(P);
    G.Rig.openDoor(E.door, s.door);
    sound(VL().cue(s, E.fired));
    E.last = { x: p.x, z: p.z };
  }

  /**
   * One sim step. Returns true while the scene is still playing, false the moment it ends (the caller then
   * finishes: seats the hero or sets him down). Skipping jumps straight to the end state.
   */
  function step(dt, P) {
    if (!E.on) return false;
    E.t = E.skipped ? Infinity : E.t + dt;
    E.s = VL().at(E.d.o.kind, E.d.o.dir, E.t, E.d.walk);
    apply(P, dt);
    if (!E.s.done) return true;
    G.Rig.openDoor(E.door, 0);
    E.on = false;
    return false;
  }

  /** Jump to the end of the scene at the next step. */
  function skip() {
    if (E.on) E.skipped = true;
  }

  /** Stop at once (the hero was moved away, a flow took him): shut the door, no end state. */
  function abort() {
    if (!E.on) return;
    G.Rig.openDoor(E.door, 0);
    E.on = false;
  }

  /** Has someone else moved the hero away from where the scene put him? */
  function displaced(P) {
    return E.on && E.last && U.dist(P.pos.x, P.pos.z, E.last.x, E.last.z) > 0.6;
  }

  G.VehicleEnter = {
    enabled,
    start,
    step,
    skip,
    abort,
    displaced,
    describe,
    pose,
    active: () => E.on,
    direction: () => (E.on ? E.d.o.dir : null),
    debug: () =>
      E.on
        ? {
            dir: E.d.o.dir,
            phase: E.s.phase,
            t: Number(E.t.toFixed(2)),
            door: Number(E.s.door.toFixed(2)),
            seat: Number(E.s.seat.toFixed(2)),
            hasDoor: Boolean(E.door),
          }
        : null,
  };
})((window.KQ = window.KQ || {}));
