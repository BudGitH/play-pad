/* ============================================================================
 * FILE: vehicle-parts.js
 * PURPOSE: Kampung Quest — small geometry helpers shared by the vehicle models (F.VehicleParts): painted boxes,
 *          rods between two points, side-profile extrusions (a car body is drawn as its side view, with curves,
 *          and pushed out to its width, then squeezed so it narrows toward the nose, tail and roof), half rings
 *          (arch trims, mudguards), the wheels and the ground blob shadow. Every piece comes back painted
 *          (vertex colour, atlas white strip) so a whole vehicle merges into a handful of draw calls.
 *          Vehicle local frame: faces +z, left is +x, y up, the origin on the ground in the middle of the wheelbase.
 * BUSINESS CONTEXT: AC-R8 (realism round) and AC-P14 (playability round: better models, same draw budget),
 *   features/kampung-quest-playability/requirements.md.
 * DEPENDENCIES: KQ.Figures.Geo (geometry.js); THREE.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicles-all.spec.mjs (builds every vehicle through these helpers).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const PI = Math.PI;
  const UP = new THREE.Vector3(0, 1, 0);
  const TYRE = "#17181b";
  /**
   * Level of detail for the geometry built next (1 = full; the low quality tier builds its vehicles at about
   * 0.55, fewer segments on every curve, so a car stays near 8k triangles). Set with setDetail, read by seg().
   */
  const LOD = { k: 1 };

  /** A segment count scaled by the current level of detail, never below `min`. */
  const seg = (n, min) => Math.max(min || 3, Math.round(n * LOD.k));

  /** Build the next geometries at this level of detail (1 full, under 1 fewer segments); returns the old one. */
  function setDetail(k) {
    const old = LOD.k;
    LOD.k = Number.isFinite(k) ? Math.max(0.3, Math.min(1, k)) : 1;
    return old;
  }

  /** Paint a geometry one flat colour as it is (no sRGB conversion, to match the world's materials). */
  function paint(g, hex) {
    G.paint(g, "#ffffff");
    const c = new THREE.Color(hex).convertSRGBToLinear();
    const col = g.attributes.color;
    for (let i = 0; i < col.count; i += 1) col.setXYZ(i, c.r, c.g, c.b);
    return g;
  }

  /** A painted rounded box of size w, h, d centred on p, optionally turned (rx, ry, rz). */
  function block(w, h, d, p, hex, rot) {
    const r = Math.min(0.04, w / 3, h / 3, d / 3);
    const g = LOD.k < 0.7 ? new THREE.BoxGeometry(w, h, d) : G.roundedBox(w, h, d, r, 1);
    return G.place(paint(g, hex), p, rot || [0, 0, 0]);
  }

  /** A plain painted box (12 triangles) for tiny details where rounding would not show: plate letters, seams. */
  function box(w, h, d, p, hex) {
    return G.place(paint(new THREE.BoxGeometry(w, h, d), hex), p);
  }

  /** A painted cylinder (round rod) of radius r between two 3D points a and b. */
  function rod(a, b, r, hex, sides) {
    const from = new THREE.Vector3(a[0], a[1], a[2]);
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = paint(new THREE.CylinderGeometry(r, r, dir.length(), seg(sides || 8, 4), 1), hex);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
    g.translate(from.x + dir.x / 2, from.y + dir.y / 2, from.z + dir.z / 2);
    return g;
  }

  /** A chain of rods through 3D points (a bent tube: handlebars, a grab rail). */
  function tube(points, r, hex) {
    const out = [];
    for (let i = 1; i < points.length; i += 1) out.push(rod(points[i - 1], points[i], r, hex));
    return out;
  }

  /** A painted cylinder of radius r, length len, lying along an axis ("x" | "y" | "z"), centred on p. */
  function drum(axis, r, len, p, hex, sides) {
    const g = paint(new THREE.CylinderGeometry(r, r, len, seg(sides || 10, 6), 1), hex);
    if (axis === "x") g.rotateZ(PI / 2);
    if (axis === "z") g.rotateX(PI / 2);
    return g.translate(p[0], p[1], p[2]);
  }

  /**
   * A side view pushed out sideways. `points` are [z, y] pairs round the outline; the result is
   * `width` wide (x from -width/2 to width/2) with a small rounded bevel on every edge.
   */
  function sideSolid(points, width, hex, bevel) {
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p[0], p[1])));
    return sideShape(shape, width, hex, bevel, 4);
  }

  /**
   * Like sideSolid, from a THREE.Shape drawn with curves (quadraticCurveTo, absarc ...): the side view of a
   * curved car body or scooter cowl, `segs` points per curve.
   */
  function sideShape(shape, width, hex, bevel, segs, bevelSegs) {
    const b = bevel === undefined ? 0.04 : bevel;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: width - 2 * b,
      bevelEnabled: true,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: seg(bevelSegs || 2, 1),
      curveSegments: seg(segs || 6, 3),
    });
    g.translate(0, 0, -(width - 2 * b) / 2);
    g.rotateY(-PI / 2);
    return paint(g, hex);
  }

  /**
   * Squeeze a geometry sideways: every vertex's x is multiplied by k(y, z) (a body that narrows toward its
   * nose, tail and roof instead of being a slab). Normals are recomputed.
   */
  function squeeze(g, k) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i += 1) pos.setX(i, pos.getX(i) * k(pos.getY(i), pos.getZ(i)));
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }

  /** Area-weighted normal of each triangle of a non-indexed geometry, as a flat array (3 per face). */
  function faceNormals(pos) {
    const out = new Float32Array(pos.count);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let f = 0; f < pos.count / 3; f += 1) {
      a.fromBufferAttribute(pos, f * 3);
      b.fromBufferAttribute(pos, f * 3 + 1).sub(a);
      c.fromBufferAttribute(pos, f * 3 + 2).sub(a);
      b.cross(c);
      out[f * 3] = b.x;
      out[f * 3 + 1] = b.y;
      out[f * 3 + 2] = b.z;
    }
    return out;
  }

  /** The vertices of a geometry grouped by where they are (rounded to 0.1 mm). */
  function byPosition(pos) {
    const map = new Map();
    for (let i = 0; i < pos.count; i += 1) {
      const k = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => Math.round(v * 1e4)).join();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(i);
    }
    return map;
  }

  /** One vertex's normal: the sum of the normals of the faces round it that meet its own face gently. */
  function creased(fn, i, around, lim) {
    const f = Math.floor(i / 3) * 3;
    const len = Math.hypot(fn[f], fn[f + 1], fn[f + 2]) || 1;
    const sum = [0, 0, 0];
    around.forEach(function (j) {
      const g = Math.floor(j / 3) * 3;
      const dot = (fn[f] * fn[g] + fn[f + 1] * fn[g + 1] + fn[f + 2] * fn[g + 2]) / len;
      const glen = Math.hypot(fn[g], fn[g + 1], fn[g + 2]) || 1;
      if (dot / glen < lim) return;
      [0, 1, 2].forEach((k) => (sum[k] += fn[g + k]));
    });
    const s = Math.hypot(sum[0], sum[1], sum[2]) || 1;
    return sum.map((v) => v / s);
  }

  /**
   * Smooth shading with a crease angle (like a modelling package): normals are averaged across faces that
   * meet at less than `deg` degrees, so curved panels and bevels look moulded while sharp folds stay sharp.
   * Returns a non-indexed geometry (the same one when it already was).
   */
  function smoothed(g, deg) {
    const geo = g.index ? g.toNonIndexed() : g;
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const fn = faceNormals(pos);
    const lim = Math.cos(((deg || 50) * PI) / 180);
    byPosition(pos).forEach(function (list) {
      list.forEach(function (i) {
        const n = creased(fn, i, list, lim);
        nrm.setXYZ(i, n[0], n[1], n[2]);
      });
    });
    nrm.needsUpdate = true;
    return geo;
  }

  /** A painted ellipsoid (lamp lens, mirror shell, saddle, headlight cowl) of size w, h, d centred on p. */
  function lens(w, h, d, p, hex, rot, segs) {
    const n = seg(segs || 8, 6);
    const g = new THREE.SphereGeometry(0.5, n, Math.max(6, Math.round(n * 0.6)));
    return G.place(paint(g, hex), p, rot || [0, 0, 0], [w, h, d]);
  }

  /** A painted round tube of radius r swept smoothly through 3D points (handlebars, frame bends, an exhaust). */
  function bent(points, r, hex, segs) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    );
    return paint(new THREE.TubeGeometry(curve, seg(segs || 10, 4), r, seg(6, 4), false), hex);
  }

  /** 0 below a, 1 above b, a smooth S between. */
  function smooth(a, b, v) {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  /** Half a ring (the upper half of a thin torus in the y-z plane) of radius r round (y, z), at side x. */
  function halfRing(x, y, z, r, thick, hex) {
    const g = new THREE.TorusGeometry(r, thick, seg(5, 3), seg(14, 8), PI).rotateY(PI / 2);
    return paint(g, hex).translate(x, y, z);
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

  /**
   * Tag a geometry's material class (the aSkin attribute every painted piece carries; the vehicles' trim shader,
   * vehicle-mats.js, reads it): 0 matte plastic, 1 satin, 2 gloss black, 3 chrome / alloy, 4 rubber, 5 clear
   * lens; 10+ lamps that light up (see F.VehicleMats.CLS).
   */
  function tag(g, cls) {
    const a = g.attributes.aSkin;
    for (let i = 0; i < a.count; i += 1) a.setX(i, cls);
    return g;
  }

  /** A lathe about the x axis from [radius, x] pairs, painted and tagged. */
  function latheX(pairs, segs, hex, cls) {
    const g = G.lathe(pairs, seg(segs, 8)).rotateZ(-PI / 2);
    return tag(paint(g, hex), cls);
  }

  /** A tyre: tread, rounded shoulders and bulging sidewalls (a lathe), centred on x 0. */
  function tyre(r, w) {
    const h = w / 2;
    const prof = [0.7, -h * 0.78, 0.8, -h * 0.98, 0.93, -h * 0.97, 0.985, -h * 0.82, 1, -h * 0.55];
    const pairs = [];
    for (let i = 0; i < prof.length; i += 2) pairs.push(prof[i] * r, prof[i + 1]);
    for (let i = prof.length - 2; i >= 0; i -= 2) pairs.push(prof[i] * r, -prof[i + 1]);
    return latheX(pairs, 26, TYRE, 4);
  }

  /** Five twin spokes on the face toward side `s` (+1 / -1), dished from the hub out to the rim lip. */
  function spokes(r, w, s) {
    const out = [];
    const n = LOD.k < 0.7 ? 1 : 2;
    for (let i = 0; i < 5; i += 1) {
      for (let k = 0; k < n; k += 1) {
        const a = (i * 2 * PI) / 5 + (n > 1 ? (k - 0.5) * 0.2 : 0);
        const g = paint(new THREE.BoxGeometry(0.03, r * 0.5, 0.022), "#c9cdd3");
        G.taper(g, n > 1 ? 1 : 1.6, n > 1 ? 0.7 : 1.1, 1, 1, r * 0.5);
        g.translate(0, r * 0.42, 0);
        g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, s * 0.14, 0, 0, 0));
        out.push(tag(g.rotateX(a).translate(s * (w * 0.38 - r * 0.04), 0, 0), 1));
      }
    }
    return out;
  }

  /**
   * The pieces of one car wheel centred on x, its show face toward side `s`: a tyre with sidewalls, a dark rim
   * well, a bright alloy lip, five twin spokes and a centre cap (no badge).
   */
  function carWheelParts(r, width, x, s) {
    const h = width / 2;
    const rim = r * 0.7;
    const parts = [
      tyre(r, width),
      tag(drum("x", rim, width * 0.86, [0, 0, 0], "#30333a", 22), 1),
      latheX(
        [rim * 1.01, s * h * 0.8, rim * 0.95, s * h * 0.86, rim * 0.9, s * h * 0.8],
        22,
        "#dfe2e6",
        3,
      ),
      tag(drum("x", r * 0.15, width * 0.92, [0, 0, 0], "#c9ccd2", 10), 3),
      tag(drum("x", r * 0.07, width * 0.95, [0, 0, 0], "#26282d", 8), 2),
    ].concat(spokes(r, width, s));
    return parts.map((g) => g.translate(x, 0, 0));
  }

  /** A car wheel with its show face toward side s (+1 left, -1 right). */
  function carWheel(r, width, s) {
    return G.merge(carWheelParts(r, width, 0, s || 1));
  }

  /** Both wheels of an axle as one mesh (they roll together; the rear pair of a car is one draw call). */
  function carAxle(r, width, x) {
    return G.merge(carWheelParts(r, width, -x, -1).concat(carWheelParts(r, width, x, 1)));
  }

  /**
   * A bicycle wheel: a treaded tyre, a deep rim, a hub with flanges and 16 spokes laced from the two flanges
   * to alternate points of the rim (so they cross like a real wheel's).
   */
  function spokedWheel(r, thick, width) {
    const tyre = new THREE.TorusGeometry(r - thick, thick, seg(6, 4), seg(28, 14)).rotateY(PI / 2);
    const parts = [
      tag(G.place(paint(tyre, TYRE), [0, 0, 0], [0, 0, 0], [width / (2 * thick), 1, 1]), 4),
    ];
    const rimR = r - thick * 2;
    parts.push(
      tag(
        paint(new THREE.TorusGeometry(rimR, 0.012, 4, seg(28, 14)).rotateY(PI / 2), "#c4c8ce"),
        3,
      ),
    );
    parts.push(drum("x", 0.018, width * 1.6, [0, 0, 0], "#9aa0a8", 8));
    [-1, 1].forEach((s) => parts.push(drum("x", 0.03, 0.008, [s * 0.03, 0, 0], "#b8bdc4", 10)));
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * PI * 2;
      const s = i % 2 ? 1 : -1;
      const hub = [s * 0.03, Math.sin(a + 0.5) * 0.028, Math.cos(a + 0.5) * 0.028];
      parts.push(rod(hub, [0, Math.sin(a) * rimR, Math.cos(a) * rimR], 0.0035, "#dfe2e6", 3));
    }
    return G.merge(parts);
  }

  /** A scooter wheel: a round tyre, a body-grey hub disc with five spokes and a brake drum. */
  function scooterWheel(r, width) {
    const t = 0.075;
    const tyre = new THREE.TorusGeometry(r - t, t, 6, 20).rotateY(PI / 2);
    const parts = [G.place(paint(tyre, TYRE), [0, 0, 0], [0, 0, 0], [width / (2 * t), 1, 1])];
    parts.push(drum("x", r * 0.62, width * 0.8, [0, 0, 0], "#c4c8ce", 14));
    parts.push(drum("x", r * 0.38, width * 0.9, [0, 0, 0], "#5d6168", 12));
    parts.push(drum("x", r * 0.14, width * 0.98, [0, 0, 0], "#a7abb2", 8));
    [-1, 1].forEach((s) => parts.push(...crossBars(5, r * 1.1, 0.03, s * width * 0.4, "#d4d7dc")));
    return G.merge(parts);
  }

  /** The steering wheel: a thin ring, three spokes and a hub, facing the driver. */
  function steering() {
    const ring = new THREE.TorusGeometry(0.13, 0.018, seg(6, 4), seg(16, 10));
    const parts = [paint(ring, "#1f2024"), drum("z", 0.035, 0.03, [0, 0, 0], "#c9ccd2", 8)];
    [0, (2 * PI) / 3, (4 * PI) / 3].forEach((a) =>
      parts.push(rod([0, 0, 0], [Math.sin(a) * 0.12, -Math.cos(a) * 0.12, 0], 0.012, "#1f2024")),
    );
    return G.merge(parts);
  }

  /** A soft round shadow texture (drawn once; a canvas, so it works from file:// too). */
  function blobTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.6, "rgba(0,0,0,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  /**
   * The ground blob under a vehicle (w across, d along): a flat quad with the soft shadow, drawn just above
   * the ground so the tyres read as standing on it even where the sun's shadow does not reach. Shared material.
   */
  function blob(w, d) {
    if (!blob.mat) {
      blob.mat = new THREE.MeshBasicMaterial({
        map: blobTexture(),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-PI / 2), blob.mat);
    m.position.y = 0.012;
    m.name = "blob";
    m.renderOrder = 1;
    return m;
  }

  F.VehicleParts = {
    steering,
    setDetail,
    detail: () => LOD.k,
    paint,
    tag,
    latheX,
    block,
    box,
    rod,
    tube,
    drum,
    sideSolid,
    sideShape,
    squeeze,
    smoothed,
    lens,
    bent,
    smooth,
    halfRing,
    arch,
    carWheel,
    carAxle,
    spokedWheel,
    scooterWheel,
    blob,
  };
})((window.KQ = window.KQ || {}));
