// Kampung Quest — geometry helpers for the toy figures: bevelled (rounded) boxes, tapers, lathes,
// vertex-colour "painting" and a small indexed merge so each rigid part is one draw call.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = (F.Geo = {});

  /** Map a unit-box grid coordinate to { core offset sign/fraction, rounding fraction } for one axis. */
  function axisMap(c, n, k, half, r) {
    const i = Math.round((c + 0.5) * n);
    const core = half - r;
    if (i <= k) return { p: -core, f: -(k - i) / k };
    if (i >= n - k) return { p: core, f: (i - (n - k)) / k };
    return { p: -core + ((i - k) / (n - 2 * k)) * 2 * core, f: 0 };
  }

  /**
   * A box with rounded (bevelled) edges, like a moulded part.
   * @param {number} w width (x) @param {number} h height (y) @param {number} d depth (z)
   * @param {number} r edge radius @param {number} [k=2] segments per rounded edge
   */
  G.roundedBox = function (w, h, d, r, k) {
    k = k || 2;
    const n = 2 * k + 1;
    const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const dir = new THREE.Vector3();
    const q = Math.PI / 4;
    for (let i = 0; i < pos.count; i++) {
      const ax = axisMap(pos.getX(i), n, k, w / 2, r);
      const ay = axisMap(pos.getY(i), n, k, h / 2, r);
      const az = axisMap(pos.getZ(i), n, k, d / 2, r);
      dir.set(Math.tan(ax.f * q), Math.tan(ay.f * q), Math.tan(az.f * q)).normalize();
      pos.setXYZ(i, ax.p + dir.x * r, ay.p + dir.y * r, az.p + dir.z * r);
      nrm.setXYZ(i, dir.x, dir.y, dir.z);
    }
    return g;
  };

  /**
   * Taper a y-centred geometry: x and z scale linearly from bottom to top (normals are tilted to match).
   * @param {number} h the geometry height (y spans -h/2..h/2)
   */
  G.taper = function (g, sxBottom, sxTop, szBottom, szTop, h) {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const dsx = (sxTop - sxBottom) / h;
    const dsz = (szTop - szBottom) / h;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + h / 2) / h;
      const sx = sxBottom + (sxTop - sxBottom) * t;
      const sz = szBottom + (szTop - szBottom) * t;
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setXYZ(i, x * sx, pos.getY(i), z * sz);
      v.set(nrm.getX(i) / sx, nrm.getY(i), nrm.getZ(i) / sz);
      v.y -= v.x * x * dsx + v.z * z * dsz;
      v.normalize();
      nrm.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  };

  /** LatheGeometry from [r, y] pairs; the seam sits at the back (phiStart = PI) so prints are clean. */
  G.lathe = function (pairs, segs, phiStart, phiLength) {
    const pts = [];
    for (let i = 0; i < pairs.length; i += 2) pts.push(new THREE.Vector2(pairs[i], pairs[i + 1]));
    const start = phiStart === undefined ? Math.PI : phiStart;
    return new THREE.LatheGeometry(pts, segs || 32, start, phiLength || Math.PI * 2);
  };

  /** Translate / rotate / scale a geometry in place. Returns it for chaining. */
  G.place = function (g, p, r, s) {
    const m = new THREE.Matrix4();
    const e = new THREE.Euler(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
    const sc = s ? new THREE.Vector3(s[0], s[1], s[2]) : new THREE.Vector3(1, 1, 1);
    m.compose(
      new THREE.Vector3(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0),
      new THREE.Quaternion().setFromEuler(e),
      sc,
    );
    g.applyMatrix4(m);
    return g;
  };

  /**
   * Bake a flat plastic colour into a geometry (vertex colour + skin flag) and point its UVs at the
   * atlas white strip, or remap its 0..1 UVs into a printed atlas region.
   */
  G.paint = function (g, hex, skin, region) {
    const count = g.attributes.position.count;
    const col = F.lin(hex);
    const colors = new Float32Array(count * 3);
    const skins = new Float32Array(count);
    const uv = g.attributes.uv ? g.attributes.uv.array : new Float32Array(count * 2);
    const box = F.regionUV(region || "white");
    for (let i = 0; i < count; i++) {
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      skins[i] = skin ? 1 : 0;
      uv[i * 2] = region ? box.u0 + uv[i * 2] * (box.u1 - box.u0) : 0.5;
      uv[i * 2 + 1] = region ? box.v0 + uv[i * 2 + 1] * (box.v1 - box.v0) : (box.v0 + box.v1) / 2;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSkin", new THREE.BufferAttribute(skins, 1));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return g;
  };

  /**
   * Smooth the flat normals of a non-indexed geometry (e.g. ExtrudeGeometry) by averaging the face
   * normals of every vertex that shares a position. With a bevel this reads as a soft moulded edge.
   */
  G.smoothNormals = function (g) {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const sums = {};
    const keys = [];
    for (let i = 0; i < pos.count; i++) {
      const k =
        Math.round(pos.getX(i) * 1e4) +
        "," +
        Math.round(pos.getY(i) * 1e4) +
        "," +
        Math.round(pos.getZ(i) * 1e4);
      keys.push(k);
      const s = sums[k] || (sums[k] = new THREE.Vector3());
      s.x += nrm.getX(i);
      s.y += nrm.getY(i);
      s.z += nrm.getZ(i);
    }
    for (let j = 0; j < pos.count; j++) {
      const n = sums[keys[j]].clone().normalize();
      nrm.setXYZ(j, n.x, n.y, n.z);
    }
    return g;
  };

  const ATTRS = [
    ["position", 3],
    ["normal", 3],
    ["uv", 2],
    ["color", 3],
    ["aSkin", 1],
  ];

  /**
   * The index array of a geometry, or a sequential one for non-indexed geometry (so any piece can
   * be merged).
   */
  function indexOf(g) {
    if (g.index) return g.index.array;
    const n = g.attributes.position.count;
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    return idx;
  }

  /** Merge painted geometries into one indexed BufferGeometry (one draw call). */
  G.merge = function (list) {
    let total = 0;
    let totalIdx = 0;
    list.forEach(function (g) {
      total += g.attributes.position.count;
      totalIdx += indexOf(g).length;
    });
    const out = new THREE.BufferGeometry();
    ATTRS.forEach(function (a) {
      const arr = new Float32Array(total * a[1]);
      let off = 0;
      list.forEach(function (g) {
        arr.set(g.attributes[a[0]].array.subarray(0, g.attributes.position.count * a[1]), off);
        off += g.attributes.position.count * a[1];
      });
      out.setAttribute(a[0], new THREE.BufferAttribute(arr, a[1]));
    });
    out.setIndex(new THREE.BufferAttribute(mergeIndex(list, totalIdx), 1));
    out.computeBoundingSphere();
    list.forEach(function (g) {
      g.dispose();
    });
    return out;
  };

  /**
   * Concatenate the index arrays of the geometries being merged, offsetting each by the vertices
   * before it.
   */
  function mergeIndex(list, totalIdx) {
    const index = new Uint32Array(totalIdx);
    let vOff = 0;
    let iOff = 0;
    list.forEach(function (g) {
      const src = indexOf(g);
      for (let i = 0; i < src.length; i++) index[iOff + i] = src[i] + vOff;
      iOff += src.length;
      vOff += g.attributes.position.count;
    });
    return index;
  }
})((window.KQ = window.KQ || {}));
