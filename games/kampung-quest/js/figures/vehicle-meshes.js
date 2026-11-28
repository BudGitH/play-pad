// Kampung Quest — the cars, bicycles and scooters the hero can drive and ride (AC-H6). The shapes come from
// vehicle-car-geo.js (five car styles) and vehicle-two-wheel-geo.js (bicycle, scooter); this file dresses them
// with materials, adds the wheels and the steering end, and animates them. Geometries and materials are cached
// and shared by every vehicle, so a car is 10 draw calls (body, roof, trim, glass, lamps, steering wheel, two front
// wheels, the rear axle's pair of wheels, the ground blob), a bicycle 6 and a scooter 7. Each record also carries
// `contacts` (where the tyres touch the ground, {fwd, lat}, for Sim.Vehicle.groundPose: AC-P11) and `foot` (the
// body's footprint {mid, hl, hw}, the parked collider: AC-P12). Local frame: the vehicle faces +z, its left is +x, the origin is on the ground in
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
  const Big = () => F.VehicleBig;
  const WHEEL_R = { car: 0.3, bike: 0.28, moto: 0.24, lorry: 0.38, bus: 0.48 };
  /** The figure's origin when seated: the seat top minus the drop to the thighs (see F.seatDrop), and its z. */
  const SEAT = {
    car: { y: 0.315, z: 0 },
    bike: { y: 0.2, z: -0.1 },
    moto: { y: 0.405, z: 0.1 },
    lorry: { y: 0.705, z: 1.72 },
  };
  /** The wheel's inset from the body's side. */
  const WHEEL_INSET = 0.17;
  const STEER_LOCK = { car: 0.5, bike: 0.35, moto: 0.4, lorry: 0.45, bus: 0.3 };
  /** Tyre widths of the four-wheelers. */
  const TYRE_W = { car: 0.2, lorry: 0.26, bus: 0.3 };
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
      axles: {},
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
    return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.3, metalness: 0.2 });
  }

  /** The pair of wheels of an axle as one mesh (cached per radius, width and track). */
  function axleGeo(x, r, width) {
    const w = wheelGeos();
    const key = [x, r, width, F.VehicleParts.detail()].map((n) => n.toFixed(3)).join();
    if (!w.axles[key]) w.axles[key] = F.VehicleParts.carAxle(r, width, x);
    return w.axles[key];
  }

  /** One wheel of a four-wheeler (cached per radius and width). */
  function wheelGeo(r, width) {
    const w = wheelGeos();
    const key = "w" + [r, width, F.VehicleParts.detail()].map((n) => n.toFixed(3)).join();
    if (!w.axles[key]) w.axles[key] = F.VehicleParts.carWheel(r, width);
    return w.axles[key];
  }

  /** The shared blob shadow plane of a footprint (cached by size). */
  function blobFor(w, d) {
    return F.VehicleParts.blob(w, d);
  }

  /** A fresh vehicle record around a group. */
  function record(kind, group, style) {
    const v = { group, kind, style, wheels: [], pivots: [], steering: null, rolled: 0, seatX: 0 };
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
    pivot.add(mesh(geo, mats().trim, "wheel", false));
    parent.add(pivot);
    v.wheels.push(pivot.children[0]);
    if (steers) v.pivots.push(pivot);
    // where each tyre touches the ground, in the pivot's frame (an axle mesh has a tyre on each side)
    (sides || [0]).forEach((x) => v.feet.push({ pivot, at: [x, -at[1], 0] }));
    return pivot;
  }

  /** The steering wheel, tilted toward the driver, on the driver's side (`at` = [y, z], a car's by default). */
  function addSteering(v, x, at) {
    const tilt = new THREE.Group();
    tilt.position.set(x, at ? at[0] : 0.85, at ? at[1] : 0.27);
    tilt.rotation.x = 0.64;
    v.steering = mesh(wheelGeos().steer, mats().trim, "steering", false);
    tilt.add(v.steering);
    v.group.add(tilt);
  }

  /** Build a car (one of the five styles). */
  function buildCar(hex, opts) {
    const low = Boolean(opts.low);
    const old = F.VehicleParts.setDetail(low ? 0.55 : 1);
    const v = buildFourWheel("car", hex, Cars().build(opts.style, opts.lhd, low), low);
    F.VehicleParts.setDetail(old);
    return v;
  }

  /** The body's material: the paint colour, or white over the baked two-tone livery of a taxi. */
  function bodyMat(hex, geo) {
    if (!geo.livery) return paintMat(hex);
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.2,
    });
  }

  /**
   * Build a four-wheeler from its geometry set: body (painted), trim, glass, lamps, an optional roof (it fades
   * while the hero drives), the steering wheel when it has a driver's seat, and the wheels.
   */
  function buildFourWheel(kind, hex, geo, low) {
    const m = mats();
    const group = new THREE.Group();
    group.name = "vehicle-" + kind;
    // on the low tier only the body casts a shadow (the trim's would cost a shadow-pass call per car)
    group.add(mesh(geo.body, bodyMat(hex, geo), "body"));
    group.add(mesh(geo.trim, m.trim, "trim", !geo.lean && !low));
    if (geo.glass) group.add(mesh(geo.glass, m.glass, "glass", false));
    if (geo.lamp) group.add(mesh(geo.lamp, m.lamp, "lamps", false));
    const v = record(kind, group, geo.style || kind);
    if (geo.roof) {
      v.roofMat = paintMat(geo.livery ? geo.livery.upper : hex);
      group.add(mesh(geo.roof, v.roofMat, "roof", !low));
    }
    if (geo.driverX !== undefined) {
      v.seatX = geo.driverX;
      addSteering(v, v.seatX, geo.steerAt);
    }
    addAxles(v, group, geo);
    v.foot = { mid: geo.mid, hl: geo.length / 2 + 0.02, hw: geo.width / 2 + 0.01 };
    if (!geo.lean) group.add(blobFor(geo.width + 0.5, geo.length + 0.5));
    return v;
  }

  /** The wheels: the front pair steer on their own pivots (a bus's front axle is one mesh), the rear axle is one mesh. */
  function addAxles(v, group, geo) {
    const r = geo.wheelR || WHEEL_R.car;
    const tw = TYRE_W[v.kind] || 0.2;
    const x = geo.width / 2 - (geo.inset || WHEEL_INSET);
    const [front, rear] = geo.axles;
    v.wheelR = r;
    v.track = x;
    if (v.kind === "bus")
      v.front = addWheel(v, group, axleGeo(x, r, tw), [0, r, front], false, [-x, x]);
    else [-1, 1].forEach((s) => addWheel(v, group, wheelGeo(r, tw), [s * x, r, front], true));
    v.axle = addWheel(v, group, axleGeo(x, r, tw), [0, r, rear], false, [-x, x]);
    v.contacts = [front, rear].flatMap((z) => [-1, 1].map((s) => ({ fwd: z, lat: s * x })));
  }

  /** The destination sign's canvas: "Kampung 21" in amber on black (drawn once). */
  function signTexture() {
    if (cache.sign) return cache.sign;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 48;
    const x = c.getContext("2d");
    x.fillStyle = "#111";
    x.fillRect(0, 0, 256, 48);
    x.fillStyle = "#ffb627";
    x.font = "bold 25px sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("Kampung 21", 128, 25);
    cache.sign = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) });
    return cache.sign;
  }

  /** Build the town bus: the four-wheeler plus its two left-side doors and its destination signs. */
  function buildBus(hex) {
    const geo = Big().bus();
    const v = buildFourWheel("bus", hex, geo);
    const doors = mesh(geo.door, mats().trim, "door", false);
    doors.position.set(geo.doorX, 0, 0);
    v.group.add(doors);
    v.doors = [{ mesh: doors, z: 0 }];
    v.doorSlide = geo.doorSlide;
    v.doorX = geo.doorX;
    v.group.add(mesh(geo.signs, signTexture(), "sign", false));
    return v;
  }

  /** Open the bus doors by `open` (0 shut .. 1 open): each plug door steps out and slides back. */
  function setDoors(v, open) {
    if (!v.doors) return;
    const t = Math.max(0, Math.min(1, open));
    v.doors.forEach(function (d) {
      d.mesh.position.x = v.doorX + Math.min(t * 3, 1) * 0.07;
      d.mesh.position.z = d.z - t * v.doorSlide;
    });
  }

  /** Build a two-wheeler from its geometry set: frame, trim, (lamps), the rear wheel and a turning front end. */
  function buildTwoWheel(kind, hex, geo, low) {
    const m = mats();
    const group = new THREE.Group();
    group.name = "vehicle-" + kind;
    group.add(mesh(geo.frame, paintMat(hex), "frame"), mesh(geo.trim, m.trim, "trim", !low));
    if (geo.lamp) group.add(mesh(geo.lamp, m.lamp, "lamps", false));
    const v = record(kind, group, kind);
    addWheel(v, group, geo.wheel, [0, geo.wheelY, geo.rearZ], false);
    const fork = new THREE.Group();
    fork.position.set(0, 0, geo.pivotZ);
    fork.add(mesh(geo.fork, m.trim, "fork", false));
    addWheel(v, fork, geo.wheel, [0, geo.wheelY, geo.frontZ - geo.pivotZ], false);
    group.add(fork);
    v.pivots.push(fork);
    v.contacts = [
      { fwd: geo.frontZ, lat: 0 },
      { fwd: geo.rearZ, lat: 0 },
    ];
    v.fork = { z: geo.pivotZ, reach: geo.frontZ - geo.pivotZ };
    v.foot = geo.foot;
    group.add(blobFor(geo.foot.hw * 2 + 0.3, geo.foot.hl * 2 + 0.3));
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
    if (kind === "lorry")
      return buildFourWheel(kind, hex === undefined ? 0x2f5fa8 : hex, Big().lorry(o.lhd), o.low);
    if (kind === "bus") return buildBus(hex === undefined ? 0xf2f4f0 : hex);
    if (kind === "bike")
      return buildTwoWheel(kind, hex === undefined ? 0x2f8f5b : hex, TW().bike(), o.low);
    if (kind === "moto")
      return buildTwoWheel(kind, hex === undefined ? 0xd0453a : hex, TW().moto(), o.low);
    return null;
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

  /** Roll the wheels by the distance travelled and turn the front end (steer > 0 = right). */
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
