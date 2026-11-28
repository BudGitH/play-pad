/* ============================================================================
 * FILE: traffic-park.js
 * PURPOSE: What a traffic car does once it has pulled into a kerbside bay: the people inside get out (the door
 *          opens, each steps out and walks off into the crowd), the car waits a while, then new people walk up,
 *          the door opens, they climb in, it closes and it drives off.
 * BUSINESS CONTEXT: owner request "cars occasionally park in a free spot, and the people get out or get in and
 *   drive off". Everyone is polite: no one is ever pulled out, and the people getting in come from the pavement.
 * HOW IT FITS: traffic.js owns the car records and calls arrive(c) when a car stops in its bay and step(c, dt)
 *   every frame while it is parked; step() returns true when the car should pull out again. The people on foot are
 *   crowd walkers (crowd-walkers.js adopt / redirect); the scenes are vehicle-occupants.js.
 * DEPENDENCIES: vehicle-occupants.js, vehicle-enter.js, vehicle-rig.js, crowd-walkers.js, traffic-routes.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const O = () => G.Occupants;
  /** The car waits this long (s) with nobody in it before people come, and gives people this long to arrive. */
  const IDLE_MIN = 9;
  const IDLE_SPAN = 14;
  const GIVE_UP = 75;
  /** How often (s) a new person may try to appear on the pavement, and where (m along the road from the bay). */
  const TRY_EVERY = 2;
  const SPOTS = [9, -9, 14, -14, 6, -6];
  /** Where the pavement is: lateral metres off the road's middle, on the kerb side of a bay. */
  const PAVEMENT = 4.9;
  const P = { exited: 0, boarded: 0, noRoom: 0 };

  /** The point on the pavement beside a bay, `along` metres from it, in world x, z. */
  function pavement(c, along) {
    const r = c.route;
    const R = G.TrafficRoutes;
    return R.pointAt(r, c.bayU + along * c.dir, c.dir * PAVEMENT);
  }

  /** The car has stopped in its bay: everybody gets out. */
  function arrive(c) {
    c.park = {
      t: 0,
      stage: "out",
      idleT: IDLE_MIN + O().rng() * IDLE_SPAN,
      boarders: 0,
      want: 0,
      tryT: 0,
      reserved: [],
    };
    const list = c.occ.slice();
    list.forEach(function (entry, i) {
      O().exitCar(c, entry, pavement(c, (i - 0.5) * 1.2), (person, at) => handOver(c, person, at));
    });
  }

  /** A person who stepped out walks off with the crowd. */
  function handOver(c, person, at) {
    const C = G.S.crowd;
    const m = C ? G.CrowdWalkers.adopt(C, person.outfit, at.x, at.z) : null;
    if (m) P.exited += 1;
    else P.noRoom += 1;
  }

  /** The way from a pavement spot to a seat's door, as world points (round the nearer end when the door is on the road side). */
  function route(c, seatIdx, from) {
    const s = O().seatsOf(c)[seatIdx];
    const sim = c.sim;
    const d = G.VehicleEnter.describe({
      kind: c.kind,
      dir: "in",
      sim,
      mesh: c.mesh,
      from,
      seatPt: G.Rig.toWorld(c, s.x, s.y, s.z),
      seatX: s.x,
    });
    const fx = Math.sin(sim.heading);
    const fz = Math.cos(sim.heading);
    const pts = d.path
      .slice(1)
      .map((p) => ({ x: sim.x + fx * p.fwd + fz * p.lat, z: sim.z + fz * p.fwd - fx * p.lat }));
    return { pts, door: d.doorW };
  }

  /** A seat nobody sits in or is heading for: the driver's first, then the others. */
  function nextSeat(c) {
    const taken = c.park.reserved;
    const d = O().driverSeat(c);
    if (d >= 0 && taken.indexOf(d) === -1 && !c.occ.some((o) => o.seat === d)) return d;
    const free = O()
      .freeSeats(c)
      .filter((i) => taken.indexOf(i) === -1);
    return free.length ? free[0] : -1;
  }

  /** Try to bring one person up from the pavement; `force` ignores whether the child could see them appear. */
  function sendBoarder(c, force) {
    const C = G.S.crowd;
    const idx = nextSeat(c);
    if (!C || idx < 0) return false;
    const at = SPOTS.map((a) => pavement(c, a)).find((p) => force || !C.visibleNear(p.x, p.z));
    if (!at) return false;
    const person = O().makePerson(c.park.reserved.length ? "any" : "adult");
    const m = G.CrowdWalkers.adopt(C, person.outfit, at.x, at.z);
    if (!m) return false;
    const way = route(c, idx, at);
    c.park.reserved.push(idx);
    c.park.boarders += 1;
    G.CrowdWalkers.redirect(C, m, way.pts, () => arriveAtDoor(c, m, person, idx, way.door));
    return true;
  }

  /** The walker reached the door: they leave the crowd and get in. */
  function arriveAtDoor(c, m, person, idx, door) {
    m.leaving = true;
    m.show = 0;
    m.gone = true;
    O().enterCar(c, person, door, idx, () => {
      P.boarded += 1;
    });
  }

  /** Is every person who set out for the car aboard? */
  const allAboard = (c) => c.occ.length >= c.park.boarders && !O().busy(c);

  /** Step a parked car. Returns true when it is ready to pull out. */
  function step(c, dt, force) {
    const k = c.park;
    k.t += dt;
    if (k.stage === "out") {
      if (!O().busy(c) && !c.occ.length) Object.assign(k, { stage: "idle" });
    } else if (k.stage === "idle") {
      k.idleT -= dt;
      if (k.idleT <= 0) Object.assign(k, { stage: "board", want: 1 + (O().rng() < 0.4 ? 1 : 0) });
    } else if (k.stage === "board") return boarding(c, k, dt, force);
    return false;
  }

  /** The boarding stage: send people up one at a time, wait until everyone is aboard. */
  function boarding(c, k, dt, force) {
    k.tryT -= dt;
    if (k.boarders < k.want && k.tryT <= 0) {
      k.tryT = TRY_EVERY;
      sendBoarder(c, force);
    }
    if (k.boarders > 0 && k.boarders >= k.want && allAboard(c))
      return c.occ.some((o) => o.seat === O().driverSeat(c)) || O().driverSeat(c) < 0;
    return k.t > GIVE_UP && k.boarders === 0 ? "empty" : false;
  }

  /** Should an empty parked car that nobody came for go away (when unseen)? */
  const gaveUp = (r) => r === "empty";

  G.TrafficPark = { arrive, step, gaveUp, pavement, debug: () => Object.assign({}, P) };
})((window.KQ = window.KQ || {}));
