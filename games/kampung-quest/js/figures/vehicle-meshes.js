// Kampung Quest — the toy car and the bicycle the hero can drive and ride (AC-H6). Low-poly, built from a handful
// of merged geometries (cached, shared by every vehicle) so a car is 8 draw calls and a bicycle 5. Local frame:
// the vehicle faces +z, its left is +x, the origin is on the ground in the middle of the wheelbase.
//   F.Vehicles.build(kind, colourHex) -> { group, kind, spin, ... }   kind: "car" | "bike"
//   F.Vehicles.animate(v, dt, speed, steer)   wheels roll, the front end steers
//   F.Vehicles.SEAT[kind]                    where the hero sits (local y of the figure's origin, local z)
// Colours: the body / frame is painted white and tinted by the material colour, so one geometry serves every
// colour; everything else carries its own vertex colour. Needs KQ.Figures.Geo (geometry.js) for the helpers.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const PI = Math.PI;
  const WHEEL_R = { car: 0.3, bike: 0.2 };
  /** The figure's origin when seated: the seat top minus the drop to the thighs (see F.seatDrop), and its z. */
  const SEAT = { car: { y: 0.315, z: 0 }, bike: { y: 0.2, z: -0.1 } };
  const cache = {};

  /** Paint a geometry one flat colour as it is (no sRGB conversion, to match the world's materials). */
  function paint(g, hex) {
    G.paint(g, "#ffffff");
    const c = new THREE.Color(hex);
    const col = g.attributes.color;
    for (let i = 0; i < col.count; i += 1) col.setXYZ(i, c.r, c.g, c.b);
    return g;
  }

  /** A painted rounded box of size w, h, d centred on p (optionally turned about x by rx). */
  function block(w, h, d, p, hex, rx) {
    return G.place(paint(G.roundedBox(w, h, d, Math.min(0.05, w / 3, h / 3, d / 3), 1), hex), p, [
      rx || 0,
      0,
      0,
    ]);
  }

  /** A thin bar from a to b ([y, z] pairs in the centre plane), w thick. */
  function strut(a, b, w, hex) {
    const dy = b[0] - a[0];
    const dz = b[1] - a[1];
    const g = paint(new THREE.BoxGeometry(w, w, Math.hypot(dy, dz)), hex);
    return G.place(g, [0, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [-Math.atan2(dy, dz), 0, 0]);
  }

  /** The car's painted shell: floor, doors, hood, dash and rear deck, all open above the seat. */
  function carBody() {
    const W = "#ffffff";
    const parts = [block(1.2, 0.06, 2.8, [0, 0.31, 0], W)];
    [-1, 1].forEach((s) => parts.push(block(0.1, 0.46, 2.8, [s * 0.64, 0.53, 0], W)));
    parts.push(block(1.18, 0.24, 0.86, [0, 0.66, 0.97], W));
    parts.push(block(1.18, 0.34, 0.16, [0, 0.68, 0.46], W));
    parts.push(block(1.18, 0.34, 0.8, [0, 0.67, -1.0], W));
    return G.merge(parts);
  }

  /** The car's trim: bumpers, grille, lights, seat, windscreen frame (each with its own colour). */
  function carTrim() {
    const parts = [
      block(1.52, 0.14, 0.14, [0, 0.38, 1.42], "#2b2d33"),
      block(1.52, 0.14, 0.14, [0, 0.38, -1.42], "#2b2d33"),
      block(0.6, 0.1, 0.05, [0, 0.6, 1.4], "#222428"),
      block(0.8, 0.22, 0.56, [0, 0.45, -0.06], "#2e3a52"),
      block(0.8, 0.5, 0.1, [0, 0.8, -0.38], "#2e3a52"),
      block(1.2, 0.04, 0.04, [0, 1.18, 0.37], "#2b2d33", -0.42),
    ];
    [-1, 1].forEach((s) => {
      parts.push(block(0.24, 0.14, 0.08, [s * 0.46, 0.64, 1.4], "#fff3c4"));
      parts.push(block(0.24, 0.12, 0.06, [s * 0.5, 0.68, -1.4], "#e23b3b"));
      parts.push(block(0.04, 0.36, 0.04, [s * 0.6, 1.02, 0.44], "#2b2d33", -0.42));
    });
    return G.merge(parts);
  }

  /** The windscreen: one thin tilted pane. */
  function carGlass() {
    const g = new THREE.BoxGeometry(1.16, 0.36, 0.02);
    g.computeVertexNormals();
    return G.place(paint(g, "#ffffff"), [0, 1.02, 0.44], [-0.42, 0, 0]);
  }

  /** A wheel lying with its axle along x: a dark tyre, a pale hub and (for a bicycle) spokes. */
  function wheelGeo(r, tube, width, spokes) {
    const tyre = new THREE.TorusGeometry(r - tube, tube, 8, 18).rotateY(PI / 2);
    const parts = [G.place(paint(tyre, "#26272c"), [0, 0, 0], [0, 0, 0], [width / (2 * tube), 1, 1])];
    const rim = new THREE.CylinderGeometry(r * 0.62, r * 0.62, width * 0.7, 12).rotateZ(PI / 2);
    parts.push(paint(rim, spokes ? "#9aa0a8" : "#c9ccd2"));
    if (spokes) parts.push(...spokeBars(r));
    return G.merge(parts);
  }

  /** Three crossing pale spokes for a bicycle wheel. */
  function spokeBars(r) {
    return [0, 1, 2].map((i) => {
      const g = paint(new THREE.BoxGeometry(0.012, 0.012, (r - 0.04) * 2), "#d4d7dc");
      return G.place(g, [0, 0, 0], [(i * PI) / 3, 0, 0]);
    });
  }

  /** The steering wheel: a thin ring facing the driver. */
  function steerGeo() {
    const ring = new THREE.TorusGeometry(0.13, 0.018, 6, 16);
    return G.merge([paint(ring, "#1f2024"), paint(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8).rotateX(PI / 2), "#c9ccd2")]);
  }

  /** The bicycle frame (tinted): top, down and seat tubes, chain and seat stays. */
  function bikeFrame() {
    const W = "#ffffff";
    return G.merge([
      strut([0.22, 0], [0.42, -0.1], 0.03, W),
      strut([0.22, 0], [0.54, 0.27], 0.03, W),
      strut([0.42, -0.1], [0.56, 0.27], 0.03, W),
      strut([0.22, 0], [0.2, -0.42], 0.024, W),
      strut([0.42, -0.1], [0.2, -0.42], 0.024, W),
    ]);
  }

  /** The bicycle's dark bits: saddle, rear rack, cranks and the bell. */
  function bikeTrim() {
    return G.merge([
      block(0.14, 0.05, 0.28, [0, 0.44, -0.12], "#2b2d33"),
      block(0.3, 0.03, 0.22, [0, 0.4, -0.52], "#2b2d33"),
      block(0.06, 0.06, 0.06, [0, 0.22, 0], "#2b2d33"),
      block(0.07, 0.07, 0.07, [0.12, 0.66, 0.25], "#f2c230"),
      block(0.1, 0.1, 0.06, [0, 0.52, 0.5], "#fff3c4"),
    ]);
  }

  /** The bicycle's steering end, local to the front hub: fork, handlebar and grips. */
  function bikeFork() {
    return G.merge([
      strut([0.2, 0], [0.6, -0.16], 0.026, "#9aa0a8"),
      block(0.44, 0.03, 0.03, [0, 0.62, -0.17], "#2b2d33"),
      block(0.08, 0.045, 0.045, [-0.22, 0.62, -0.17], "#d7232c"),
      block(0.08, 0.045, 0.045, [0.22, 0.62, -0.17], "#d7232c"),
    ]);
  }

  /** The shared geometries, built once. */
  function geos() {
    if (cache.g) return cache.g;
    cache.g = {
      carBody: carBody(),
      carTrim: carTrim(),
      carGlass: carGlass(),
      carWheel: wheelGeo(0.3, 0.1, 0.2, false),
      steer: steerGeo(),
      bikeFrame: bikeFrame(),
      bikeTrim: bikeTrim(),
      bikeFork: bikeFork(),
      bikeWheel: wheelGeo(0.2, 0.03, 0.06, true),
    };
    return cache.g;
  }

  /** The shared materials (the body one is made per colour). */
  function mats() {
    if (cache.m) return cache.m;
    cache.m = {
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }),
      glass: new THREE.MeshStandardMaterial({
        color: 0xbfe3f2,
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    };
    return cache.m;
  }

  /** A mesh that casts a shadow. */
  function mesh(geo, mat, name) {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    return m;
  }

  /** The paint material for a body colour. */
  function paintMat(hex) {
    return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, metalness: 0.25 });
  }

  /** Build a car: shell, trim, windscreen, steering wheel and four wheels (the front pair steer). */
  function buildCar(hex) {
    const g = geos();
    const m = mats();
    const group = new THREE.Group();
    group.name = "vehicle-car";
    group.add(mesh(g.carBody, paintMat(hex), "body"), mesh(g.carTrim, m.trim, "trim"));
    const glass = new THREE.Mesh(g.carGlass, m.glass);
    glass.name = "glass";
    group.add(glass);
    const tilt = new THREE.Group();
    tilt.position.set(0, 0.85, 0.27);
    tilt.rotation.x = 0.64;
    const wheel = mesh(g.steer, m.trim, "steering");
    tilt.add(wheel);
    group.add(tilt);
    const v = { group, kind: "car", wheels: [], pivots: [], steering: wheel, rolled: 0 };
    [-1, 1].forEach((s) =>
      [-1, 1].forEach((f) => addWheel(v, g.carWheel, m.trim, [s * 0.7, 0.3, f * 0.88], f > 0)),
    );
    return v;
  }

  /** Put one wheel on a vehicle (a steering one sits in a pivot that turns). */
  function addWheel(v, geo, mat, at, steers) {
    const pivot = new THREE.Group();
    pivot.position.set(at[0], at[1], at[2]);
    const w = mesh(geo, mat, "wheel");
    pivot.add(w);
    v.group.add(pivot);
    v.wheels.push(w);
    if (steers) v.pivots.push(pivot);
  }

  /** Build a bicycle: frame, saddle, two spoked wheels and a fork that turns with the front wheel. */
  function buildBike(hex) {
    const g = geos();
    const m = mats();
    const group = new THREE.Group();
    group.name = "vehicle-bike";
    group.add(mesh(g.bikeFrame, paintMat(hex), "frame"), mesh(g.bikeTrim, m.trim, "trim"));
    const v = { group, kind: "bike", wheels: [], pivots: [], steering: null, rolled: 0 };
    addWheel(v, g.bikeWheel, m.trim, [0, 0.2, -0.42], false);
    const fork = new THREE.Group();
    fork.position.set(0, 0, 0.42);
    fork.add(mesh(g.bikeFork, m.trim, "fork"));
    const front = mesh(g.bikeWheel, m.trim, "wheel");
    front.position.set(0, 0.2, 0);
    fork.add(front);
    group.add(fork);
    v.wheels.push(front);
    v.pivots.push(fork);
    return v;
  }

  /**
   * Make a vehicle of a kind in a body colour (a CSS / three hex), or null for an unknown kind.
   * @returns {{group:THREE.Group, kind:string}|null}
   */
  function build(kind, hex) {
    if (kind === "car") return buildCar(hex === undefined ? 0xd0453a : hex);
    if (kind === "bike") return buildBike(hex === undefined ? 0x2f8f5b : hex);
    return null;
  }

  /** Roll the wheels by the distance travelled and turn the front end (steer > 0 = right). */
  function animate(v, dt, speed, steer) {
    v.rolled += (speed * dt) / WHEEL_R[v.kind];
    v.wheels.forEach((w) => (w.rotation.x = v.rolled));
    const yaw = -steer * (v.kind === "car" ? 0.5 : 0.35);
    v.pivots.forEach((p) => (p.rotation.y = yaw));
    if (v.steering) v.steering.rotation.z = -steer * 1.4;
  }

  F.Vehicles = { build, animate, SEAT, WHEEL_R };
})((window.KQ = window.KQ || {}));
