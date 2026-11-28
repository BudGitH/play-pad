/* ============================================================================
 * FILE: vehicle-loft.js
 * PURPOSE: Kampung Quest — the moulded-body maths of the vehicles (F.VehicleLoft). A body is described by
 *          functions, not boxes: a cross-section at every station along its length (two superellipse halves
 *          meeting at a waist: a rounded sill below, a crisp shoulder above, the sides leaning in) and a plan
 *          factor that rounds the nose and tail in plan view (a "squircle"). From that one description come:
 *            - loft(body, stations, ring, paint): the skin mesh, a grid of stations x ring angles, mirrored to
 *              both sides, vertex coloured per (station, ring) so shut lines, the dark underside and the sill
 *              are hard colour bands; every quad has an owner ("body", "door0" ...) so a door can be cut out;
 *            - inside(body, x, y, z): is a point inside the skin? (the single source of truth);
 *            - decal(body, nu, nv, ray, eps, hex, cls): a thin patch shot onto the skin along rays (lamps,
 *              grille, handles, seams follow the curved body exactly).
 *          Local frame: faces +z, left +x, y up.
 * BUSINESS CONTEXT: owner's realism pass ("cars are boxy; the front is angled and curved on a real car"),
 *   features/kampung-quest-playability/notes-vehicles.md, "Realism pass".
 * DEPENDENCIES: KQ.Figures.VehicleParts (vehicle-parts.js: paint, tag), THREE.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs tests/kampung-quest-vehicles-all.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = () => F.VehicleParts;

  /**
   * The point of the right half of the section at station `st` ({z, ...}), ring angle a (-PI/2 bottom middle,
   * 0 the waist, PI/2 top middle). body.sec(st) -> {b, t, m, hwLo, hwUp, nLo, nUp, tuck}; body.plan(z, y) 0..1.
   */
  function point(body, st, a) {
    const s = body.sec(st);
    const up = a >= 0;
    const n = up ? s.nUp : s.nLo;
    const k = Math.pow(Math.abs(Math.sin(a)), 2 / n);
    const y = up ? s.m + (s.t - s.m) * k : s.m - (s.m - s.b) * k;
    const hw = up ? s.hwUp - s.tuck * k : s.hwLo;
    const x = hw * Math.pow(Math.abs(Math.cos(a)), 2 / n) * body.plan(st.z, y);
    return [x, y, st.z - (body.shear ? body.shear(st.z, y) : 0)];
  }

  /** The station whose sheared section passes through (y, z) (a few fixed-point steps; exact without shear). */
  function stationOf(body, y, z) {
    if (!body.shear) return z;
    let s = z;
    for (let i = 0; i < 4; i += 1) s = z + body.shear(s, y);
    return s;
  }

  /** Is (x, y, z) inside the body's skin? */
  function inside(body, x, y, zw) {
    const z = stationOf(body, y, zw);
    if (z >= body.zf || z <= body.zr) return false;
    const s = body.sec({ z });
    if (y <= s.b || y >= s.t) return false;
    const up = y >= s.m;
    const k = up ? (y - s.m) / (s.t - s.m) : (s.m - y) / (s.m - s.b);
    const n = up ? s.nUp : s.nLo;
    const hw = up ? s.hwUp - s.tuck * k : s.hwLo;
    const lim = hw * Math.pow(Math.max(0, 1 - Math.pow(k, n)), 1 / n) * body.plan(z, y);
    return Math.abs(x) < lim;
  }

  /** The grid's vertices for one side (sx = 1 right... +x, -1 the mirror), with colours from paint(st, rg, y). */
  function sideVerts(body, stations, ring, sx, paint) {
    const pos = [];
    const col = [];
    const c = new THREE.Color();
    stations.forEach(function (st) {
      ring.forEach(function (rg) {
        const p = point(body, st, rg.a);
        pos.push(sx * p[0], p[1], p[2]);
        c.set(paint(st, rg, p[1]) || "#ffffff").convertSRGBToLinear();
        col.push(c.r, c.g, c.b);
      });
    });
    return { pos, col };
  }

  /** Two triangles per grid quad, wound outward on either side, grouped by the quad's owner. */
  function sideQuads(body, stations, ring, sx, base) {
    const n = ring.length;
    const by = {};
    for (let i = 0; i + 1 < stations.length; i += 1) {
      if (stations[i + 1].z - stations[i].z < 1e-6) continue;
      const zc = (stations[i].z + stations[i + 1].z) / 2;
      for (let j = 0; j + 1 < ring.length; j += 1) {
        if (ring[j + 1].a - ring[j].a < 1e-6) continue;
        const own = body.owner ? body.owner(zc, (ring[j].a + ring[j + 1].a) / 2, sx, i, j) : "body";
        const a = base + i * n + j;
        const q =
          sx > 0
            ? [a, a + 1, a + n, a + 1, a + n + 1, a + n]
            : [a, a + n, a + 1, a + 1, a + n, a + n + 1];
        (by[own] = by[own] || []).push(...q);
      }
    }
    return by;
  }

  /** Vertices on the centre line get a normal with no sideways part (the two mirrored halves meet without a crease). */
  function fixSeam(g) {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getX(i)) > 1e-5) continue;
      const v = new THREE.Vector3(0, nrm.getY(i), nrm.getZ(i)).normalize();
      nrm.setXYZ(i, v.x, v.y, v.z);
    }
  }

  /** A compact geometry of the triangles `idx` of a whole one (only the vertices they use). */
  function extract(whole, idx) {
    const map = new Map();
    const out = [];
    idx.forEach(function (i) {
      if (!map.has(i)) map.set(i, map.size);
      out.push(map.get(i));
    });
    const g = new THREE.BufferGeometry();
    Object.keys(whole.attributes).forEach(function (name) {
      const src = whole.attributes[name];
      const arr = new Float32Array(map.size * src.itemSize);
      map.forEach((to, from) => {
        for (let k = 0; k < src.itemSize; k += 1)
          arr[to * src.itemSize + k] = src.array[from * src.itemSize + k];
      });
      g.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
    });
    g.setIndex(out);
    return g;
  }

  /**
   * The skin: `stations` [{z, tag}] rear to front, `ring` [{a, tag}] bottom to top (right half), mirrored.
   * Returns {owner: BufferGeometry} (vertex coloured, painted like P.paint so it merges with the rest).
   */
  function loft(body, stations, ring, paint) {
    const R = sideVerts(body, stations, ring, 1, paint);
    const L = sideVerts(body, stations, ring, -1, paint);
    const half = R.pos.length / 3;
    const byR = sideQuads(body, stations, ring, 1, 0);
    const byL = sideQuads(body, stations, ring, -1, half);
    const whole = new THREE.BufferGeometry();
    whole.setAttribute("position", new THREE.Float32BufferAttribute(R.pos.concat(L.pos), 3));
    const all = [].concat(...Object.values(byR), ...Object.values(byL));
    whole.setIndex(all);
    whole.computeVertexNormals();
    fixSeam(whole);
    P().paint(whole, "#ffffff");
    whole.setAttribute("color", new THREE.Float32BufferAttribute(R.col.concat(L.col), 3));
    const out = {};
    [byR, byL].forEach((by) =>
      Object.keys(by).forEach((own) => (out[own] = (out[own] || []).concat(by[own]))),
    );
    Object.keys(out).forEach((own) => (out[own] = extract(whole, out[own])));
    return out;
  }

  /** Where a ray from o along d first enters the body (marched, then bisected), or null. */
  function hit(test, o, d, far) {
    const at = (t) => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    let t = 0;
    while (t < far && !test(...at(t))) t += 0.01;
    if (t >= far) return null;
    let lo = Math.max(0, t - 0.01);
    let hi = t;
    for (let k = 0; k < 14; k += 1) {
      const mid = (lo + hi) / 2;
      if (test(...at(mid))) hi = mid;
      else lo = mid;
    }
    return lo;
  }

  /** The decal's vertices: each (u, v) of an nu x nv grid shot along its ray, backed off `eps`; null on a miss. */
  function decalVerts(test, nu, nv, ray, eps) {
    const pts = [];
    for (let i = 0; i <= nu; i += 1) {
      for (let j = 0; j <= nv; j += 1) {
        const r = ray(i / nu, j / nv);
        const t = r ? hit(test, r[0], r[1], r[2] || 2.5) : null;
        pts.push(t === null ? null : r[0].map((v, k) => v + r[1][k] * (t - eps)));
      }
    }
    return pts;
  }

  /** Triangles of a grid of points, skipping any that touch a missing point. */
  function gridIndex(pts, nu, nv) {
    const idx = [];
    const w = nv + 1;
    for (let i = 0; i < nu; i += 1) {
      for (let j = 0; j < nv; j += 1) {
        const a = i * w + j;
        const q = [a, a + w, a + 1, a + 1, a + w, a + w + 1];
        if (q.every((k) => pts[k])) idx.push(...q);
      }
    }
    return idx;
  }

  /**
   * A thin patch on the body: `ray(u, v)` -> [origin, direction, far?] for u, v in 0..1; each grid point is
   * moved to where its ray meets the skin (`test(x, y, z)` = inside), backed off by eps, painted and tagged.
   * Faces outward (against the rays). Returns null when every ray missed.
   */
  function decal(test, nu, nv, ray, eps, hex, cls) {
    const pts = decalVerts(test, nu, nv, ray, eps);
    const idx = gridIndex(pts, nu, nv);
    if (!idx.length) return null;
    const flat = [];
    pts.forEach((p) => flat.push(...(p || [0, 0, 0])));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(flat, 3));
    const d = ray(0.5, 0.5)[1];
    g.setIndex(facing(flat, idx, d));
    g.computeVertexNormals();
    return P().tag(P().paint(g, hex), cls || 0);
  }

  /** The index list wound so its first triangle faces against direction d (i.e. outward). */
  function facing(flat, idx, d) {
    const v = (k) => new THREE.Vector3(flat[k * 3], flat[k * 3 + 1], flat[k * 3 + 2]);
    const a = v(idx[0]);
    const n = v(idx[1]).sub(a).cross(v(idx[2]).sub(a));
    if (n.x * d[0] + n.y * d[1] + n.z * d[2] <= 0) return idx;
    const out = [];
    for (let i = 0; i < idx.length; i += 3) out.push(idx[i], idx[i + 2], idx[i + 1]);
    return out;
  }

  /**
   * A smooth curve through [z, y] points (monotone cubic, no overshoot), as y(z); flat beyond the ends.
   * Points may come in any z order.
   */
  function curve(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0]);
    const n = p.length;
    const d = [];
    for (let i = 0; i + 1 < n; i += 1) d.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]));
    const m = p.map((_, i) => tangent(d, i, n));
    return function (z) {
      if (z <= p[0][0]) return p[0][1];
      if (z >= p[n - 1][0]) return p[n - 1][1];
      let i = 0;
      while (z > p[i + 1][0]) i += 1;
      return hermite(p[i], p[i + 1], m[i], m[i + 1], z);
    };
  }

  /** Fritsch-Carlson tangent at point i (0 at a turning point, so the curve never overshoots). */
  function tangent(d, i, n) {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    if (d[i - 1] * d[i] <= 0) return 0;
    return (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  }

  /** The cubic Hermite segment from a to b with tangents ma, mb, at z. */
  function hermite(a, b, ma, mb, z) {
    const h = b[0] - a[0];
    const t = (z - a[0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * a[1] +
      (t3 - 2 * t2 + t) * h * ma +
      (-2 * t3 + 3 * t2) * b[1] +
      (t3 - t2) * h * mb
    );
  }

  /**
   * Stations from rear to front: `n` spread by a superellipse so they bunch at the rounded ends, plus every
   * z in `extra` ({z, tag} or a number; a tagged z twice in a row is a hard seam).
   */
  function stations(zr, zf, n, extra, ends) {
    const out = [];
    const mid = (zf + zr) / 2;
    const half = (zf - zr) / 2;
    const m = ends || 4;
    const k = Math.max(3, Math.round(n / 4));
    for (let i = 0; i <= n - 2 * k; i += 1)
      out.push({ z: mid + half * 0.8 * (-1 + (2 * i) / (n - 2 * k)), tag: "" });
    for (let i = 0; i < k; i += 1) {
      const x = 1 - (i + 1) / k;
      const u = Math.pow(1 - Math.pow(x, m), 1 / m);
      out.push(
        { z: mid + half * Math.max(0.8, u), tag: "" },
        { z: mid - half * Math.max(0.8, u), tag: "" },
      );
    }
    (extra || []).forEach((e) => out.push(typeof e === "number" ? { z: e, tag: "" } : e));
    out.forEach((st) => (st.z = Math.max(zr, Math.min(zf, st.z))));
    out.sort((a, b) => a.z - b.z || (a.order || 0) - (b.order || 0));
    return out;
  }

  F.VehicleLoft = { point, inside, loft, decal, hit, curve, stations, extract };
})((window.KQ = window.KQ || {}));
