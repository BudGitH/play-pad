/* ============================================================================
 * FILE: vehicle-parts.js
 * PURPOSE: Kampung Quest — small geometry helpers shared by the vehicle models (F.VehicleParts): painted boxes,
 *          rods between two points, side-profile extrusions (a car body is drawn as its side view and pushed out
 *          to its width) and the wheel. Every piece comes back painted (vertex colour, atlas white strip) so a
 *          whole vehicle merges into a handful of draw calls. Needs KQ.Figures.Geo (geometry.js).
 *          Vehicle local frame: faces +z, left is +x, y up, the origin on the ground in the middle of the wheelbase.
 * BUSINESS CONTEXT: AC-R8 (realism round, features/kampung-quest-realism/requirements.md): shared building blocks so each vehicle merges into a handful
 *   of draw calls (the vehicles share one white-strip atlas colour, tinted by material).
 * DEPENDENCIES: KQ.Figures.Geo (geometry.js); THREE.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicles-all.spec.mjs (builds every vehicle through these helpers).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const PI = Math.PI;
  const UP = new THREE.Vector3(0, 1, 0);

  /** Paint a geometry one flat colour as it is (no sRGB conversion, to match the world's materials). */
  function paint(g, hex) {
    G.paint(g, "#ffffff");
    const c = new THREE.Color(hex);
    const col = g.attributes.color;
    for (let i = 0; i < col.count; i += 1) col.setXYZ(i, c.r, c.g, c.b);
    return g;
  }

  /** A painted rounded box of size w, h, d centred on p, optionally turned (rx, ry, rz). */
  function block(w, h, d, p, hex, rot) {
    const r = Math.min(0.04, w / 3, h / 3, d / 3);
    return G.place(paint(G.roundedBox(w, h, d, r, 1), hex), p, rot || [0, 0, 0]);
  }

  /** A painted cylinder (round rod) of radius r between two 3D points a and b. */
  function rod(a, b, r, hex, sides) {
    const from = new THREE.Vector3(a[0], a[1], a[2]);
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = paint(new THREE.CylinderGeometry(r, r, dir.length(), sides || 6, 1), hex);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
    g.translate(from.x + dir.x / 2, from.y + dir.y / 2, from.z + dir.z / 2);
    return g;
  }

  /** A painted cylinder of radius r, length len, lying along an axis ("x" | "y" | "z"), centred on p. */
  function drum(axis, r, len, p, hex, sides) {
    const g = paint(new THREE.CylinderGeometry(r, r, len, sides || 10, 1), hex);
    if (axis === "x") g.rotateZ(PI / 2);
    if (axis === "z") g.rotateX(PI / 2);
    return g.translate(p[0], p[1], p[2]);
  }

  /**
   * A side view pushed out sideways. `points` are [z, y] pairs round the outline; the result is
   * `width` wide (x from -width/2 to width/2) with a small rounded bevel on every edge.
   */
  function sideSolid(points, width, hex, bevel) {
    const b = bevel === undefined ? 0.04 : bevel;
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: width - 2 * b,
      bevelEnabled: true,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 2,
      curveSegments: 4,
    });
    g.translate(0, 0, -(width - 2 * b) / 2);
    g.rotateY(-PI / 2);
    return paint(g, hex);
  }

  /** The arc a wheel arch cuts into the bottom edge: [z, y] points from the rear edge over the top to the front edge. */
  function arch(zc, yc, radius, steps) {
    const out = [];
    for (let i = 0; i <= steps; i += 1) {
      const a = PI - (PI * i) / steps;
      out.push([zc + radius * Math.cos(a), yc + radius * Math.sin(a)]);
    }
    return out;
  }

  /** Thin spoke or arm bars radiating from the axle of a wheel lying along x: `n` bars, each through the centre. */
  function crossBars(n, len, thick, x, hex) {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const g = paint(new THREE.BoxGeometry(thick, thick, len), hex);
      out.push(G.place(g, [x, 0, 0], [(i * PI) / n, 0, 0]));
    }
    return out;
  }

  /** A car wheel: a fat dark tyre, a pale rim, a hubcap and five dark spokes on each face. */
  function carWheel(r, width) {
    const tube = 0.1;
    const tyre = new THREE.TorusGeometry(r - tube, tube, 8, 20).rotateY(PI / 2);
    const parts = [
      G.place(paint(tyre, "#26272c"), [0, 0, 0], [0, 0, 0], [width / (2 * tube), 1, 1]),
    ];
    parts.push(drum("x", r * 0.66, width * 0.8, [0, 0, 0], "#c9ccd2", 14));
    parts.push(drum("x", r * 0.16, width * 0.9, [0, 0, 0], "#7d828a", 8));
    [-1, 1].forEach((s) =>
      parts.push(...crossBars(5, r * 1.18, 0.028, s * width * 0.41, "#6f747c")),
    );
    return G.merge(parts);
  }

  /** A bicycle wheel: a thin tyre, a rim, a hub and twelve fine spokes. */
  function spokedWheel(r, tube, width) {
    const tyre = new THREE.TorusGeometry(r - tube, tube, 6, 24).rotateY(PI / 2);
    const parts = [
      G.place(paint(tyre, "#26272c"), [0, 0, 0], [0, 0, 0], [width / (2 * tube), 1, 1]),
    ];
    const rim = new THREE.TorusGeometry(r - tube * 2, 0.008, 4, 24).rotateY(PI / 2);
    parts.push(paint(rim, "#b8bdc4"));
    parts.push(drum("x", 0.03, width * 0.9, [0, 0, 0], "#9aa0a8", 8));
    parts.push(...crossBars(6, (r - tube * 2) * 2, 0.007, 0, "#d4d7dc"));
    return G.merge(parts);
  }

  /** A scooter wheel: a round tyre, a body-grey hub disc with five spokes. */
  function scooterWheel(r, width) {
    const tube = 0.075;
    const tyre = new THREE.TorusGeometry(r - tube, tube, 8, 20).rotateY(PI / 2);
    const parts = [
      G.place(paint(tyre, "#26272c"), [0, 0, 0], [0, 0, 0], [width / (2 * tube), 1, 1]),
    ];
    parts.push(drum("x", r * 0.62, width * 0.8, [0, 0, 0], "#b8bdc4", 12));
    parts.push(drum("x", r * 0.2, width * 0.95, [0, 0, 0], "#6f747c", 8));
    [-1, 1].forEach((s) => parts.push(...crossBars(5, r * 1.1, 0.024, s * width * 0.4, "#7d828a")));
    return G.merge(parts);
  }

  /** The steering wheel: a thin ring and a hub, facing the driver. */
  function steering() {
    const ring = new THREE.TorusGeometry(0.13, 0.018, 6, 16);
    return G.merge([paint(ring, "#1f2024"), drum("z", 0.035, 0.03, [0, 0, 0], "#c9ccd2", 8)]);
  }

  F.VehicleParts = {
    steering,
    paint,
    block,
    rod,
    drum,
    sideSolid,
    arch,
    carWheel,
    spokedWheel,
    scooterWheel,
  };
})((window.KQ = window.KQ || {}));
