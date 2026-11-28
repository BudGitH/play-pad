// Kampung Quest — the cars, bicycles, scooters, the lorry and the bus (AC-H6, owner's realism pass). The shapes come
// from vehicle-car-geo.js (five car styles), vehicle-two-wheel-geo.js (bicycle, scooter) and vehicle-big-geo.js
// (bus, lorry); this file dresses them with materials (vehicle-mats.js), adds the wheels and the steering end,
// attaches the rig (vehicle-rig.js: doors, seats, lights, exhaust, interior) and animates them. Geometries and
// materials are cached and shared; a parked car is 8 draw calls (paint, trim + lamps + cabin, glass, roof, two front
// wheels, the rear axle, the ground blob), a door adds its own meshes only while it is open. Each record also carries
// `contacts` (where the tyres touch the ground, {fwd, lat}, for Sim.Vehicle.groundPose: AC-P11) and `foot` (the
// body's footprint {mid, hl, hw}, the parked collider: AC-P12). Local frame: the vehicle faces +z, its left is +x,
// the origin is on the ground in the middle of the wheelbase.
//   F.Vehicles.build(kind, colourHex, {style, lhd, low, fuel}) -> { group, kind, style, seatX, wheels, pivots, rig ... }
//   F.Vehicles.animate(v, dt, speed, steer)          wheels roll, the front end steers, auto brake / reverse lamps
//   F.Vehicles.SEAT[kind]                            where the hero sits (local y of the figure's origin, local z)
// kind: "car" | "bike" | "moto" | "lorry" | "bus". A car's style is hatch | sedan | taxi | suv | mpv; `lhd` puts the
// driver on the left (Saudi Arabia drives on the right, Singapore on the left).
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const Cars = () => F.VehicleCars;
  const TW = () => F.VehicleTwoWheel;
  const Big = () => F.VehicleBig;
  const Mats = () => F.VehicleMats;
  const Rig = () => F.VehicleRig;
  const WHEEL_R = { car: 0.3, bike: 0.28, moto: 0.27, lorry: 0.38, bus: 0.48 };
  /** The figure's origin when seated: the seat top minus the drop to the thighs (see F.seatDrop), and its z. */
  const SEAT = {
    car: { y: 0.315, z: 0 },
    bike: { y: 0.2, z: -0.1 },
    moto: { y: 0.405, z: 0.1 },
    lorry: { y: 1.0, z: 1.72 },
  };
  /** The wheel's inset from the body's side. */
  const WHEEL_INSET = 0.17;
  const STEER_LOCK = { car: 0.5, bike: 0.35, moto: 0.4, lorry: 0.45, bus: 0.3 };
  /** Tyre widths of the four-wheelers. */
  const TYRE_W = { car: 0.21, lorry: 0.26, bus: 0.3 };
  /** How see-through the roof is while the hero drives. */
  const ROOF_FADE = 0.22;
  const cache = { axles: {} };

  /** A mesh, casting a shadow unless told not to. */
  function mesh(geo, mat, name, shadow) {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = shadow !== false;
    return m;
  }

  /** The shared steering-wheel geometry. */
  function steerGeo() {
    return cache.steer || (cache.steer = F.VehicleParts.steering());
  }

  /** The pair of wheels of an axle as one mesh (cached per radius, width, track and detail). */
  function axleGeo(x, r, width) {
    const key = ["a", x, r, width, F.VehicleParts.detail()]
      .map((n) => (n.toFixed ? n.toFixed(3) : n))
      .join();
    return cache.axles[key] || (cache.axles[key] = F.VehicleParts.carAxle(r, width, x));
  }

  /** One wheel of a four-wheeler with its show face toward side s (cached). */
  function wheelGeo(r, width, s) {
    const key = ["w", r, width, s, F.VehicleParts.detail()]
      .map((n) => (n.toFixed ? n.toFixed(3) : n))
      .join();
    return cache.axles[key] || (cache.axles[key] = F.VehicleParts.carWheel(r, width, s));
  }

  /** A fresh vehicle record around a group. */
  function record(kind, group, style) {
    const v = { group, kind, style, wheels: [], pivots: [], steering: null, rolled: 0, seatX: 0 };
    // the record (and its rig) from the scene graph (tests, the game layer); not enumerable, so clone() still works
    Object.defineProperty(group.userData, "vehicle", { value: v, enumerable: false });
    v.contacts = [];
    v.feet = [];
    v.foot = null;
    return v;
  }

  /** Put one wheel on a group (a steering one sits in a pivot that turns). */
  function addWheel(v, parent, geo, at, steers, sides) {
    const pivot = new THREE.Group();
    pivot.position.set(at[0], at[1], at[2]);
    // the body's shadow is enough; wheels would double the shadow pass
    pivot.add(mesh(geo, Mats().sharedTrim(), "wheel", false));
    parent.add(pivot);
    v.wheels.push(pivot.children[0]);
    if (steers) v.pivots.push(pivot);
    // where each tyre touches the ground, in the pivot's frame (an axle mesh has a tyre on each side)
    (sides || [0]).forEach((x) => v.feet.push({ pivot, at: [x, -at[1], 0] }));
    return pivot;
  }

  /** The steering wheel, tilted toward the driver, on the driver's side (`at` = [y, z]). */
  function addSteering(v, x, at, hidden) {
    const tilt = new THREE.Group();
    tilt.position.set(x, at[0], at[1]);
    tilt.rotation.x = 0.64;
    v.steering = mesh(steerGeo(), Mats().sharedTrim(), "steering", false);
    v.steering.visible = !hidden;
    tilt.add(v.steering);
    v.group.add(tilt);
  }

  /** The wheels: the front pair steer on their own pivots (a bus's front axle is one mesh), the rear axle is one mesh. */
  function addAxles(v, group, geo) {
    const r = geo.wheelR || WHEEL_R.car;
    const tw = TYRE_W[v.kind] || 0.21;
    const x = geo.width / 2 - (geo.inset || WHEEL_INSET);
    const [front, rear] = geo.axles;
    v.wheelR = r;
    v.track = x;
    if (v.kind === "bus")
      v.front = addWheel(v, group, axleGeo(x, r, tw), [0, r, front], false, [-x, x]);
    else [-1, 1].forEach((s) => addWheel(v, group, wheelGeo(r, tw, s), [s * x, r, front], true));
    v.axle = addWheel(v, group, axleGeo(x, r, tw), [0, r, rear], false, [-x, x]);
    v.contacts = [front, rear].flatMap((z) => [-1, 1].map((s) => ({ fwd: z, lat: s * x })));
  }

  /** The footprint (parked collider) and the ground blob of a four-wheeler. */
  function finish(v, geo) {
    v.foot = { mid: geo.mid, hl: geo.length / 2 + 0.02, hw: geo.width / 2 + 0.01 };
    if (!geo.noBlob) v.group.add(F.VehicleParts.blob(geo.width + 0.5, geo.length + 0.5));
  }

  /** Build a car (one of the five styles) or the lorry from a geometry set: layers, wheels, rig. */
  function buildSet(kind, hex, set, low) {
    const tier = low ? "low" : "hi";
    const group = new THREE.Group();
    group.name = "vehicle-" + kind;
    const v = record(kind, group, set.style);
    v.paintMat = Mats().paint(set.livery ? 0xffffff : hex, tier);
    v.trimMat = Mats().trim();
    v.layers = [
      mesh(set.variant("paint"), v.paintMat, "body"),
      mesh(set.variant("trim"), v.trimMat, "trim", !low),
      mesh(set.variant("glass"), Mats().glass(), "glass", false),
    ];
    group.add(...v.layers);
    if (set.variant("roof")) {
      v.roofMat = Mats().roof(set.livery ? 0xffffff : hex, tier);
      group.add(mesh(set.variant("roof"), v.roofMat, "roof", !low));
    }
    v.seatX = set.driverX;
    addSteering(v, v.seatX, set.steerAt, true);
    addAxles(v, group, set);
    finish(v, set);
    Rig().car(v, set);
    return v;
  }

  /** Build a car (one of the five styles). */
  function buildCar(hex, o) {
    const low = Boolean(o.low);
    return F.VehicleParts.withDetail(low, () =>
      buildSet("car", hex, Cars().build(o.style, o.lhd, low, o.fuel), low),
    );
  }

  /** Build the lorry. */
  function buildLorry(hex, o) {
    const low = Boolean(o.low);
    return F.VehicleParts.withDetail(low, () =>
      buildSet("lorry", hex, Big().lorry(o.lhd, low), low),
    );
  }

  /**
   * Build the bus from its geometry set: body (paint), trim (lamps, cabin, signs), glass, the driver's wheel, its
   * two left doors (own meshes on pivots), wheels and rig.
   */
  function buildBus(hex, low) {
    return F.VehicleParts.withDetail(low, () => busParts(hex, low, Big().bus(low)));
  }

  /** The bus's meshes, wheels, doors and rig (inside buildBus's level of detail). */
  function busParts(hex, low, geo) {
    const group = new THREE.Group();
    group.name = "vehicle-bus";
    const v = record("bus", group, "bus");
    v.paintMat = Mats().paint(hex, low ? "low" : "hi");
    v.trimMat = Mats().trim();
    group.add(mesh(geo.body, v.paintMat, "body"), mesh(geo.trim, v.trimMat, "trim", false));
    group.add(mesh(geo.glass, Mats().glass(), "glass", false));
    v.seatX = geo.driverX;
    addSteering(v, v.seatX, geo.steerAt, false);
    addAxles(v, group, geo);
    finish(v, geo);
    const doors = geo.doors.map((d) => Big().doorRig(v, d, v.trimMat));
    Rig().fixed(v, { seats: geo.seats, exhaust: geo.exhaust, fuel: "diesel", doors });
    return v;
  }

  /** Build a two-wheeler: frame (paint), trim (lamps), the rear wheel and a turning front end, its rig. */
  function buildTwoWheel(kind, hex, geo, low) {
    const group = new THREE.Group();
    group.name = "vehicle-" + kind;
    const v = record(kind, group, kind);
    v.paintMat = Mats().paint(hex, low ? "low" : "hi");
    v.trimMat = Mats().trim();
    v.twoGeo = geo;
    v.trimMesh = mesh(geo.trimFor(0), v.trimMat, "trim", !low);
    group.add(mesh(geo.frame, v.paintMat, "frame"), v.trimMesh);
    addWheel(v, group, geo.rearWheel || geo.wheel, [0, geo.wheelY, geo.rearZ], false);
    const fork = new THREE.Group();
    fork.position.set(0, 0, geo.pivotZ);
    fork.add(mesh(geo.fork, v.trimMat, "fork", false));
    addWheel(v, fork, geo.wheel, [0, geo.wheelY, geo.frontZ - geo.pivotZ], false);
    group.add(fork);
    v.pivots.push(fork);
    v.contacts = [
      { fwd: geo.frontZ, lat: 0 },
      { fwd: geo.rearZ, lat: 0 },
    ];
    v.fork = { z: geo.pivotZ, reach: geo.frontZ - geo.pivotZ };
    v.foot = geo.foot;
    group.add(F.VehicleParts.blob(geo.foot.hw * 2 + 0.3, geo.foot.hl * 2 + 0.3));
    TW().rig(v, hex);
    return v;
  }

  /** Fade the roof of a car while somebody drives it (so the hero shows from above); the wheel and lamps wake. */
  function setOccupied(v, on) {
    v.occupied = Boolean(on);
    if (v.rig) v.rig.lights.setRunning(on);
    if (v.rig && !on) v.rig.lights.setBrake(false);
    v.lastBrake = undefined;
    Rig().occupy(v, on);
    if (v.rig && v.rig.kickstand) v.rig.kickstand(!on);
    const m = v.roofMat;
    if (!m) return;
    m.transparent = Boolean(on);
    m.opacity = on ? ROOF_FADE : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
  }

  /**
   * Make a vehicle of a kind in a body colour (a CSS / three hex), or null for an unknown kind.
   * @param {string} kind "car" | "bike" | "moto" | "lorry" | "bus"
   * @param {number} [hex] the body colour
   * @param {{style?:string, lhd?:boolean, low?:boolean, fuel?:string}} [opts] a car's body style, which side the
   *   driver sits, the low tier, "electric" for a car with no exhaust
   * @returns {{group:THREE.Group, kind:string, style:string, seatX:number, rig:object}|null}
   */
  function build(kind, hex, opts) {
    const o = opts || {};
    const low = Boolean(o.low);
    if (kind === "car") return buildCar(hex === undefined ? 0xd0453a : hex, o);
    if (kind === "lorry") return buildLorry(hex === undefined ? 0x2f5fa8 : hex, o);
    if (kind === "bus") return buildBus(hex === undefined ? 0xf2f4f0 : hex, low);
    if (kind === "bike")
      return buildTwoWheel(
        kind,
        hex === undefined ? 0x2f8f5b : hex,
        TW().bike(TW().basketFor(hex), low),
        low,
      );
    if (kind === "moto")
      return buildTwoWheel(kind, hex === undefined ? 0xd0453a : hex, TW().moto(low), low);
    return null;
  }

  /** Open the bus (or any vehicle's) doors by `open` (0 shut .. 1 open): kept for bus.js. */
  function setDoors(v, open) {
    if (v.rig) v.rig.doors.forEach((d) => d.open(open));
  }

  /**
   * A touch of suspension (AC-P11): `off` is how far the ground under each contact lies above (+) or below (-)
   * the plane the body sits on, in the order of `contacts` (car: front right, front left, rear right, rear
   * left). Each front wheel drops or lifts on its own, the rear axle tilts, so all four tyres touch a kerb.
   * Two-wheelers rest on both tyres already (two points always fit a plane).
   */
  function suspend(v, off) {
    if (!v.axle || !off || off.length !== 4) return;
    const c = (k) => Math.max(-0.12, Math.min(0.12, off[k] || 0));
    const r = v.wheelR;
    if (v.front) {
      v.front.position.y = r + (c(0) + c(1)) / 2;
      v.front.rotation.z = Math.atan2(c(1) - c(0), 2 * v.track);
    } else {
      v.pivots[0].position.y = r + c(0);
      v.pivots[1].position.y = r + c(1);
    }
    v.axle.position.y = r + (c(2) + c(3)) / 2;
    v.axle.rotation.z = Math.atan2(c(3) - c(2), 2 * v.track);
  }

  /** Roll the wheels by the distance travelled, turn the front end (steer > 0 = right), pedal, auto lamps. */
  function animate(v, dt, speed, steer) {
    v.rolled += (speed * dt) / (v.wheelR || WHEEL_R[v.kind]);
    v.wheels.forEach((w) => (w.rotation.x = v.rolled));
    const yaw = -steer * STEER_LOCK[v.kind];
    v.pivots.forEach((p) => (p.rotation.y = yaw));
    if (v.steering) v.steering.rotation.z = -steer * 1.4;
    if (v.fork) {
      // the front tyre swings round the head tube as it steers; keep its ground contact where it really is
      v.contacts[0].fwd = v.fork.z + v.fork.reach * Math.cos(yaw);
      v.contacts[0].lat = v.fork.reach * Math.sin(yaw);
    }
    if (v.rig && v.rig.pedals && Math.abs(speed) > 0.05) v.rig.pedals(v.rolled * 0.55);
    Rig().autoLights(v, dt, speed);
  }

  F.Vehicles = {
    build,
    animate,
    suspend,
    setDoors,
    setOccupied,
    SEAT,
    WHEEL_R,
    STYLES: () => Cars().STYLES,
  };
})((window.KQ = window.KQ || {}));
