/* ============================================================================
 * FILE: vehicle-occupants.js
 * PURPOSE: The people inside other vehicles: the driver and passengers of the ambient traffic cars and the
 *          passengers of the bus, drawn as seated crowd figures at the model's seats, plus the little scenes of
 *          them getting out (the car's door opens, the figure steps out and walks off into the crowd) and getting
 *          in (a person walks up, the door opens, they climb in, it closes).
 * BUSINESS CONTEXT: owner request "cars with other characters driving and passengers inside; people in the bus,
 *   entering and leaving it". Child-friendly: no one is ever pulled out; everyone steps out and in politely.
 * COST: NO per-person meshes. Every figure goes through the crowd's instanced kit (KQ.Figures.CrowdKit) from
 *   crowd.js's stepAndDraw (`Occupants.draw(kit, C, dt)`), so a few more people add instances, not draw calls.
 *   Only carriers in the camera's view and in range are drawn.
 * RIG API used: rig.seats / rig.doors (through vehicle-rig.js; falls back to the model's known seat spots).
 * DEPENDENCIES: vehicle-rig.js, vehicle-enter.js (timeline and path), crowd-members.js (seatDrop), crowd.js
 *   (the kit), crowd-walkers.js (adopt / redirect), KQ.Sim.Crowd.outfit, KQ.Sim.VehicleLife.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const VL = () => KQ.Sim.VehicleLife;
  /** Carriers farther than this from the camera are not drawn (m). */
  const DRAW_RANGE = 52;
  /** The bus floor above the ground (m), where a standing or walking passenger's feet are. */
  const BUS_FLOOR = 0.42;
  const O = {
    carriers: [],
    transits: [],
    serial: 0,
    rng: U.rng(20261128),
    exits: 0,
    boards: 0,
    drawn: 0,
  };

  /* ------------------------------ people ------------------------------ */

  /** A person for a seat: a crowd outfit by role (adult, kid, elder ...), seated in the "sit" pose. */
  function makePerson(role, female) {
    O.serial += 1;
    const id = "occ:" + O.serial;
    const outfit = KQ.Sim.Crowd.outfit(id, role, female);
    return {
      id,
      outfit,
      kid: outfit.kid,
      scale: outfit.scale,
      pose: "sit",
      phase: O.rng(),
      rate: G.CrowdMembers.rateOf("sit"),
    };
  }

  /** A seated-person record for an outfit that already exists (someone from the crowd getting in). */
  function personFrom(outfit) {
    O.serial += 1;
    return {
      id: "occ:" + O.serial,
      outfit,
      kid: outfit.kid,
      scale: outfit.scale,
      pose: "walk",
      phase: O.rng(),
      rate: G.CrowdMembers.rateOf("walk"),
    };
  }

  /** Metres from a figure's origin down to the seat top when sitting. */
  const dropOf = (p) => G.CrowdMembers.seatDrop({ kid: p.kid, scale: p.scale });

  /** Set the pose and its loop speed of a person. */
  function posed(p, name) {
    if (p.pose !== name) {
      p.pose = name;
      p.rate = G.CrowdMembers.rateOf(name);
    }
    return p;
  }

  /* ------------------------------ carriers ------------------------------ */

  /**
   * Register a vehicle that carries people: {id, kind, style, sim, mesh, y} (a traffic car or the bus). Its people
   * live in `occ` as {person, seat}.
   */
  function register(c) {
    if (O.carriers.indexOf(c) !== -1) return c;
    c.occ = c.occ || [];
    c.queue = [];
    c.active = null;
    c.seats = null;
    O.carriers.push(c);
    return c;
  }

  /** Forget a carrier and its people. */
  function unregister(c) {
    const i = O.carriers.indexOf(c);
    if (i !== -1) O.carriers.splice(i, 1);
    c.occ = [];
    c.queue = [];
    c.active = null;
  }

  /** The seats of a carrier (cached; the rig's, or the model's known spots). */
  function seatsOf(c) {
    if (!c.seats) c.seats = G.Rig.seatsOf(c);
    return c.seats;
  }

  /** Seat indexes of a carrier that nobody sits in and no transit is heading for. */
  function freeSeats(c, kind) {
    const taken = new Set(c.occ.map((o) => o.seat));
    if (c.active && c.active.job.seat !== undefined) taken.add(c.active.job.seat);
    return seatsOf(c)
      .map((s, i) => ({ s, i }))
      .filter(
        (e) => !taken.has(e.i) && (!kind || e.s.kind === kind) && (kind || e.s.kind !== "driver"),
      )
      .map((e) => e.i);
  }

  /** The index of the driver's seat, or -1. */
  const driverSeat = (c) => seatsOf(c).findIndex((s) => s.kind === "driver");

  /** Sit a person in a seat at once. */
  function seat(c, person, index) {
    const s = seatsOf(c)[index];
    if (!s) return false;
    posed(person, s.kind === "driver" ? "drive" : "sit");
    c.occ.push({ person, seat: index });
    return true;
  }

  /**
   * Fill a car with a driver and `n` passengers (random seats; kids ride in the rear when there is one).
   * Returns how many people are aboard.
   */
  function fillCar(c, passengers) {
    const d = driverSeat(c);
    if (d >= 0) seat(c, makePerson(O.rng() < 0.15 ? "elder" : "adult"), d);
    for (let i = 0; i < passengers; i += 1) {
      const free = freeSeats(c);
      if (!free.length) break;
      const idx = free[Math.floor(O.rng() * free.length)];
      const rear = seatsOf(c)[idx].kind === "rear";
      seat(c, makePerson(rear && O.rng() < 0.5 ? "kid" : "any"), idx);
    }
    return c.occ.length;
  }

  /** Fill the bus's passenger seats with `n` people. */
  function fillBus(c, n) {
    for (let i = 0; i < n; i += 1) {
      const free = freeSeats(c, "bus");
      if (!free.length) break;
      seat(c, makePerson("any"), free[Math.floor(O.rng() * free.length)]);
    }
    if (driverSeat(c) >= 0 && !c.occ.some((o) => o.seat === driverSeat(c)))
      seat(c, makePerson("adult", false), driverSeat(c));
    return c.occ.length;
  }

  /** How many passengers (not the driver) are aboard. */
  const riders = (c) => c.occ.filter((o) => seatsOf(c)[o.seat].kind !== "driver").length;

  /* ------------------------------ drawing ------------------------------ */

  /** Where a seated person's figure stands in the world, facing the way the seat does. */
  function seatedAt(c, index, person) {
    const s = seatsOf(c)[index];
    const at = G.Rig.toWorld(c, s.x, 0, s.z);
    return {
      x: at.x,
      y: (c.y || 0) + s.y - dropOf(person),
      z: at.z,
      heading: c.sim.heading + (s.heading || 0),
    };
  }

  /** Add one person to the kit. */
  function addTo(kit, p, at, dt) {
    p.phase = (p.phase + dt * p.rate) % 1;
    KQ.Figures.CrowdKit.add(kit, {
      x: at.x,
      y: at.y,
      z: at.z,
      heading: at.heading,
      scale: p.scale,
      pose: p.pose,
      phase: p.phase,
      kid: p.kid,
      girth: p.outfit.girth,
      outfit: p.outfit,
      prop: null,
    });
    O.drawn += 1;
  }

  /** Is any part of a carrier (nose, middle, tail) where the camera could show it? */
  function inView(C, c) {
    const spec = c.sim.spec;
    const f = [Math.sin(c.sim.heading), Math.cos(c.sim.heading)];
    return [-1, 0, 1].some(function (k) {
      const x = c.sim.x + f[0] * spec.halfLen * k;
      const z = c.sim.z + f[1] * spec.halfLen * k;
      return C.canSee(x, z) && Math.hypot(x - C.view.x, z - C.view.z) < DRAW_RANGE;
    });
  }

  /** Draw the carrier's seated people. */
  function drawSeated(kit, c, dt) {
    c.occ.forEach((o) => addTo(kit, o.person, seatedAt(c, o.seat, o.person), dt));
  }

  /**
   * Draw everyone in a vehicle for this frame (called by the crowd between begin and end), and step the scenes of
   * people getting in and out.
   * @param kit the crowd kit, @param C the crowd, @param {number} dt seconds
   */
  function draw(kit, C, dt) {
    O.drawn = 0;
    O.carriers.forEach(function (c) {
      stepCarrier(c, dt);
      if (!c.mesh.group.visible || !C.canSee || !inView(C, c)) return;
      drawSeated(kit, c, dt);
      if (c.active) drawActive(kit, c.active, dt);
    });
    O.transits.forEach((t) => stepWalk(t, dt, kit, C));
    O.transits = O.transits.filter((t) => !t.done);
  }

  /* ------------------------------ getting out and in of a car ------------------------------ */

  /** The scene description for one person leaving or entering a seat of a car. */
  function describeJob(c, job) {
    const s = seatsOf(c)[job.seat];
    const at = seatedAt(c, job.seat, job.person);
    return G.VehicleEnter.describe({
      kind: c.kind,
      dir: job.dir,
      sim: c.sim,
      mesh: c.mesh,
      from: job.from,
      away: job.away,
      seatPt: at,
      seatX: s.x,
    });
  }

  /** Start the next queued job of a carrier if it is idle. */
  function stepCarrier(c, dt) {
    if (!c.active && c.queue.length) startJob(c, c.queue.shift());
    if (c.active) advance(c, dt);
  }

  /** Begin a job: take the person out of their seat (leaving) and open the door. */
  function startJob(c, job) {
    const d = describeJob(c, job);
    const s = seatsOf(c)[job.seat];
    if (job.dir === "out") c.occ = c.occ.filter((o) => o.person !== job.person);
    c.active = {
      job,
      d,
      t: 0,
      fired: { open: false, close: false },
      door: G.Rig.doorFor(c.mesh, s.side, s),
      last: null,
    };
    posed(job.person, job.dir === "out" ? "sit" : "walk");
  }

  /** Step the scene by dt: timeline, door, cues; finish when it is over. */
  function advance(c, dt) {
    const a = c.active;
    a.t += dt;
    const kind = c.kind === "lorry" ? "lorry" : "car";
    const s = VL().at(kind, a.job.dir, a.t, a.d.walk);
    a.s = s;
    a.at = G.VehicleEnter.pose(a.d, s);
    G.Rig.openDoor(a.door, s.door);
    const cue = VL().cue(s, a.fired);
    if (cue && G.VehicleSound) G.VehicleSound.door(cue, c.sim);
    if (s.done) finishJob(c);
  }

  /** Draw the person of an active car scene in the pose its phase calls for. */
  function drawActive(kit, a, dt) {
    if (!a.at) return;
    const s = a.s;
    const seated = s.seat > 0.4;
    posed(
      a.job.person,
      seated ? "sit" : a.job.dir === "in" && s.phase === "open" ? "idle" : "walk",
    );
    addTo(kit, a.job.person, a.at, dt);
  }

  /** The scene ended: close the door, seat the person (getting in) or hand them on (getting out). */
  function finishJob(c) {
    const a = c.active;
    G.Rig.openDoor(a.door, 0);
    c.active = null;
    if (a.job.dir === "in") {
      seat(c, a.job.person, a.job.seat);
      O.boards += 1;
    } else {
      O.exits += 1;
    }
    if (a.job.onDone) a.job.onDone(a.job.person, a.at);
  }

  /** Queue a person to step out of their seat; `away` is where they are set down (world x, z). */
  function exitCar(c, entry, away, onDone) {
    c.queue.push({ dir: "out", person: entry.person, seat: entry.seat, away, onDone });
  }

  /** Queue a person who stands at `from` (world x, z) to get in at a free seat. Returns false when none is free. */
  function enterCar(c, person, from, index, onDone) {
    c.queue.push({ dir: "in", person, seat: index, from, onDone });
    return true;
  }

  /** Is anything of this carrier still going on (a person getting in or out)? */
  const busy = (c) => Boolean(c.active) || c.queue.length > 0;

  /* ------------------------------ walking inside and out of the bus ------------------------------ */

  /**
   * A person who walks a path of points {lat, z, y} in the carrier's frame (y: 0 = the ground by the carrier, `floor`
   * = inside) at `speed` m/s and then calls onDone(person, world {x, y, z}).
   */
  function walkIn(c, person, pts, speed, onDone) {
    posed(person, "walk");
    const lens = pts.slice(1).map((p, i) => Math.hypot(p.lat - pts[i].lat, p.z - pts[i].z));
    O.transits.push({
      c,
      person,
      pts,
      lens,
      total: lens.reduce((a, b) => a + b, 0),
      speed,
      t: 0,
      onDone,
    });
  }

  /** The world place along a transit at distance `d` metres. */
  function along(t, d) {
    let left = d;
    for (let i = 0; i < t.lens.length; i += 1) {
      if (left <= t.lens[i] || i === t.lens.length - 1) {
        const u = t.lens[i] > 0 ? U.clamp(left / t.lens[i], 0, 1) : 1;
        const a = t.pts[i];
        const b = t.pts[i + 1];
        return {
          lat: U.lerp(a.lat, b.lat, u),
          z: U.lerp(a.z, b.z, u),
          y: U.lerp(a.y, b.y, u),
          dx: b.lat - a.lat,
          dz: b.z - a.z,
        };
      }
      left -= t.lens[i];
    }
    return { lat: 0, z: 0, y: 0, dx: 0, dz: 1 };
  }

  /** Step one walk (draws the person while the carrier is on screen) and finish it at the end. */
  function stepWalk(t, dt, kit, C) {
    t.t += dt;
    const d = Math.min(t.total, t.t * t.speed);
    const p = along(t, d);
    const w = G.Rig.toWorld(t.c, p.lat, 0, p.z);
    const h = t.c.sim.heading;
    // direction of travel in the carrier's frame turned into the world heading
    const face = Math.atan2(
      p.dx * Math.cos(h) + p.dz * Math.sin(h),
      p.dz * Math.cos(h) - p.dx * Math.sin(h),
    );
    t.at = { x: w.x, y: (t.c.y || 0) + p.y, z: w.z, heading: face };
    if (kit && C && C.canSee(w.x, w.z)) addTo(kit, t.person, t.at, dt);
    if (t.t * t.speed >= t.total) {
      t.done = true;
      t.onDone(t.person, t.at);
    }
  }

  /** Remove a seated person (the ones getting off the bus walk out through its doors). Returns the entries removed. */
  function takeRiders(c, n) {
    const list = c.occ.filter((o) => seatsOf(c)[o.seat].kind !== "driver");
    const out = [];
    for (let i = 0; i < n && list.length; i += 1) {
      const e = list.splice(Math.floor(O.rng() * list.length), 1)[0];
      c.occ = c.occ.filter((o) => o !== e);
      out.push(e);
    }
    return out;
  }

  /** Test hook: who is aboard what, scenes under way, totals. */
  function debug() {
    return {
      carriers: O.carriers.map((c) => ({
        id: c.id,
        kind: c.kind,
        aboard: c.occ.length,
        riders: riders(c),
        busy: busy(c),
      })),
      transits: O.transits.length,
      exits: O.exits,
      boards: O.boards,
      drawn: O.drawn,
    };
  }

  G.Occupants = {
    register,
    unregister,
    seatsOf,
    freeSeats,
    driverSeat,
    seat,
    fillCar,
    fillBus,
    riders,
    draw,
    exitCar,
    enterCar,
    walkIn,
    takeRiders,
    makePerson,
    personFrom,
    busy,
    debug,
    BUS_FLOOR,
    rng: () => O.rng(),
  };
})((window.KQ = window.KQ || {}));
