// Dev-only (browser side of the figures audit, loaded by audit.mjs and tests/kampung-quest-figures.spec.mjs
// after three.js and the game's js/data, js/sim and js/figures scripts). Two jobs:
// the head as a measurable solid (the real lathe from KQ.Figures.headProfile / crowdHeadProfile, faceted
// like the mesh), geometry sampling (vertices + triangle centres) and the printed face band check. The
// head-piece fit checks are in audit-fit.js, the pose checks and renders in audit-render.js.
(function () {
  "use strict";
  const A = (window.KQAudit = {});
  const F = () => window.KQ.Figures;
  const TAU = Math.PI * 2;
  const ZF = 0.0008; // closer than this and parallel = z-fighting

  // ---------- sampling ----------

  /** Vertices and triangle centres of a geometry as [x, y, z, nx, ny, nz, ...] (optionally transformed). */
  function samples(geo, matrix, keep) {
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const idx = geo.index ? geo.index.array : null;
    const out = [];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
    const put = (x, y, z, a, b, c) => {
      v.set(x, y, z);
      n.set(a, b, c);
      if (matrix) v.applyMatrix4(matrix), n.applyMatrix3(nm);
      n.normalize();
      out.push(v.x, v.y, v.z, n.x, n.y, n.z);
    };
    const ok = keep || (() => true);
    for (let i = 0; i < pos.count; i += 1)
      if (ok(i)) put(pos.getX(i), pos.getY(i), pos.getZ(i), nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    const tri = idx ? idx.length : pos.count;
    for (let t = 0; t < tri; t += 3) if (ok(idx ? idx[t] : t)) centre(pos, nrm, idx, t, put);
    return out;
  }

  /** Push the centre (and averaged normal) of triangle t. */
  function centre(pos, nrm, idx, t, put) {
    const k = [0, 1, 2].map((j) => (idx ? idx[t + j] : t + j));
    const avg = (attr, get) =>
      (get.call(attr, k[0]) + get.call(attr, k[1]) + get.call(attr, k[2])) / 3;
    put(
      avg(pos, pos.getX),
      avg(pos, pos.getY),
      avg(pos, pos.getZ),
      avg(nrm, nrm.getX),
      avg(nrm, nrm.getY),
      avg(nrm, nrm.getZ),
    );
  }

  // ---------- the head as a measurable solid ----------

  /** A head field from a lathe profile: radius at a height, faceted like the real mesh. */
  function headField(hp) {
    const rows = [];
    for (let i = 0; i < hp.pairs.length; i += 2) rows.push([hp.pairs[i + 1], hp.pairs[i]]);
    rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return { rows, segs: hp.segs, y0: rows[0][0], y1: rows[rows.length - 1][0] };
  }

  /** The profile radius at height y (max at a repeated height), or -1 outside the head. */
  function radiusAt(f, y) {
    if (y < f.y0 || y > f.y1) return -1;
    let best = 0;
    for (let i = 1; i < f.rows.length; i += 1) {
      const a = f.rows[i - 1];
      const b = f.rows[i];
      if (y < a[0] || y > b[0]) continue;
      const t = b[0] === a[0] ? 1 : (y - a[0]) / (b[0] - a[0]);
      best = Math.max(best, a[1] + (b[1] - a[1]) * t);
    }
    return best;
  }

  /** The faceted head surface radius at (y, angle): a lathe of n segments with its seam at phi = PI. */
  function surface(f, y, theta) {
    const r = radiusAt(f, y);
    if (r < 0) return -1;
    const w = TAU / f.segs;
    const local = ((((theta - Math.PI) % w) + w) % w) - w / 2;
    return (r * Math.cos(w / 2)) / Math.cos(local);
  }

  /** Signed gap from the head surface to a point (negative = inside), or null above / below the head. */
  function gap(f, x, y, z) {
    const s = surface(f, y, Math.atan2(x, z));
    return s < 0 ? null : Math.hypot(x, z) - s;
  }
  A.gap = (kind, x, y, z) => gap(fieldFor(kind), x, y, z);

  const fields = {};
  /** The head field of the cast ("cast") or the crowd ("crowd"). */
  function fieldFor(kind) {
    if (!fields[kind]) fields[kind] = headField(kind === "crowd" ? crowdProfile() : castProfile());
    return fields[kind];
  }

  // The head lathes as they were before KQ.Figures exported them (so the audit can also measure the
  // code from before the clean-up, for the before / after numbers).
  const OLD_CAST = [0, 0, 0.078, 0, 0.094, 0.004, 0.102, 0.012, 0.105, 0.026, 0.105, 0.164];
  const OLD_CAST_TOP = [0.102, 0.178, 0.094, 0.186, 0.078, 0.19, 0, 0.19];
  const OLD_CROWD = [0, 0, 0.08, 0, 0.098, 0.006, 0.105, 0.03, 0.105, 0.16, 0.098, 0.184];
  /** The cast head profile (exported by parts.js, or the old copy). */
  function castProfile() {
    if (F().headProfile) return F().headProfile(F().dims({ id: "x" }));
    return { pairs: OLD_CAST.concat(OLD_CAST_TOP), segs: 32 };
  }
  /** The crowd head profile (exported by crowd-geo.js, or the old copy). */
  function crowdProfile() {
    if (F().crowdHeadProfile) return F().crowdHeadProfile();
    return { pairs: OLD_CROWD.concat([0.07, 0.19, 0, 0.19]), segs: 14 };
  }

  /** The printed face band against the cast head: samples that dip into the head or sit within z-fight range. */
  A.checkFaceBand = function () {
    const f = fieldFor("cast");
    const geo = F().partHead({ skin: "#e3a97c" }, F().dims({ id: "x" }));
    const uv = geo.attributes.uv;
    const s = samples(geo, null, (i) => uv.getY(i) > 0.12); // the face region of the atlas only
    const out = { samples: s.length / 6, inside: 0, zfight: 0, proud: 0 };
    eachSample(s, (i) => {
      const g = gap(f, s[i], s[i + 1], s[i + 2]);
      if (g === null) return;
      if (g < 0.0002) out.inside += 1;
      else if (g < ZF) out.zfight += 1;
      else if (g > 0.0018) out.proud += 1;
    });
    return out;
  };

  /** Call fn(i) for every sample start index. */
  function eachSample(s, fn) {
    for (let i = 0; i < s.length; i += 6) fn(i);
  }

  A.samples = samples;
  A.eachSample = eachSample;
  A.fieldFor = fieldFor;
  A.radiusAt = radiusAt;
  A.surface = surface;
  A.ZF = ZF;
})();
