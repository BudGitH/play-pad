/* ============================================================================
 * FILE: animal-loft.js
 * PURPOSE: Smooth toy volumes for the animals (KQ.Figures.AnimalLoft): a "loft" is a tube swept
 *          along a few control rings (centre, side radius, top radius, bottom radius), smoothed with
 *          a Catmull-Rom curve and given smooth normals, so a camel's body with its hump or a
 *          horse's arched neck is ONE soft surface instead of a pile of faceted blobs. The same
 *          frames give points ON that surface, so a saddle blanket, a halter band or an eye can
 *          be laid exactly on the skin (no floating blankets).
 * BUSINESS CONTEXT: owner feedback "improve the camel models ... it just looks not nice for the
 *   kids"; "the horse can be a little bit more polished". Friendly, rounded toy silhouettes.
 * CONVENTIONS: a ring's frame: t = along the curve, side = +x (curves live in the y-z plane, a
 *   little x offset is fine), up = t x side rotated (for a curve going +z "up" is +y; going down
 *   -y it is +z, i.e. a leg's "up" side is its front). Angle a = 0 on "up", +PI/2 on +x.
 * DEPENDENCIES: three.js only.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);

  /** Catmull-Rom of four numbers at u in [0, 1]. */
  function cr(a, b, c, d, u) {
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3)
    );
  }

  /** One control ring as a flat list [x, y, z, rx, up, dn, pinch]. */
  function flat(r) {
    return [r.p[0], r.p[1], r.p[2], r.rx, r.up || r.rx, r.dn || r.up || r.rx, r.pinch || 0];
  }

  /** Resample the control rings with `sub` rings per span (smooth Catmull-Rom). */
  function resample(ctrl, sub) {
    const v = ctrl.map(flat);
    const out = [];
    for (let i = 0; i < v.length - 1; i += 1) {
      const a = v[Math.max(0, i - 1)];
      const d = v[Math.min(v.length - 1, i + 2)];
      for (let s = 0; s < sub; s += 1)
        out.push(v[i].map((b, k) => cr(a[k], b, v[i + 1][k], d[k], s / sub)));
    }
    out.push(v[v.length - 1]);
    return out;
  }

  /** The frames of a loft: centre, up and side unit vectors and the radii of every ring. */
  function frames(ctrl, sub) {
    const r = resample(ctrl, sub || 3);
    const P = r.map((q) => new THREE.Vector3(q[0], q[1], q[2]));
    return r.map(function (q, i) {
      const t = P[Math.min(P.length - 1, i + 1)]
        .clone()
        .sub(P[Math.max(0, i - 1)])
        .normalize();
      const side = Math.abs(t.x) > 0.9 ? Y.clone() : X.clone();
      const up = new THREE.Vector3().crossVectors(t, side).normalize();
      side.crossVectors(up, t).normalize();
      return { p: P[i], t, up, side, rx: q[3], ru: q[4], rd: q[5], pinch: q[6] };
    });
  }

  /** Offset of the surface from a ring's centre at angle a (top pinched for a hump's ridge). */
  function offset(f, a, extra, out) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const ry = (c > 0 ? f.ru : f.rd) + extra;
    const pinch = c > 0 ? 1 - f.pinch * c * c : 1;
    return out
      .copy(f.up)
      .multiplyScalar(c * ry)
      .addScaledVector(f.side, s * (f.rx + extra) * pinch);
  }

  /** A point on (or `off` above) the loft's surface at u in [0, 1] along it and angle a. */
  function point(fr, u, a, off) {
    const x = Math.max(0, Math.min(1, u)) * (fr.length - 1);
    const i = Math.min(fr.length - 2, Math.floor(x));
    const k = x - i;
    const o0 = offset(fr[i], a, off || 0, new THREE.Vector3()).add(fr[i].p);
    const o1 = offset(fr[i + 1], a, off || 0, new THREE.Vector3()).add(fr[i + 1].p);
    return o0.lerp(o1, k);
  }

  /** Build an indexed grid geometry (rows x cols of points from at(i, j)), colour from col(i, j). */
  function grid(rows, cols, at, col, wrap) {
    const pos = [];
    const clr = [];
    const uv = [];
    const ix = [];
    for (let i = 0; i < rows; i += 1)
      for (let j = 0; j < cols; j += 1) {
        const p = at(i, j);
        const c = col(i, j);
        pos.push(p.x, p.y, p.z);
        clr.push(c.r, c.g, c.b);
        uv.push(j / (cols - 1), i / (rows - 1));
      }
    const cw = wrap ? cols : cols - 1;
    for (let i = 0; i < rows - 1; i += 1)
      for (let j = 0; j < cw; j += 1) {
        const a = i * cols + j;
        const b = i * cols + ((j + 1) % cols);
        ix.push(a, a + cols, b, b, a + cols, b + cols);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(clr, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    return g;
  }

  const colourOf = (c) => (c && c.isColor ? c : new THREE.Color(c));

  /**
   * A closed tube along the control rings: opts = { seg, sub, col(u, a) -> hex|Color }. Its two ends
   * are closed by shrinking the end rings to their centre (give the end rings small radii).
   */
  function tube(ctrl, opts) {
    const o = opts || {};
    const fr = frames(ctrl, o.sub || 3);
    const seg = o.seg || 12;
    const rows = fr.length + 2;
    const v = new THREE.Vector3();
    const at = function (i, j) {
      if (i === 0) return fr[0].p.clone();
      if (i === rows - 1) return fr[fr.length - 1].p.clone();
      const f = fr[i - 1];
      return offset(f, (j / seg) * Math.PI * 2, 0, v)
        .clone()
        .add(f.p);
    };
    const col = (i, j) => {
      const u = Math.max(0, Math.min(1, (i - 1) / (fr.length - 1)));
      return colourOf(o.col ? o.col(u, (j / seg) * Math.PI * 2) : 0xffffff);
    };
    const g = grid(rows, seg, at, col, true);
    g.userData.frames = fr;
    return g;
  }

  /**
   * A patch lying `off` above a loft's surface (a blanket, a saddle cloth): r = { u0, u1, a0, a1,
   * off, rows, cols }: u from u0 to u1 along it, angle a0 to a1 (0 = the top); col(k, a) colours
   * it (k = 0..1 along the patch). Normals point outward.
   */
  function shell(fr, r, col) {
    const rows = r.rows || 10;
    const cols = r.cols || 14;
    const ang = (j) => r.a0 + ((r.a1 - r.a0) * j) / (cols - 1);
    const at = (i, j) => point(fr, r.u0 + ((r.u1 - r.u0) * i) / (rows - 1), ang(j), r.off);
    const c = (i, j) => colourOf(col(i / (rows - 1), ang(j)));
    return grid(rows, cols, at, c, false);
  }

  /** A thin band right round a loft at u (a halter, a girth): width w along it, `off` above the skin. */
  function band(fr, u, w, off, hex, seg) {
    const n = seg || 12;
    const at = (i, j) => point(fr, u + (i - 0.5) * w, (j / n) * Math.PI * 2, off);
    return grid(2, n, at, () => colourOf(hex), true);
  }

  /** Blend two colours (hex) by k (0 = a, 1 = b). */
  function mix(a, b, k) {
    return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, k)));
  }

  /** Multiply a colour by a tint (hex) and return the hex. */
  function tint(hex, t) {
    return new THREE.Color(hex).multiply(new THREE.Color(t === undefined ? 0xffffff : t)).getHex();
  }

  /** Paint every vertex of a geometry one colour (a "color" attribute). */
  function paint(g, hex) {
    const c = colourOf(hex);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
    return g;
  }

  /** A smooth ellipsoid of radii r at p (seg = [around, down]), optionally turned by rot [x, y, z]. */
  function ball(r, p, hex, seg, rot) {
    const s = seg || [12, 8];
    const g = new THREE.SphereGeometry(1, s[0], s[1]).scale(r[0], r[1], r[2]);
    if (rot)
      g.rotateX(rot[0] || 0)
        .rotateY(rot[1] || 0)
        .rotateZ(rot[2] || 0);
    return paint(g.translate(p[0], p[1], p[2]), hex);
  }

  /** A round rope / strand of radius r through points (Vector3 or [x, y, z]), smooth. */
  function rope(pts, r, hex, seg) {
    const v = pts.map((q) => (q.isVector3 ? q : new THREE.Vector3(q[0], q[1], q[2])));
    const curve = new THREE.CatmullRomCurve3(v);
    return paint(new THREE.TubeGeometry(curve, seg || 8, r, 5, false), hex);
  }

  /** Index of the first frame at or past z (frames that run along +z, e.g. a body). */
  function uAtZ(fr, z) {
    for (let i = 1; i < fr.length; i += 1) {
      if (fr[i].p.z >= z) {
        const k = (z - fr[i - 1].p.z) / (fr[i].p.z - fr[i - 1].p.z || 1);
        return (i - 1 + k) / (fr.length - 1);
      }
    }
    return 1;
  }

  F.AnimalLoft = { frames, tube, shell, band, point, mix, tint, paint, ball, rope, uAtZ };
})((window.KQ = window.KQ || {}));
