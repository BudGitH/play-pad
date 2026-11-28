/* ============================================================================
 * FILE: bus-people.js
 * PURPOSE: The people of the town bus at its stop: 1-3 passengers get up, walk to the middle door and step out
 *          onto the pavement (handed to the crowd walkers), and 1-3 people waiting at the stop walk up to the
 *          front door, step in and sit down. Seated people are drawn in the windows by vehicle-occupants.js.
 * BUSINESS CONTEXT: owner request "you will see people in the bus, people entering the bus, leaving the bus".
 *   Counts are chosen by the pure rule KQ.Sim.Traffic.boarding and are visible in __kq.vehicles().bus.
 * HOW IT FITS: bus.js calls plan(B) when the bus stops and step(B) every frame while it dwells; the bus waits
 *   (a few seconds at most) for anyone still walking up. Everyone steps out and in politely, nobody is pushed.
 * DEPENDENCIES: bus.js (the model: G.Bus.model()), vehicle-occupants.js, crowd-walkers.js (adopt, redirect),
 *   vehicle-rig.js, KQ.Sim.Traffic.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  /** When (seconds into the stop) each person starts: getting off first, getting on a little later. */
  const OFF_AT = 0.9;
  const ON_AT = 1.5;
  const GAP = 0.9;
  const S = () => G.S;

  /** The pavement spot outside the front door, in the world. */
  function outsideOf(m) {
    return G.Rig.toWorld(m.B.car, m.OUTSIDE, 0, m.DOOR_FRONT);
  }

  /** Crowd people waiting at the stop and close enough to walk to the door in time. */
  function waitingNow(m) {
    const C = S().crowd;
    if (!C) return [];
    const at = outsideOf(m);
    return C.members.filter(
      (p) =>
        p.kind === "bus" &&
        !p.walker &&
        !p.gone &&
        !p.leaving &&
        p.show > 0.6 &&
        U.dist(p.x, p.z, at.x, at.z) < m.BOARD_REACH,
    );
  }

  /** Plan the stop: who gets off (by their seat) and who gets on, as timed events. */
  function plan(B) {
    const m = G.Bus.model();
    const car = m.B.car;
    const waiting = waitingNow(m);
    const seats = G.Occupants.seatsOf(car).filter((s) => s.kind === "bus").length;
    const n = KQ.Sim.Traffic.boarding(
      G.Occupants.rng,
      G.Occupants.riders(car),
      waiting.length,
      seats,
    );
    B.waitingSeen = waiting.length;
    B.plan = [];
    for (let i = 0; i < n.off; i += 1) B.plan.push({ at: OFF_AT + i * GAP, type: "off" });
    for (let i = 0; i < n.on; i += 1) B.plan.push({ at: ON_AT + i * GAP, type: "on" });
    B.pending = n.on;
  }

  /** Fire the events that are due (the doors must be open enough to step through). */
  function step(B) {
    if (!B.plan.length || B.doors < 0.6) return;
    const m = G.Bus.model();
    while (B.plan.length && B.plan[0].at <= B.elapsed) {
      const ev = B.plan.shift();
      if (ev.type === "off") alight(m);
      else board(m);
    }
  }

  /** The way from a seat out through the middle door: aisle, door, pavement. Points are {lat, z, y} in the bus frame. */
  function outPath(m, seat) {
    const f = G.Occupants.BUS_FLOOR;
    return [
      { lat: seat.x, z: seat.z, y: f },
      { lat: 0.1, z: seat.z, y: f },
      { lat: 0.1, z: m.DOOR_MID, y: f },
      { lat: 1.25, z: m.DOOR_MID, y: f },
      { lat: m.OUTSIDE, z: m.DOOR_MID, y: 0 },
    ];
  }

  /** The way from the pavement in through the front door to a seat. */
  function inPath(m, seat) {
    const f = G.Occupants.BUS_FLOOR;
    return [
      { lat: m.OUTSIDE, z: m.DOOR_FRONT, y: 0 },
      { lat: 1.25, z: m.DOOR_FRONT, y: f },
      { lat: 0.1, z: m.DOOR_FRONT - 0.5, y: f },
      { lat: 0.1, z: seat.z, y: f },
      { lat: seat.x, z: seat.z, y: f },
    ];
  }

  /** One passenger gets up and walks out; at the pavement they join the crowd. */
  function alight(m) {
    const car = m.B.car;
    const entry = G.Occupants.takeRiders(car, 1)[0];
    if (!entry) return;
    const seat = G.Occupants.seatsOf(car)[entry.seat];
    G.Occupants.walkIn(car, entry.person, outPath(m, seat), m.WALK, function (person, at) {
      const C = S().crowd;
      if (C) G.CrowdWalkers.adopt(C, person.outfit, at.x, at.z);
      m.B.alighted += 1;
    });
  }

  /** A seat nobody sits in (a passenger seat; the driver's is never given away). */
  function freeSeat(m) {
    const car = m.B.car;
    const taken = m.B.reserved || (m.B.reserved = []);
    const free = G.Occupants.freeSeats(car, "bus").filter((i) => taken.indexOf(i) === -1);
    return free.length ? free[Math.floor(G.Occupants.rng() * free.length)] : -1;
  }

  /** A waiting person walks up to the front door; on arrival they step in and sit down. */
  function board(m) {
    const waiting = waitingNow(m);
    const idx = freeSeat(m);
    if (!waiting.length || idx < 0) {
      m.B.pending = Math.max(0, m.B.pending - 1);
      return;
    }
    const to = outsideOf(m);
    const p = waiting.sort(
      (a, b) => U.dist(a.x, a.z, to.x, to.z) - U.dist(b.x, b.z, to.x, to.z),
    )[0];
    m.B.reserved.push(idx);
    G.CrowdWalkers.redirect(S().crowd, p, [{ x: to.x, z: to.z }], () => arrive(m, p, idx));
  }

  /** The waiting person is at the door: they leave the crowd and walk in. */
  function arrive(m, p, idx) {
    const B = m.B;
    const release = () => (B.reserved = (B.reserved || []).filter((i) => i !== idx));
    if (B.state !== "stop") {
      release();
      B.pending = Math.max(0, B.pending - 1);
      return; // the bus has gone: they go on their way (crowd-walkers lingers and re-routes them)
    }
    p.leaving = true;
    p.show = 0;
    p.gone = true;
    const person = G.Occupants.personFrom(p.outfit);
    const seat = G.Occupants.seatsOf(B.car)[idx];
    G.Occupants.walkIn(B.car, person, inPath(m, seat), m.WALK, function () {
      G.Occupants.seat(B.car, person, idx);
      release();
      B.pending = Math.max(0, B.pending - 1);
      B.boarded += 1;
    });
  }

  G.BusPeople = { plan, step };
})((window.KQ = window.KQ || {}));
