/* Kampung Quest — POIs, interactables and the pedestrian walk graph (KQ.WorldParts.Nav).
   The graph runs along the centre of every sidewalk, over each zebra crossing, and out along
   hand-placed spurs to every POI. `facing` is a yaw (rotation.y) for a figure whose front is
   +Z: 0 faces south (+Z), π faces north (−Z), −π/2 faces west (−X, the qibla). */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const N = Math.PI;
  const W = -Math.PI / 2;
  const SW = 4.75; // sidewalk centre line offset

  /**
   * Spurs: polylines that start ON a sidewalk centre line. A point may carry a POI id
   * (third item) and a facing (fourth). Points shared between spurs merge into one node.
   */
  const SPURS = [
    [
      [26, -SW],
      [26, -10.5],
      [26, -19, "hawker", N],
      [26, -27.5, "stall_mee_soto", N],
    ],
    [
      [26, -27.5],
      [21.2, -27.5, "stall_nasi_lemak", N],
      [16.4, -27.5, "stall_prata", N],
    ],
    [
      [26, -27.5],
      [30.8, -27.5, "stall_drinks", N],
      [35.6, -27.5, "stall_satay", N],
    ],
    [
      [19, -SW],
      [19, -8, "recycling", N],
    ],
    [
      [46.5, -SW],
      [46.5, -10.5],
      [46.5, -14.0],
      [45.4, -14.7, "minimart", N],
    ],
    [
      [55, -SW],
      [55, -10.5],
      [55, -15],
      [54.8, -20.9, "barber", N],
    ],
    [
      [66.5, -SW],
      [66.5, -10.5],
      [66.5, -15.5],
      [63.5, -19.8, "clinic", N],
    ],
    [
      [41.7, -SW],
      [41.7, -30],
      [56, -36],
      [56, -41],
      [56, -42.8, "library", N],
    ],
    [
      [-SW, -31],
      [-10, -31],
      [-13, -31, "mosque_gate", W],
      [-20, -31],
      [-21.5, -47],
      [-23.75, -52.5],
      [-23.75, -53.6, "mosque_wudu", N],
    ],
    [
      [-20, -31],
      [-26, -30.8],
      [-30, -30.8],
      [-33.5, -30.8],
      [-45, -33, "mosque_hall", W],
    ],
    [
      [-37, -SW],
      [-38, -10],
      [-38, -18],
      [-38, -22.5, "mosque_hall_women", W],
    ],
    [
      [-37, SW],
      [-37, 15.5],
      [-36.6, 17.4],
      [-36.6, 22.4],
      [-40, 22.4, "home", N],
      [-46, 22.6, "block_a", 0],
    ],
    [
      [-36.6, 22.4],
      [-37, 25.5],
      [-37, 45.5],
      [-37, 47.2],
      [-40, 48.7, "block_b", 0],
    ],
    [
      [20, SW],
      [20, 6.9, "bus_stop", N],
    ],
    [
      [10, SW],
      [11, 12],
      [21.5, 13],
      [21.5, 21.5, "playground", 0],
    ],
    [
      [21.5, 21.5],
      [29, 19],
      [40, 19, "park", 0],
      [48.8, 17],
    ],
    [
      [48.8, SW],
      [48.8, 17],
      [48.8, 45],
      [48.5, 48.6, "block_c", N],
    ],
  ];

  /** Straight sidewalk centre lines (each split at every node that lies on it). */
  function sidewalkLines(L) {
    const h = L.half - 1.5;
    const lines = [];
    [-SW, SW].forEach((c) => {
      lines.push({ axis: "x", c, from: -h, to: h });
      lines.push({ axis: "z", c, from: -h, to: h });
    });
    return lines;
  }

  /** The walking graph: nodes, edges and an index so a point is only added once. */
  function Graph() {
    this.nodes = [];
    this.edges = [];
    this.index = new Map();
  }
  /** Get-or-create the node at (x, z). */
  Graph.prototype.node = function (x, z) {
    const key = `${x.toFixed(2)},${z.toFixed(2)}`;
    if (!this.index.has(key)) {
      this.index.set(key, this.nodes.length);
      this.nodes.push({ id: this.nodes.length, x, z });
    }
    return this.index.get(key);
  };
  /** Connect two nodes with an edge (never a node to itself). */
  Graph.prototype.link = function (a, b) {
    if (a !== b) this.edges.push([a, b]);
  };

  /** True if the node lies on the sidewalk line (and inside its extent). */
  function onLine(n, ln) {
    const along = ln.axis === "x" ? n.x : n.z;
    const across = ln.axis === "x" ? n.z : n.x;
    return Math.abs(across - ln.c) < 0.01 && along >= ln.from - 0.01 && along <= ln.to + 0.01;
  }

  /** Build the graph and collect POIs from the spurs. */
  function build(L) {
    const g = new Graph();
    const pois = {};
    L.crossings.forEach((c) => {
      const a = c.axis === "x" ? g.node(c.at, -SW) : g.node(-SW, c.at);
      const b = c.axis === "x" ? g.node(c.at, SW) : g.node(SW, c.at);
      g.link(a, b);
    });
    [-SW, SW].forEach((a) => [-SW, SW].forEach((b) => g.node(a, b)));
    [-L.half + 1.5, L.half - 1.5].forEach((e) =>
      [-SW, SW].forEach((c) => (g.node(e, c), g.node(c, e))),
    );
    SPURS.forEach((spur) => {
      let prev = -1;
      spur.forEach(([x, z, id, facing]) => {
        const n = g.node(x, z);
        if (prev >= 0) g.link(prev, n);
        prev = n;
        if (id)
          pois[id] = { pos: new THREE.Vector3(x, 0, z), facing: facing || 0, radius: 2.5, node: n };
      });
    });
    sidewalkLines(L).forEach((ln) => chain(g, ln));
    return { graph: { nodes: g.nodes, edges: dedupe(g.edges) }, pois };
  }
  /**
   * Join the nodes along one footpath line in order, but never across the junction (a zebra
   * crossing handles that).
   */
  function chain(g, ln) {
    const on = g.nodes.filter((n) => onLine(n, ln));
    on.sort((a, b) => (ln.axis === "x" ? a.x - b.x : a.z - b.z));
    for (let i = 1; i < on.length; i++) {
      const a = on[i - 1];
      const b = on[i];
      const mid = ln.axis === "x" ? (a.x + b.x) / 2 : (a.z + b.z) / 2;
      if (Math.abs(mid) < 3.5) continue; // never walk straight across the junction: use a zebra
      g.link(a.id, b.id);
    }
  }
  /** Drop duplicate edges whichever way round they were added. */
  function dedupe(edges) {
    const seen = new Set();
    return edges.filter(([a, b]) => {
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  P.Nav = { build, SPURS, SW };
})((window.KQ = window.KQ || {}));
