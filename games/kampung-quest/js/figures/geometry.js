// Kampung Quest — geometry helpers for the toy figures: bevelled (rounded) boxes, tapers, lathes,
// vertex-colour "painting" and a small indexed merge so each rigid part is one draw call.
(function (KQ) {
  "use strict";
  var F = (KQ.Figures = KQ.Figures || {});
  var G = (F.Geo = {});

  /** Map a unit-box grid coordinate to { core offset sign/fraction, rounding fraction } for one axis. */
  function axisMap(c, n, k, half, r) {
    var i = Math.round((c + 0.5) * n);
    var core = half - r;
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
    var n = 2 * k + 1;
    var g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
    var pos = g.attributes.position;
    var nrm = g.attributes.normal;
    var dir = new THREE.Vector3();
    var q = Math.PI / 4;
    for (var i = 0; i < pos.count; i++) {
      var ax = axisMap(pos.getX(i), n, k, w / 2, r);
      var ay = axisMap(pos.getY(i), n, k, h / 2, r);
      var az = axisMap(pos.getZ(i), n, k, d / 2, r);
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
    var pos = g.attributes.position;
    var nrm = g.attributes.normal;
    var dsx = (sxTop - sxBottom) / h;
    var dsz = (szTop - szBottom) / h;
    var v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      var t = (pos.getY(i) + h / 2) / h;
      var sx = sxBottom + (sxTop - sxBottom) * t;
      var sz = szBottom + (szTop - szBottom) * t;
      var x = pos.getX(i);
      var z = pos.getZ(i);
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
    var pts = [];
    for (var i = 0; i < pairs.length; i += 2) pts.push(new THREE.Vector2(pairs[i], pairs[i + 1]));
    var start = phiStart === undefined ? Math.PI : phiStart;
    return new THREE.LatheGeometry(pts, segs || 32, start, phiLength || Math.PI * 2);
  };

  /** Translate / rotate / scale a geometry in place. Returns it for chaining. */
  G.place = function (g, p, r, s) {
    var m = new THREE.Matrix4();
    var e = new THREE.Euler(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
    var sc = s ? new THREE.Vector3(s[0], s[1], s[2]) : new THREE.Vector3(1, 1, 1);
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
    var count = g.attributes.position.count;
    var col = F.lin(hex);
    var colors = new Float32Array(count * 3);
    var skins = new Float32Array(count);
    var uv = g.attributes.uv ? g.attributes.uv.array : new Float32Array(count * 2);
    var box = F.regionUV(region || "white");
    for (var i = 0; i < count; i++) {
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
    var pos = g.attributes.position;
    var nrm = g.attributes.normal;
    var sums = {};
    var keys = [];
    for (var i = 0; i < pos.count; i++) {
      var k =
        Math.round(pos.getX(i) * 1e4) +
        "," +
        Math.round(pos.getY(i) * 1e4) +
        "," +
        Math.round(pos.getZ(i) * 1e4);
      keys.push(k);
      var s = sums[k] || (sums[k] = new THREE.Vector3());
      s.x += nrm.getX(i);
      s.y += nrm.getY(i);
      s.z += nrm.getZ(i);
    }
    for (var j = 0; j < pos.count; j++) {
      var n = sums[keys[j]].clone().normalize();
      nrm.setXYZ(j, n.x, n.y, n.z);
    }
    return g;
  };

  var ATTRS = [
    ["position", 3],
    ["normal", 3],
    ["uv", 2],
    ["color", 3],
    ["aSkin", 1],
  ];

  function indexOf(g) {
    if (g.index) return g.index.array;
    var n = g.attributes.position.count;
    var idx = new Uint32Array(n);
    for (var i = 0; i < n; i++) idx[i] = i;
    return idx;
  }

  /** Merge painted geometries into one indexed BufferGeometry (one draw call). */
  G.merge = function (list) {
    var total = 0;
    var totalIdx = 0;
    list.forEach(function (g) {
      total += g.attributes.position.count;
      totalIdx += indexOf(g).length;
    });
    var out = new THREE.BufferGeometry();
    ATTRS.forEach(function (a) {
      var arr = new Float32Array(total * a[1]);
      var off = 0;
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

  function mergeIndex(list, totalIdx) {
    var index = new Uint32Array(totalIdx);
    var vOff = 0;
    var iOff = 0;
    list.forEach(function (g) {
      var src = indexOf(g);
      for (var i = 0; i < src.length; i++) index[iOff + i] = src[i] + vOff;
      iOff += src.length;
      vOff += g.attributes.position.count;
    });
    return index;
  }
})((window.KQ = window.KQ || {}));
