/* ============================================================================
 * FILE: holy-nav.js
 * PURPOSE: The walking and planning data of the Haramain world (KQ.Holy and
 *          KQ.WorldParts.HolyNav): the pedestrian walk graph (both cities, as two separate
 *          components), the per-city POI tables with the old kampung ids aliased to holy places,
 *          the interactables (wudu taps, prayer spots), the stand-spots every site teleports to
 *          (KQ.Holy.STAND), qibla (KQ.Holy.qiblaAt), vehicle spots and no-drive zones.
 * BUSINESS CONTEXT: AC-H1/H3/H5/H6. Other systems code against KQ.Holy: the ritual stepper uses
 *   goTo / qiblaAt / STAND, the vehicle system uses vehicleSpots / noDrive / inNoDrive.
 *   Yaw convention: 0 faces south (+z), PI faces north, PI/2 faces east (+x), -PI/2 west.
 * DEPENDENCIES: KQ.HOLY (js/data/holy-sites.js). The graph builder needs THREE (world layer).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const Holy = (KQ.Holy = KQ.Holy || {});
  const N = Math.PI;
  const RING_R = 30;

  /** Which city a world x belongs to (Madinah is the east half of the world). */
  function cityOf(x) {
    return x > 300 ? "madinah" : "makkah";
  }

  /** Yaw that faces from (ax, az) toward (bx, bz). */
  function yawTo(ax, az, bx, bz) {
    return Math.atan2(bx - ax, bz - az);
  }

  /**
   * The qibla direction from a world position: toward the Kaaba in Makkah, +z (south) in
   * Madinah. Returns a unit vector and the yaw that faces it.
   * @returns {{x:number, z:number, yaw:number}}
   */
  function qiblaAt(x, z) {
    if (cityOf(x) === "madinah") return { x: 0, z: 1, yaw: 0 };
    const d = Math.hypot(x, z);
    if (d < 0.5) return { x: 0, z: 1, yaw: 0 };
    return { x: -x / d, z: -z / d, yaw: yawTo(x, z, 0, 0) };
  }

  /** Stand spots: where `goTo(siteKey)` puts the hero ({x, z, yaw}; yaw faces the site or the way to go). */
  const STAND = {
    spawn: { x: 0, z: -95, yaw: 0 },
    kaaba: { x: 0, z: -17, yaw: 0 },
    blackStone: { x: 10.5, z: -11, yaw: yawTo(10.5, -11, 5, -6) },
    mataf: { x: 14, z: -14, yaw: yawTo(14, -14, 0, 0) },
    maqamIbrahim: { x: 4, z: -13, yaw: 0 },
    hijrIsmail: { x: -15, z: 0, yaw: N / 2 },
    zamzam: { x: -22, z: -21.5, yaw: N },
    safa: { x: 42, z: -39.2, yaw: 0 },
    marwa: { x: 42, z: 39.2, yaw: N },
    gate: { x: 0, z: -60, yaw: 0 },
    hairSalon: { x: 20, z: -79, yaw: N },
    clockTower: { x: 0, z: -112.5, yaw: N },
    miqat: { x: -60, z: -146, yaw: 0 },
    mina: { x: -180, z: -40, yaw: 0 },
    arafah: { x: -260, z: 32, yaw: 0 },
    muzdalifah: { x: -220, z: -10, yaw: 0 },
    jamarat: { x: -150, z: -80, yaw: 0 },
    nabawi: { x: 595, z: -24, yaw: 0 },
    greenDome: { x: 607, z: 25.5, yaw: N },
    rawdah: { x: 607, z: 18, yaw: 0 },
    mihrab: { x: 603.5, z: 27, yaw: 0 },
    minbar: { x: 600.2, z: 23.5, yaw: -N / 2 },
    salamWall: { x: 612, z: 25.6, yaw: N },
    quba: { x: 563, z: 120, yaw: 0 },
    uhud: { x: 600, z: -190, yaw: N },
    baqi: { x: 660, z: 10, yaw: -N / 2 },
    busStop: { x: 600, z: -92, yaw: 0 },
  };

  /** Where each city's hero stands to pray (the prayer flow locks the hero here) and faces qibla. */
  const HALL = {
    makkah: { x: 1.85, z: -36, heading: 0 },
    madinah: { x: 601, z: 12, heading: 0 },
  };

  /** Arrival spot of the bus per city (KQ.Holy.travel). */
  const ARRIVE = { makkah: STAND.spawn, madinah: STAND.busStop };

  /** Cars on the streets (lane centres) and bikes on the broad footways; heading is a yaw. */
  const vehicleSpots = [
    { x: -150, z: -103, heading: N / 2, kind: "car" },
    { x: -40, z: -109, heading: -N / 2, kind: "car" },
    { x: 40, z: -103, heading: N / 2, kind: "car" },
    { x: 100, z: -109, heading: -N / 2, kind: "car" },
    { x: 76.5, z: -40, heading: 0, kind: "car" },
    { x: 83.5, z: 30, heading: N, kind: "car" },
    { x: 0, z: 82, heading: N / 2, kind: "car" },
    { x: -60, z: 88, heading: -N / 2, kind: "car" },
    { x: -82, z: -20, heading: N, kind: "car" },
    { x: -88, z: 40, heading: 0, kind: "car" },
    { x: -63, z: -190, heading: 0, kind: "car" },
    { x: -230, z: 7, heading: N / 2, kind: "car" },
    { x: 20, z: -99.6, heading: N / 2, kind: "bike" },
    { x: -40, z: -115, heading: -N / 2, kind: "bike" },
    { x: 69.9, z: 20, heading: 0, kind: "bike" },
    { x: -76, z: 30, heading: N, kind: "bike" },
    { x: 560, z: -108, heading: N / 2, kind: "car" },
    { x: 640, z: -102, heading: -N / 2, kind: "car" },
    { x: 697, z: -20, heading: 0, kind: "car" },
    { x: 533, z: 30, heading: N, kind: "car" },
    { x: 620, z: 63, heading: N / 2, kind: "car" },
    { x: 560, z: 80, heading: 0, kind: "car" },
    { x: 580, z: -98.6, heading: N / 2, kind: "bike" },
    { x: 535.4, z: 10, heading: 0, kind: "bike" },
  ];

  const rect = (name, x0, z0, x1, z1) => ({ kind: "rect", name, x0, z0, x1, z1 });
  const disc = (name, x, z, r) => ({ kind: "circle", name, x, z, r });
  /** Places a vehicle must never enter: mosques, the mataf, the mas'a, plazas, holy sites. */
  const noDrive = [
    rect("Masjid al-Haram", -62, -60, 62, 60),
    disc("Mataf", 0, 0, 30),
    rect("Mas'a", 37, -46, 48, 46),
    rect("Gate plaza and forecourt", -36, -116, 36, -57),
    rect("Masjid Nabawi and courtyard", 545, -97, 655, 52),
    rect("Masjid Quba", 534, 98, 588, 142),
    rect("Baqi'", 640, -8, 680, 28),
    rect("Uhud viewpoint", 580, -202, 620, -178),
    disc("Mina", -180, -40, 30),
    disc("Jamarat", -150, -70, 24),
    disc("Jabal Rahmah", -260, 40, 22),
  ];

  /** Is (x, z) inside any no-drive zone (grown by `margin` metres)? */
  function inNoDrive(x, z, margin) {
    const m = margin || 0;
    return noDrive.some((n) =>
      n.kind === "circle"
        ? Math.hypot(x - n.x, z - n.z) < n.r + m
        : x > n.x0 - m && x < n.x1 + m && z > n.z0 - m && z < n.z1 + m,
    );
  }

  /** The anchor + stand lookup used by goTo: a STAND entry, else a KQ.HOLY anchor facing +z. */
  function standFor(key) {
    if (STAND[key]) return STAND[key];
    const H = KQ.HOLY;
    const a =
      (H.makkah && H.makkah[key]) || (H.hajj && H.hajj[key]) || (H.madinah && H.madinah[key]);
    return a && typeof a.x === "number" ? { x: a.x, z: a.z, yaw: 0 } : null;
  }

  Object.assign(Holy, {
    cityOf,
    qiblaAt,
    yawTo,
    STAND,
    HALL,
    ARRIVE,
    vehicleSpots,
    noDrive,
    inNoDrive,
    standFor,
  });

  /* ------------------------------ walk graph ------------------------------ */

  /** A grid of footpaths: a line along every x in `xs` through all the z in `zs`, and along every z through all the x. */
  function grid(xs, zs) {
    const lines = [];
    xs.forEach((x) => lines.push(zs.map((z) => [x, z])));
    zs.forEach((z) => lines.push(xs.map((x) => [x, z])));
    return lines;
  }

  /** The Nabawi courtyard grid: aisles midway between the umbrella poles, joined to the spine at x = 600. */
  function courtyardGrid() {
    const zs = [-77, -63, -49];
    const lines = grid([563, 577, 591, 605, 619, 633], zs);
    zs.forEach((z) =>
      lines.push(
        [
          [600, z],
          [605, z],
        ],
        [
          [600, z],
          [591, z],
        ],
      ),
    );
    return lines;
  }

  /** The Makkah plaza grid between the palms, joined to the gate spine at x = 0. */
  function plazaGrid() {
    const zs = [-90, -80, -72];
    const lines = grid([-24, -12, 12, 24], zs);
    zs.forEach((z) =>
      lines.push(
        [
          [0, z],
          [12, z],
        ],
        [
          [0, z],
          [-12, z],
        ],
      ),
    );
    return lines;
  }

  /** The fixed walk polylines of Makkah: [x, z, poiId?, facing?] (a shared point merges into one node). */
  const MAKKAH_FIXED = [
    [
      [0, -95, "forecourt", 0],
      [0, -98.25],
      [0, -113.75],
    ],
    [
      [0, -98.25],
      [0, -90],
      [0, -80],
      [0, -76],
      [0, -72],
      [0, -56, "gate", 0],
      [1.85, -50],
      [1.85, -44],
      [1.85, -36, "hall", 0],
      [0, -30],
    ],
    [
      [1.85, -36],
      [-8, -36, "hall_w", 0],
    ],
    [
      [RING_R, 0],
      [36, 3.14],
      [42, 3.14],
      [42, -38],
      [42, -39.2, "safa", 0],
    ],
    [
      [42, 3.14],
      [42, 38],
      [42, 39.2, "marwa", N],
    ],
    [
      [-25.98, 15],
      [-27, 30],
      [-27, 37],
      [-35.5, 37, "wudu", N],
    ],
    [
      [-25.98, -15],
      [-22, -21.5, "zamzam", N],
    ],
    [
      [-34, -95],
      [0, -95],
      [34, -95],
    ],
    [
      [0, -76],
      [20, -76],
      [20, -79, "salon", N],
    ],
    [
      [-77.25, -98.25],
      [-77.25, -113.75],
    ],
    [
      [71.25, -98.25],
      [71.25, -113.75],
    ],
    [
      [-60, -98.25],
      [-60, -113.75],
      [-60, -146, "miqat", 0],
    ],
    [
      [-180, -98.25],
      [-180, -113.75],
    ],
    [
      [71.25, -98.25],
      [71.25, -20],
      [71.25, 76.25],
      [-5, 76.25],
      [-77.25, 76.25],
      [-77.25, -20],
      [-77.25, -98.25],
    ],
    [
      [-150, -98.25],
      [-150, -80, "jamarat", 0],
    ],
    [
      [-180, -98.25],
      [-180, -40, "mina", 0],
      [-180, 2.25],
      [-220, 2.25],
      [-260, 2.25],
      [-260, 32, "arafah", 0],
    ],
    [
      [-220, 2.25],
      [-220, -10, "muzdalifah", 0],
    ],
  ];

  /** The tawaf ring, the two street footways and the fixed lines: every Makkah polyline. */
  function makkahLines() {
    const ring = [];
    for (let k = 0; k <= 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      ring.push([RING_R * Math.cos(a), -RING_R * Math.sin(a)]);
    }
    ring[12] = ring[0];
    ring[1] = [ring[1][0], ring[1][1], "mataf", yawTo(ring[1][0], ring[1][1], 0, 0)];
    const s1 = [-250, -180, -150, -77.25, -60, 0, 71.25, 118].map((x) => [x, -98.25]);
    const s2 = [-250, -180, -150, -77.25, -60, 0, 71.25, 118].map((x) => [x, -113.75]);
    s2[5] = [0, -113.75, "clock", N];
    return [ring, s1, s2].concat(MAKKAH_FIXED, plazaGrid());
  }

  /** The Madinah walk polylines (same format as Makkah's). */
  const MADINAH_LINES = [
    [
      [600, -112.75],
      [600, -97.25],
      [600, -90, "busStop", 0],
      [600, -77],
      [600, -63],
      [600, -60],
      [600, -49],
      [600, -33],
      [597, -33, "nabGate", 0],
      [595, -31],
      [595, -24],
      [601, -24],
      [601, 10],
      [601, 12, "nabHall", 0],
    ],
    [
      [601, 12],
      [593, 12, "nabHall_w", 0],
    ],
    [
      [601, 12],
      [601, 18],
      [607, 18, "rawdah", 0],
      [607, 25.5],
      [612, 25.5, "salam", N],
    ],
    [
      [607, 25.5],
      [603.5, 27, "mihrab", 0],
    ],
    [
      [601, 18],
      [601, 23.5],
      [600.2, 23.5, "minbar", -N / 2],
    ],
    [
      [597, -33.5],
      [578, -33.5, "nabWudu", N],
    ],
    [
      [600, -60],
      [552, -60],
      [536.75, -60],
      [536.75, 67.75],
      [565.75, 67.75],
      [565.75, 100],
      [563, 100],
      [563, 120, "quba", 0],
    ],
    [
      [600, -112.75],
      [600, -190, "uhud", N],
    ],
    [
      [600, -92],
      [643, -92],
      [643, 10],
      [660, 10, "baqi", -N / 2],
    ],
  ];

  /** Merge-by-position graph builder; returns { nodes, edges, pois } with pois keyed by id. */
  function graphFrom(lines) {
    const nodes = [];
    const edges = [];
    const index = new Map();
    const pois = {};
    const node = (x, z) => {
      const key = x.toFixed(2) + "," + z.toFixed(2);
      if (!index.has(key)) {
        index.set(key, nodes.length);
        nodes.push({ id: nodes.length, x, z });
      }
      return index.get(key);
    };
    lines.forEach((line) => {
      let prev = -1;
      line.forEach((pt) => {
        const n = node(pt[0], pt[1]);
        if (prev >= 0 && prev !== n) edges.push([prev, n]);
        prev = n;
        if (pt[2])
          pois[pt[2]] = {
            pos: new THREE.Vector3(pt[0], 0, pt[1]),
            facing: pt[3] || 0,
            radius: 2.5,
            node: n,
          };
      });
    });
    return { nodes, edges, pois };
  }

  /** Old kampung POI ids a city answers to, mapped onto its own holy places. */
  const ALIAS = {
    makkah: {
      home: "forecourt",
      hawker: "zamzam",
      mosque_gate: "gate",
      mosque_wudu: "wudu",
      mosque_hall: "hall",
      mosque_hall_women: "hall_w",
      park: "mataf",
      playground: "salon",
      library: "clock",
      bus_stop: "miqat",
      block_a: "forecourt",
      block_b: "forecourt",
      block_c: "forecourt",
      minimart: "salon",
      barber: "salon",
      clinic: "salon",
      recycling: "salon",
    },
    madinah: {
      home: "busStop",
      hawker: "busStop",
      mosque_gate: "nabGate",
      mosque_wudu: "nabWudu",
      mosque_hall: "nabHall",
      mosque_hall_women: "nabHall_w",
      park: "nabGate",
      playground: "busStop",
      library: "busStop",
      bus_stop: "busStop",
      block_a: "busStop",
      block_b: "busStop",
      block_c: "busStop",
      minimart: "busStop",
      barber: "busStop",
      clinic: "busStop",
      recycling: "busStop",
    },
  };
  const CITY_IDS = {
    makkah: [
      "forecourt",
      "gate",
      "hall",
      "hall_w",
      "wudu",
      "zamzam",
      "mataf",
      "safa",
      "marwa",
      "salon",
      "miqat",
      "mina",
      "arafah",
      "muzdalifah",
      "jamarat",
      "clock",
    ],
    madinah: [
      "busStop",
      "nabGate",
      "nabHall",
      "nabHall_w",
      "nabWudu",
      "rawdah",
      "mihrab",
      "minbar",
      "salam",
      "quba",
      "uhud",
      "baqi",
    ],
  };
  const HALL_RADIUS = { hall: 8, nabHall: 8, mataf: 12, gate: 5, nabGate: 5 };

  /** The POI table of one city: its own ids plus every kampung id aliased to a holy place. */
  function poisFor(all, city) {
    const out = {};
    CITY_IDS[city].forEach((id) => {
      out[id] = all[id];
      if (HALL_RADIUS[id]) out[id].radius = HALL_RADIUS[id];
    });
    Object.keys(ALIAS[city]).forEach((old) => (out[old] = all[ALIAS[city][old]]));
    return out;
  }

  /** The interactables of one city (ids the game already understands: wudu taps and prayer spots). */
  function interactablesFor(city) {
    const V = (x, z) => new THREE.Vector3(x, 0, z);
    const taps =
      city === "makkah"
        ? [-40.5, -36.9, -33.3, -29.7].map((x) => [x, 35.55])
        : [572.5, 576, 579.5, 583].map((x) => [x, -35.4]);
    const out = taps.map((t, i) => ({
      id: "wudu_tap_" + (i + 1),
      poi: "mosque_wudu",
      pos: V(t[0], t[1]),
      label: "Take wudu",
    }));
    const h = HALL[city];
    out.push({ id: "prayer_spot", poi: "mosque_hall", pos: V(h.x, h.z), label: "Pray" });
    out.push({ id: "prayer_spot_women", poi: "mosque_hall", pos: V(h.x - 8, h.z), label: "Pray" });
    return out;
  }

  /** Build the walk graph and per-city tables once for the world. */
  function build() {
    const g = graphFrom(makkahLines().concat(MADINAH_LINES, courtyardGrid()));
    return {
      graph: { nodes: g.nodes, edges: g.edges },
      pois: { makkah: poisFor(g.pois, "makkah"), madinah: poisFor(g.pois, "madinah") },
      interactables: { makkah: interactablesFor("makkah"), madinah: interactablesFor("madinah") },
    };
  }

  P.HolyNav = { build, RING_R };
})((window.KQ = window.KQ || {}));
