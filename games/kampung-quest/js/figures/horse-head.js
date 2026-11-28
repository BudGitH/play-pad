/* ============================================================================
 * FILE: horse-head.js
 * PURPOSE: The toy horse's head, mane and tack (KQ.Figures.HorseHead): a clean smooth head with
 *          round cheeks, a soft muzzle with nostrils, big soft eyes with a catch-light and a lid,
 *          pointed ears, a forelock, an optional white blaze, a flowing mane of ribbon strands
 *          along the crest (fluffier on the pony), a bridle (headpiece, noseband, cheek straps,
 *          bit rings) and reins that run from the bit along the neck to the rider's hands.
 * BUSINESS CONTEXT: owner feedback "the horse can be a little bit more polished".
 * CONVENTIONS: model space as horse-mesh.js. Head parts go on the "head" bone (scaled by the
 *   shape's H about the poll), mane and the front of the reins on "neck", the rest of the reins
 *   on "body" (they meet the rider's hands, which ride with the body).
 * DEPENDENCIES: animal-loft.js; called by horse-mesh.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const L = () => F.AnimalLoft;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const EYE = 0x1e1612;
  const SILVER = 0xc4c4c8;
  const WHITE = 0xf4efe6;

  /** The head's rings: the poll, round cheeks, the long face, a soft muzzle. */
  function headRings(sh) {
    const cy = sh.L + 0.17;
    const r = (z, dy, rx, up, dn) => ({ p: [0, cy + dy, z], rx, up: up || rx, dn: dn || up || rx });
    return [
      r(0.8, 0.69, 0.04),
      r(0.84, 0.69, 0.095, 0.1, 0.11),
      r(0.93, 0.64, 0.1, 0.095, 0.125),
      r(1.02, 0.55, 0.076, 0.07, 0.08),
      r(1.09, 0.47, 0.07, 0.064, 0.072),
      r(1.14, 0.41, 0.078, 0.073, 0.078),
      r(1.17, 0.37, 0.048),
      r(1.18, 0.355, 0.01),
    ];
  }

  /** Head colour: coat, a darker soft muzzle, a white blaze down the face on some coats. */
  function headColour(c) {
    return function (u, a) {
      if (c.blaze && Math.cos(a) > 0.78 && u > 0.14 && u < 0.84) return WHITE;
      return L().mix(c.coat, c.muzzle, (u - 0.72) * 5);
    };
  }

  /** One eye: dark, a catch-light, a soft lid. */
  function eye(fr, s, c) {
    const k = L();
    const p = k.point(fr, 0.24, s * 1.38, -0.01);
    const n = k
      .point(fr, 0.24, s * 1.38, 0.01)
      .sub(p)
      .normalize();
    const at = (m, y, z) =>
      p
        .clone()
        .addScaledVector(n, m)
        .add(V(0, y, z))
        .toArray();
    return [
      k.ball([0.036, 0.04, 0.036], p.toArray(), EYE, [10, 6]),
      k.ball([0.011, 0.012, 0.011], at(0.032, 0.014, 0.014), 0xffffff, [6, 4]),
      k.ball([0.04, 0.022, 0.042], at(0.006, 0.027, 0), c.coat, [8, 5]),
    ];
  }

  /** One pointed ear (a short tapered tube) with a darker inside. */
  function ear(fr, s, c) {
    const k = L();
    const b = k.point(fr, 0.07, s * 0.55, -0.012);
    const rings = [
      { p: b.toArray(), rx: 0.028, up: 0.02 },
      { p: [b.x + s * 0.012, b.y + 0.06, b.z - 0.005], rx: 0.026, up: 0.017 },
      { p: [b.x + s * 0.018, b.y + 0.12, b.z + 0.005], rx: 0.004 },
    ];
    return [
      k.tube(rings, { seg: 6, sub: 2, col: () => c.coat }),
      k.ball([0.012, 0.04, 0.008], [b.x + s * 0.012, b.y + 0.055, b.z + 0.016], c.muzzle, [6, 4]),
    ];
  }

  /** Nostrils and a soft mouth line under the muzzle. */
  function muzzle(fr) {
    const k = L();
    const out = [1, -1].map((s) =>
      k.ball([0.012, 0.02, 0.014], k.point(fr, 0.93, s * 0.8, -0.004).toArray(), 0x2a1e18, [6, 4]),
    );
    const pts = [-1, 0, 1].map((t) => k.point(fr, 0.95 - 0.04 * t * t, Math.PI + t * 1.1, 0.002));
    out.push(k.rope(pts, 0.005, 0x2a1e18, 6));
    return out;
  }

  /** A few strands (tapered ribbons) from `from` falling to `to` (fluff = thickness). */
  function strand(from, mid, to, w, hex) {
    const rings = [
      { p: from.toArray(), rx: w * 0.55, up: w },
      { p: mid.toArray(), rx: w * 0.5, up: w * 0.85 },
      { p: to.toArray(), rx: 0.004 },
    ];
    return L().tube(rings, { seg: 5, sub: 2, col: () => hex });
  }

  /** The forelock over the forehead. */
  function forelock(fr, sh, c) {
    const k = L();
    return [-1, 1].map(function (s) {
      const from = k.point(fr, 0.05, s * 0.15, 0.01);
      const to = k.point(fr, 0.3, s * 0.35, 0.014);
      const mid = from
        .clone()
        .lerp(to, 0.5)
        .add(V(s * 0.012, 0.01, 0.02));
      return strand(from, mid, to, 0.028 * sh.fluff, c.mane);
    });
  }

  /** The bridle: headpiece and noseband round the head, cheek straps, silver bit rings. */
  function bridle(fr) {
    const k = L();
    const S = F.HorseMesh.STRAP;
    const out = [k.band(fr, 0.14, 0.03, 0.008, S, 12), k.band(fr, 0.74, 0.03, 0.008, S, 12)];
    [1, -1].forEach(function (s) {
      out.push(
        k.rope(
          [k.point(fr, 0.14, s * 1.55, 0.008), k.point(fr, 0.74, s * 1.5, 0.008)],
          0.009,
          S,
          3,
        ),
      );
      out.push(
        k.ball([0.018, 0.018, 0.012], k.point(fr, 0.86, s * 1.7, 0.01).toArray(), SILVER, [6, 4]),
      );
    });
    return out;
  }

  /** The mane: a ridge along the crest and ribbon strands falling to one side (both on a pony). */
  function mane(nf, sh, c) {
    const k = L();
    const ridge = [0.08, 0.35, 0.65, 0.95].map((u) => ({
      p: k.point(nf, u, 0, -0.005).toArray(),
      rx: 0.022 * sh.fluff,
      up: 0.03 * sh.fluff,
    }));
    const out = [k.tube(ridge, { seg: 6, sub: 2, col: () => c.mane })];
    for (let i = 0; i < sh.mane; i += 1) {
      const u = 0.1 + (0.84 * i) / (sh.mane - 1);
      const s = sh.fluff > 1 && i % 2 ? -1 : 1;
      const from = k.point(nf, u, s * 0.3, 0);
      const mid = from.clone().add(V(s * 0.05, -0.03, -0.035));
      const to = from.clone().add(V(s * 0.075, -0.1 * sh.fluff, -0.06));
      out.push(strand(from, mid, to, 0.026 * sh.fluff, c.mane));
    }
    return out;
  }

  /** A rein from a to b, sagging `drop` m in the middle. */
  function rein(a, b, drop) {
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= drop;
    return L().rope([a, mid, b], 0.009, F.HorseMesh.STRAP, 6);
  }

  /** Scale a list of geometries by h about the pivot p (a pony's bigger head). */
  function scaleAbout(list, p, h) {
    if (h === 1) return list;
    return list.map((g) =>
      g.translate(-p[0], -p[1], -p[2]).scale(h, h, h).translate(p[0], p[1], p[2]),
    );
  }

  /**
   * Head, neck and rein parts: { head: [...], neck: [mane, reins to the crest],
   * handReins(seat) -> [reins from the crest to the saddle's front, where the rider holds them] }.
   */
  function parts(sh, c, pv, neckFrames) {
    const k = L();
    const skull = k.tube(headRings(sh), { seg: 12, sub: 2, col: headColour(c) });
    const fr = skull.userData.frames;
    let head = [skull].concat(muzzle(fr), forelock(fr, sh, c), bridle(fr));
    [1, -1].forEach((s) => (head = head.concat(eye(fr, s, c), ear(fr, s, c))));
    const piv = V(...pv.head);
    const at = (v) => v.clone().sub(piv).multiplyScalar(sh.H).add(piv);
    const bits = [1, -1].map((s) => at(k.point(fr, 0.86, s * 1.7, 0.02)));
    const crest = [1, -1].map((s) => k.point(neckFrames, 0.62, s * 1.15, 0.03));
    return {
      head: scaleAbout(head, pv.head, sh.H),
      neck: mane(neckFrames, sh, c).concat(bits.map((b, i) => rein(b, crest[i], 0.03))),
      handReins: (seat) =>
        crest.map((q, i) => rein(q, V((i ? -1 : 1) * 0.08, seat.y + 0.07, seat.z + 0.22), 0.04)),
    };
  }

  F.HorseHead = { parts };
})((window.KQ = window.KQ || {}));
