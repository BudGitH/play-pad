/* ============================================================================
 * FILE: vehicle-rig.js
 * PURPOSE: One guarded door to what a built vehicle model (the "rig") offers: its doors that open, its seats,
 *          its lights, its exhaust pipe. The looks workstream adds `rig.doors`, `rig.seats`, `rig.lights`,
 *          `rig.exhaust` (and the bicycle's `pedals` / `wheels` / `steer`); every call here checks the feature
 *          is there and does nothing (or uses the numbers the model has always had) when it is not, so this
 *          code works before and after that branch merges.
 * RIG API it relies on (names exactly as agreed):
 *   rig.doors   [{side:"L"|"R", seat, pivot, open(t 0..1)}]
 *   rig.seats   [{pos (local Vector3), heading, kind:"driver"|"front"|"rear"|"bus"}]
 *   rig.lights  {setBrake(on), setHead(on), setIndicator("L"|"R"|null, t), setReverse(on)}
 *   rig.exhaust {pos (local), fuel:"petrol"|"diesel"|"electric"}
 * DEPENDENCIES: KQ.Figures.Vehicles (SEAT, setDoors), KQ.Figures.VehicleCars (rows), KQ.Sim.VehicleLife (fuel).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const NOOP_LIGHTS = {
    setBrake: () => null,
    setHead: () => null,
    setIndicator: () => null,
    setReverse: () => null,
  };
  /** Height of a bus seat's top above the ground (m), used when the rig lists no seats. */
  const BUS_SEAT_TOP = 0.9;
  /** Where the bus's seats are when the rig lists none: [lateral (+ left), z]. Clear of the two left-side doors. */
  const BUS_SEATS = [
    [-0.75, -3.8],
    [-0.75, -2.6],
    [-0.75, -1.4],
    [-0.75, -0.2],
    [-0.75, 1.0],
    [-0.75, 2.2],
    [0.75, -3.8],
    [0.75, -2.6],
    [0.75, -1.4],
    [0.75, 1.7],
    [0.75, 2.6],
  ];

  /** Does this value look like the new door API (an object with an open function)? */
  const isDoor = (d) => Boolean(d) && typeof d.open === "function";

  /** The rig's doors in the new API shape, or []. */
  function doorsOf(rig) {
    return rig && Array.isArray(rig.doors) ? rig.doors.filter(isDoor) : [];
  }

  /** Is this a seat that sits on the left (+x) or right (-x) of the middle? */
  const sideOf = (pos) => (pos.x >= 0 ? "L" : "R");

  /** The door for a side, preferring the one the seat names; null when the rig has no doors. */
  function doorFor(rig, side, seat) {
    const list = doorsOf(rig).filter((d) => d.side === side);
    if (!list.length) return null;
    const named = seat && list.find((d) => d.seat === seat.index || d.seat === seat.kind);
    return named || list[0];
  }

  /** Open a door by t 0..1 (a no-op for null). */
  function openDoor(door, t) {
    if (isDoor(door)) door.open(Math.max(0, Math.min(1, t)));
  }

  /** Open or close every door of the bus: the new API when it has it, the old plug-door slide otherwise. */
  function setBusDoors(rig, t) {
    const doors = doorsOf(rig);
    if (doors.length) {
      doors.forEach((d) => d.open(Math.max(0, Math.min(1, t))));
      return;
    }
    if (rig && Array.isArray(rig.doors) && rig.doors.every((d) => d && d.mesh))
      KQ.Figures.Vehicles.setDoors(rig, t);
  }

  /** The seats of a vehicle as {x, z, y (seat top above the ground), heading, kind, side, index}. */
  function seatsOf(v) {
    const rig = v.mesh;
    if (rig && Array.isArray(rig.seats) && rig.seats.length) return fromRig(v, rig.seats);
    return fallbackSeats(v);
  }

  /** Seats the rig lists, in the vehicle's frame. */
  function fromRig(v, list) {
    const top = seatTop(v.kind);
    return list.map(function (s, i) {
      const p = s.pos || { x: 0, y: top, z: 0 };
      const y = typeof p.y === "number" && p.y > 0.2 ? p.y : top;
      return {
        x: p.x,
        z: p.z,
        y,
        heading: s.heading || 0,
        kind: s.kind || "front",
        side: sideOf(p),
        index: i,
      };
    });
  }

  /** The seat top height of a kind: the hero's seat origin plus his drop to the seat. */
  function seatTop(kind) {
    if (kind === "bus") return BUS_SEAT_TOP;
    const seat = KQ.Figures.Vehicles.SEAT[kind];
    const P = G.S && G.S.player;
    const drop = P && P.rig ? KQ.Figures.seatDrop(P.rig) : 0.4;
    return (seat ? seat.y : 0.3) + drop;
  }

  /** The seats a model has always had: the driver, a front passenger and the rear rows. */
  function fallbackSeats(v) {
    if (v.kind === "bus") return busSeats();
    if (v.kind !== "car" && v.kind !== "lorry") return [];
    const x = v.mesh.seatX || -0.34;
    const top = seatTop(v.kind);
    const z = v.kind === "lorry" ? KQ.Figures.Vehicles.SEAT.lorry.z : 0;
    const list = [seat(x, z, top, "driver"), seat(-x, z, top, "front")];
    if (v.kind === "car")
      rowsOf(v).forEach((r) => list.push(seat(x, r, top, "rear"), seat(-x, r, top, "rear")));
    return list.map((s, i) => Object.assign(s, { index: i }));
  }

  /** The rear seat rows of a car's style (z), or one default row. */
  function rowsOf(v) {
    const C = KQ.Figures.VehicleCars;
    const st = C && C.STYLES && C.STYLES[v.style];
    return st && st.rows ? st.rows : [-0.95];
  }

  /** One seat record. */
  function seat(x, z, y, kind) {
    return { x, z, y, heading: 0, kind, side: x >= 0 ? "L" : "R" };
  }

  /** The bus's seats in its own frame: the driver's (right-hand seat at the front) and the passengers'. */
  function busSeats() {
    const list = [seat(-0.6, 4.05, 0.95, "driver")];
    BUS_SEATS.forEach((s) => list.push(seat(s[0], s[1], BUS_SEAT_TOP, "bus")));
    return list.map((s, i) => Object.assign(s, { index: i }));
  }

  /** The rig's lights, or an object whose methods do nothing. */
  function lightsOf(rig) {
    const l = rig && rig.lights;
    return l && typeof l.setBrake === "function" ? l : NOOP_LIGHTS;
  }

  /** Does the rig have its own lights (so the lit state is real)? */
  const hasLights = (rig) =>
    Boolean(rig && rig.lights && typeof rig.lights.setBrake === "function");

  /** Where the exhaust pipe is in the vehicle's frame, and what it burns: {x, y, z, fuel} or null (a bicycle). */
  function exhaustOf(v) {
    const rig = v.mesh;
    const fuel =
      rig.exhaust && rig.exhaust.fuel
        ? rig.exhaust.fuel
        : KQ.Sim.VehicleLife.fuelOf(v.kind, v.style);
    const p = rig.exhaust && rig.exhaust.pos;
    if (p) return { x: p.x, y: p.y, z: p.z, fuel };
    if (v.kind === "bike") return null;
    const f = rig.foot || { mid: 0, hl: 1 };
    const back = f.mid - f.hl;
    const at = { car: [0.45, 0.28], lorry: [0.7, 0.42], moto: [-0.15, 0.3], bus: [0.7, 0.5] }[
      v.kind
    ];
    return { x: at[0], y: at[1], z: v.kind === "moto" ? -0.95 : back, fuel };
  }

  /** A local point of a vehicle in the world: {x, y, z}, ignoring pitch and roll. */
  function toWorld(v, x, y, z) {
    const h = v.sim.heading;
    return {
      x: v.sim.x + Math.sin(h) * z + Math.cos(h) * x,
      y: (v.y || 0) + y,
      z: v.sim.z + Math.cos(h) * z - Math.sin(h) * x,
    };
  }

  /** The bicycle's pedals / wheels / steer when the model has them (all optional). */
  function animateBike(rig, phase, spin, steer) {
    if (rig && typeof rig.pedals === "function") rig.pedals(phase);
    if (rig && typeof rig.wheels === "function") rig.wheels(spin);
    if (rig && typeof rig.steer === "function") rig.steer(steer);
  }

  G.Rig = {
    doorsOf,
    doorFor,
    openDoor,
    setBusDoors,
    seatsOf,
    seatTop,
    lightsOf,
    hasLights,
    exhaustOf,
    toWorld,
    animateBike,
    sideOf,
  };
})((window.KQ = window.KQ || {}));
