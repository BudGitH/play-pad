// Kampung Quest — the cars, bicycles and scooters the hero can drive and ride (AC-H6). The shapes come from
// vehicle-car-geo.js (five car styles) and vehicle-two-wheel-geo.js (bicycle, scooter); this file dresses them
// with materials, adds the wheels and the steering end, and animates them. Geometries and materials are cached
// and shared by every vehicle, so a car is 8 draw calls (body, trim, glass, lamps, steering wheel, 4 wheels), a
// bicycle 5 and a scooter 7. Local frame: the vehicle faces +z, its left is +x, the origin is on the ground in
// the middle of the wheelbase.
//   F.Vehicles.build(kind, colourHex, {style, lhd}) -> { group, kind, style, seatX, wheels, pivots, ... }
//   F.Vehicles.animate(v, dt, speed, steer)          wheels roll, the front end steers
//   F.Vehicles.SEAT[kind]                            where the hero sits (local y of the figure's origin, local z)
// kind: "car" | "bike" | "moto". A car's style is hatch | sedan | taxi | suv | mpv; `lhd` puts the driver on the left
// (Saudi Arabia drives on the right, Singapore on the left). The body / frame is painted white and tinted by the
// material colour, so one geometry serves every colour; everything else carries its own vertex colour.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const Cars = () => F.VehicleCars;
  const TW = () => F.VehicleTwoWheel;
  const WHEEL_R = { car: 0.3, bike: 0.28, moto: 0.24 };
  /** The figure's origin when seated: the seat top minus the drop to the thighs (see F.seatDrop), and its z. */
  const SEAT = { car: { y: 0.315, z: 0 }, bike: { y: 0.2, z: -0.1 }, moto: { y: 0.405, z: 0.1 } };
  /** The wheel's inset from the body's side. */
  const WHEEL_INSET = 0.17;
  const STEER_LOCK = { car: 0.5, bike: 0.35, moto: 0.4 };
  /** How see-through the roof is while the hero drives. */
  const ROOF_FADE = 0.22;
  const cache = {};

  /** The shared materials (the paint one is made per colour). */
  function mats() {
    if (cache.m) return cache.m;
    cache.m = {
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }),
      lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
      glass: new THREE.MeshStandardMaterial({
        color: 0x27394a,
        roughness: 0.06,
        metalness: 0.5,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    };
    return cache.m;
  }

  /** The shared wheel and steering-wheel geometries, built once. */
  function wheelGeos() {
    if (cache.w) return cache.w;
    const P = F.VehicleParts;
    cache.w = {
      steer: P.steering(),
      car: P.carWheel(WHEEL_R.car, 0.2),
    };
    return cache.w;
  }

  /** A mesh, casting a shadow unless told not to. */
  function mesh(geo, mat, name, shadow) {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = shadow !== false;
    return m;
  }

  /** The paint material for a body colour. */
  function paintMat(hex) {
    return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, metalness: 0.25 });
  }

  /** A fresh vehicle record around a group. */
  function record(kind, group, style) {
    return { group, kind, style, wheels: [], pivots: [], steering: null, rolled: 0, seatX: 0 };
  }

  /** Put one wheel on a group (a steering one sits in a pivot that turns). */
  function addWheel(v, parent, geo, at, steers) {
    const pivot = new THREE.Group();
    pivot.position.set(at[0], at[1], at[2]);
    // the body's shadow is enough; wheels would double the shadow pass
    pivot.add(mesh(geo, mats().trim, "wheel", false));
    parent.add(pivot);
    v.wheels.push(pivot.children[0]);
    if (steers) v.pivots.push(pivot);
  }

  /** The steering wheel, tilted toward the driver, on the driver's side. */
  function addSteering(v, x) {
    const tilt = new THREE.Group();
    tilt.position.set(x, 0.85, 0.27);
    tilt.rotation.x = 0.64;
    v.steering = mesh(wheelGeos().steer, mats().trim, "steering", false);
    tilt.add(v.steering);
    v.group.add(tilt);
  }

  /** Build a car: body, trim, glass, lamps, steering wheel and four wheels (the front pair steer). */
  function buildCar(hex, opts) {
    const geo = Cars().build(opts.style, opts.lhd);
    const m = mats();
    const group = new THREE.Group();
    group.name = "vehicle-car";
    group.add(mesh(geo.body, paintMat(hex), "body"), mesh(geo.trim, m.trim, "trim"));
    group.add(mesh(geo.glass, m.glass, "glass", false), mesh(geo.lamp, m.lamp, "lamps", false));
    const v = record("car", group, geo.style);
    v.roofMat = paintMat(hex);
    group.add(mesh(geo.roof, v.roofMat, "roof"));
    v.seatX = geo.driverX;
    addSteering(v, v.seatX);
    const x = geo.width / 2 - WHEEL_INSET;
    [-1, 1].forEach((s) =>
      geo.axles.forEach((z) => addWheel(v, group, wheelGeos().car, [s * x, 0.3, z], z > 0)),
    );
    return v;
  }

  /** Build a two-wheeler from its geometry set: frame, trim, (lamps), the rear wheel and a turning front end. */
  function buildTwoWheel(kind, hex, geo) {
    const m = mats();
    const group = new THREE.Group();
    group.name = "vehicle-" + kind;
    group.add(mesh(geo.frame, paintMat(hex), "frame"), mesh(geo.trim, m.trim, "trim"));
    if (geo.lamp) group.add(mesh(geo.lamp, m.lamp, "lamps", false));
    const v = record(kind, group, kind);
    addWheel(v, group, geo.wheel, [0, geo.wheelY, geo.rearZ], false);
    const fork = new THREE.Group();
    fork.position.set(0, 0, geo.pivotZ);
    fork.add(mesh(geo.fork, m.trim, "fork", false));
    addWheel(v, fork, geo.wheel, [0, geo.wheelY, 0], false);
    group.add(fork);
    v.pivots.push(fork);
    return v;
  }

  /** Fade the roof of a car while somebody drives it (so the hero shows from above); no-op for the rest. */
  function setOccupied(v, on) {
    const m = v.roofMat;
    if (!m) return;
    m.transparent = Boolean(on);
    m.opacity = on ? ROOF_FADE : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
  }

  /**
   * Make a vehicle of a kind in a body colour (a CSS / three hex), or null for an unknown kind.
   * @param {string} kind "car" | "bike" | "moto"
   * @param {number} [hex] the body colour
   * @param {{style?:string, lhd?:boolean}} [opts] a car's body style and which side the driver sits
   * @returns {{group:THREE.Group, kind:string, style:string, seatX:number}|null}
   */
  function build(kind, hex, opts) {
    const o = opts || {};
    if (kind === "car") return buildCar(hex === undefined ? 0xd0453a : hex, o);
    if (kind === "bike")
      return buildTwoWheel(kind, hex === undefined ? 0x2f8f5b : hex, TW().bike());
    if (kind === "moto")
      return buildTwoWheel(kind, hex === undefined ? 0xd0453a : hex, TW().moto());
    return null;
  }

  /** Roll the wheels by the distance travelled and turn the front end (steer > 0 = right). */
  function animate(v, dt, speed, steer) {
    v.rolled += (speed * dt) / WHEEL_R[v.kind];
    v.wheels.forEach((w) => (w.rotation.x = v.rolled));
    const yaw = -steer * STEER_LOCK[v.kind];
    v.pivots.forEach((p) => (p.rotation.y = yaw));
    if (v.steering) v.steering.rotation.z = -steer * 1.4;
  }

  F.Vehicles = { build, animate, setOccupied, SEAT, WHEEL_R, STYLES: () => Cars().STYLES };
})((window.KQ = window.KQ || {}));
