// Dev-only (browser side of the figures audit, after audit-page.js): how well a head piece fits the head.
//   exposure: head points in the piece's coverage zone that a ray outward does not reach the piece from:
//             "poke" when the piece is sunk just under the head surface there (the head shows through
//             it: this is the accessory-inside-head count), "bare" when nothing covers it;
//   rims:     open edges of the piece that stand off the head by more than 3 mm (a floating brim / hem);
//   zfight:   piece surface parallel to the head within 0.8 mm.
(function () {
  "use strict";
  const A = window.KQAudit;
  const TAU = Math.PI * 2;

  // Coverage zones: where a piece is meant to hide the head. th = angle from the face (0..PI), y = height
  // in head units.
  const HOOD = (th, y) => (th / 0.98) ** 2 + ((y - 0.088) / 0.086) ** 2 > 1.4 && y > 0.012;
  const HAIR = (th, y) => y > 0.17 || (th > 1.9 && y > 0.07);
  const ZONES = {
    cap: (th, y) => y > 0.152,
    songkok: (th, y) => y > 0.158,
    kopiah: (th, y) => y > 0.158,
    tudung: HOOD,
    tudung_kid: HOOD,
    hijab: HOOD,
    hijab_sport: HOOD,
    hijab_flower: HOOD,
    hair: HAIR,
    bun: HAIR,
    ghutra: (th, y) => y > 0.155 || (th > 1.5 && y > 0.07),
    wrap: (th, y) => y > 0.17,
    turban: (th, y) => y > 0.15,
    doppi: (th, y) => y > 0.165,
    crowd_tudung: (th, y) => (th > 1.05 && y > 0.012) || y > 0.165,
    crowd_tudung_kid: (th, y) => (th > 1.05 && y > 0.012) || y > 0.165,
    crowd_cap: (th, y) => y > 0.148,
  };

  /** The coverage zone of a piece type (hair styles share one; a shave covers nothing). */
  function zoneOf(kind, type) {
    if (type === "hair_bald" || type === "none") return null;
    if (kind === "crowd" && ZONES["crowd_" + type]) return ZONES["crowd_" + type];
    if (/^(hair_|girl_)/.test(type)) return HAIR;
    return ZONES[type] || HAIR;
  }

  /** Points on the (faceted) head side wall and top with outward normals: [x, y, z, nx, ny, nz]. */
  function headPoints(f) {
    const pts = [];
    for (let y = f.y0 + 0.004; y < f.y1 - 0.001; y += 0.005) {
      const slope = (A.radiusAt(f, y + 0.001) - A.radiusAt(f, y - 0.001)) / 0.002;
      for (let k = 0; k < 64; k += 1) {
        const th = ((k + 0.5) / 64) * TAU;
        const r = A.surface(f, y, th);
        pts.push([Math.sin(th) * r, y, Math.cos(th) * r, Math.sin(th), -slope, Math.cos(th)]);
      }
    }
    for (let r = 0.006; r < A.radiusAt(f, f.y1) - 0.004; r += 0.012)
      for (let k = 0; k < 16; k += 1)
        pts.push([
          Math.sin(((k + 0.5) / 16) * TAU) * r,
          f.y1,
          Math.cos(((k + 0.5) / 16) * TAU) * r,
          0,
          1,
          0,
        ]);
    return f.kind === "crowd" ? pts.concat(earPoints()) : pts;
  }

  /** The outer halves of the crowd head's two ear blobs (crowd-geo.js: size 0.014 x 0.024 x 0.02 at y 0.09). */
  function earPoints() {
    const R = window.KQ.Figures.CROWD_DIMS.headR;
    const pts = [];
    [-1, 1].forEach((s) => {
      for (let a = -1.2; a <= 1.2; a += 0.4)
        for (let b = -1.2; b <= 1.2; b += 0.4) {
          const n = [s * Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)];
          pts.push([s * (R + 0.004) + n[0] * 0.014, 0.09 + n[1] * 0.024, n[2] * 0.02].concat(n));
        }
    });
    return pts;
  }

  const ray = new THREE.Raycaster();
  const o3 = new THREE.Vector3();
  const d3 = new THREE.Vector3();
  /** Does a ray from p along dir (starting `from` along it, up to `far`) hit the piece? */
  function hits(mesh, p, dir, from, far) {
    d3.set(dir[0], dir[1], dir[2]).normalize();
    o3.set(p[0], p[1], p[2]).addScaledVector(d3, from);
    ray.set(o3, d3);
    ray.far = far;
    return ray.intersectObject(mesh, false).length > 0;
  }

  /** Exposure of the head inside a piece's coverage zone: { zone, poke, bare }. */
  function exposure(f, mesh, zone) {
    const out = { zone: 0, poke: 0, bare: 0 };
    headPoints(f).forEach((p) => {
      if (!zone(Math.abs(Math.atan2(p[0], p[2])), p[1])) return;
      out.zone += 1;
      const n = [p[3], p[4], p[5]];
      if (hits(mesh, p, n, 0.0004, 0.12)) return;
      if (hits(mesh, p, n, -0.012, 0.0124)) out.poke += 1;
      else out.bare += 1;
      if (A.debugBare) A.debugBare.push(p.slice(0, 3).map((v) => Math.round(v * 1000)));
    });
    return out;
  }

  /** Count each undirected edge of an indexed geometry (positions welded to 0.01 mm). */
  function edgeCounts(geo) {
    const pos = geo.attributes.position;
    const key = (i) =>
      [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => Math.round(v * 1e5)).join(",");
    const idx = geo.index.array;
    const count = new Map();
    for (let t = 0; t < idx.length; t += 3)
      for (let e = 0; e < 3; e += 1) {
        const a = key(idx[t + e]);
        const b = key(idx[t + ((e + 1) % 3)]);
        const k = a < b ? a + "|" + b : b + "|" + a;
        count.set(k, (count.get(k) || 0) + 1);
      }
    return count;
  }

  /** Vertices on open edges (used by one triangle only) as [x, y, z]. */
  function openEdgePoints(geo) {
    const pts = [];
    edgeCounts(geo).forEach((n, k) => {
      if (n === 1) k.split("|").forEach((v) => pts.push(v.split(",").map((c) => c / 1e5)));
    });
    return pts;
  }

  /** Open rims that stand off the head: the largest gap (m) and how many rim points float (> 3 mm). */
  function rims(f, geo, mesh) {
    let maxGap = 0;
    let floating = 0;
    openEdgePoints(geo).forEach((p) => {
      // drapes below the head are judged on the body; above 0.165 a rim meets the hat's own crown or badge
      if (p[1] < f.y0 + 0.02 || p[1] > 0.165) return;
      const g = A.gap(f.kind, p[0], p[1], p[2]);
      if (g === null || g > 0.03) return; // far-out rims (a cap peak) are not a head fit
      const out = [p[0], 0, p[2]];
      if (hits(mesh, p, out, 0.0006, 0.04)) return; // covered by another shell of the piece: not seen
      maxGap = Math.max(maxGap, g);
      if (g > 0.003) floating += 1;
    });
    return { maxGap, floating };
  }

  /** Piece samples parallel to the head surface within 0.8 mm (z-fighting). */
  function zfights(f, geo) {
    const s = A.samples(geo);
    let n = 0;
    A.eachSample(s, (i) => {
      const g = A.gap(f.kind, s[i], s[i + 1], s[i + 2]);
      const r = Math.hypot(s[i], s[i + 2]) || 1;
      const radial = (s[i + 3] * s[i] + s[i + 5] * s[i + 2]) / r;
      if (g !== null && Math.abs(g) < A.ZF && radial > 0.85) n += 1;
    });
    return n;
  }

  A.openEdgePoints = openEdgePoints;
  const dbl = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  /**
   * Check one head piece geometry against a head.
   * @param {THREE.BufferGeometry} geo the piece (head space)
   * @param {string} kind "cast" or "crowd"
   * @param {string} type the piece type (picks the coverage zone)
   * @returns {{zone, poke, bare, zfight, rimGap, floating}} head points / samples; rimGap in mm
   */
  A.checkPiece = function (geo, kind, type) {
    const f = Object.assign({ kind }, A.fieldFor(kind));
    const zone = zoneOf(kind, type);
    const out = zone ? exposure(f, new THREE.Mesh(geo, dbl), zone) : { zone: 0, poke: 0, bare: 0 };
    out.zfight = zfights(f, geo);
    const r = rims(f, geo, new THREE.Mesh(geo, dbl));
    out.rimGap = Math.round(r.maxGap * 10000) / 10;
    out.floating = r.floating;
    return out;
  };
})();
