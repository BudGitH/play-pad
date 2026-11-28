/* ============================================================================
 * FILE: camel-face.js
 * PURPOSE: The toy camel's long curved neck and gentle face (KQ.Figures.CamelFace): a smooth
 *          S-curved neck with a soft throat, a round head with a lighter, slightly bulbous muzzle,
 *          big soft eyes with a catch-light and sleepy lids with long lashes, small rounded ears,
 *          nostrils, a little smile, pink cheeks, and a colourful rope halter. No teeth, nothing
 *          sharp: it should read as "cute" to a six-year-old.
 * BUSINESS CONTEXT: owner feedback "Improve the camel models ... not nice for the kids".
 * CONVENTIONS: model space as camel-mesh.js; the neck parts go on the "neck" bone, the head parts
 *   on the "head" bone (pivots in CamelToy.PIVOT).
 * DEPENDENCIES: animal-loft.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const L = () => F.AnimalLoft;
  const EYE = 0x2a1c14;
  const ROPE = 0xd0412e;
  const ROPE2 = 0xf2b630;

  /** The neck: forward out of the chest, then up in a soft curve to the poll. */
  const NECK = [
    { p: [0, 1.42, 0.58], rx: 0.24, up: 0.24, dn: 0.28 },
    { p: [0, 1.5, 0.86], rx: 0.18, up: 0.17, dn: 0.22 },
    { p: [0, 1.62, 1.06], rx: 0.14, up: 0.13, dn: 0.17 },
    { p: [0, 1.82, 1.2], rx: 0.125, up: 0.11, dn: 0.14 },
    { p: [0, 2.06, 1.28], rx: 0.115, up: 0.105, dn: 0.12 },
    { p: [0, 2.22, 1.28], rx: 0.11 },
    { p: [0, 2.3, 1.26], rx: 0.05 },
  ];
  /** The head: a big round skull, then a short face going forward and a little down to a soft muzzle. */
  const HEAD = [
    { p: [0, 2.29, 1.15], rx: 0.05 },
    { p: [0, 2.3, 1.21], rx: 0.14, up: 0.14, dn: 0.13 },
    { p: [0, 2.29, 1.32], rx: 0.155, up: 0.15, dn: 0.14 },
    { p: [0, 2.24, 1.44], rx: 0.115, up: 0.11, dn: 0.115 },
    { p: [0, 2.19, 1.54], rx: 0.11, up: 0.105, dn: 0.115 },
    { p: [0, 2.16, 1.62], rx: 0.095, up: 0.09, dn: 0.1 },
    { p: [0, 2.15, 1.66], rx: 0.035 },
  ];

  /** Fur on the neck: lighter under the throat. */
  function neck(d, tint) {
    const coat = L().tint(F.CamelToy.C.coat, tint);
    const belly = L().tint(F.CamelToy.C.belly, tint);
    const col = (u, a) => L().mix(coat, belly, (-Math.cos(a) - 0.3) * 2);
    return [L().tube(NECK, { seg: d.neckSeg, sub: d.neckSub, col })];
  }

  /** Head fur: the muzzle (front third) is lighter. */
  function skull(d, tint) {
    const coat = L().tint(F.CamelToy.C.coat, tint);
    const pale = L().tint(F.CamelToy.C.belly, tint);
    return L().tube(HEAD, {
      seg: d.headSeg,
      sub: d.sub,
      col: (u) => L().mix(coat, pale, (u - 0.5) * 4),
    });
  }

  /** Outward unit vector from the head's ring centre to a surface point. */
  function outward(fr, u, a) {
    return L()
      .point(fr, u, a, 0.01)
      .sub(L().point(fr, u, a, 0))
      .normalize();
  }

  /** One eye on side s: a big dark eye, a catch-light, a soft lid and three long lashes. */
  function eye(fr, s, d, tint) {
    const k = L();
    const u = 0.34;
    const a = s * 1.12;
    const n = outward(fr, u, a);
    const c = k.point(fr, u, a, -0.012);
    const v = (m, x, y, z) =>
      c
        .clone()
        .addScaledVector(n, m)
        .add(new THREE.Vector3(x, y, z));
    const out = [
      k.ball([0.046, 0.054, 0.048], c.toArray(), EYE, d.ball),
      k.ball([0.012, 0.014, 0.012], v(0.034, 0, 0.018, 0.016).toArray(), 0xffffff, d.small),
      k.ball(
        [0.05, 0.03, 0.05],
        v(0.004, 0, 0.032, 0).toArray(),
        k.tint(F.CamelToy.C.coat, tint),
        d.extras ? d.ball : d.small,
      ),
    ];
    if (d.extras)
      out.push(
        k.ball([0.006, 0.006, 0.006], v(0.038, 0, -0.008, 0.024).toArray(), 0xffffff, d.small),
      );
    if (!d.extras) return out;
    [-0.024, 0, 0.024].forEach(function (dz) {
      const root = v(0.03, 0, 0.034, dz);
      const tip = root
        .clone()
        .addScaledVector(n, 0.028)
        .add(new THREE.Vector3(0, 0.026, dz * 0.6));
      out.push(k.rope([root, tip], 0.0045, EYE, 2));
    });
    return out;
  }

  /** Small rounded ears with a pink inside, set back on the skull. */
  function ear(fr, s, d, tint) {
    const k = L();
    const p = k.point(fr, 0.16, s * 0.75, -0.01);
    const out = [
      k.ball(
        [0.028, 0.06, 0.032],
        [p.x + 0.01 * s, p.y + 0.035, p.z],
        k.tint(F.CamelToy.C.dark, tint),
        d.extras ? d.ball : d.small,
        [0, 0, -0.65 * s],
      ),
    ];
    if (d.extras)
      out.push(
        k.ball(
          [0.012, 0.04, 0.016],
          [p.x + 0.018 * s, p.y + 0.04, p.z + 0.016],
          0xe8a49a,
          d.small,
          [0, 0, -0.65 * s],
        ),
      );
    return out;
  }

  /** Nostrils, the smile under the muzzle and pink cheeks. */
  function muzzle(fr, d) {
    const k = L();
    const out = [];
    [1, -1].forEach(function (s) {
      const n = k.point(fr, 0.9, s * 0.5, -0.004);
      out.push(k.ball([0.01, 0.02, 0.012], n.toArray(), 0x6a4a34, d.small, [0, 0, s * 0.5]));
      if (d.extras) {
        const c = k.point(fr, 0.5, s * 1.55, -0.016);
        out.push(k.ball([0.012, 0.03, 0.04], c.toArray(), 0xf0a596, d.small));
      }
    });
    const pts = [-1, -0.5, 0, 0.5, 1].map((t) =>
      k.point(fr, 0.93 - 0.05 * t * t, Math.PI + t * 1.15, 0.002),
    );
    out.push(k.rope(pts, d.extras ? 0.0075 : 0.01, 0x5a3a28, d.extras ? 8 : 4));
    return out;
  }

  /** The rope halter: a band round the muzzle and one behind the ears, cheek ropes, a short lead. */
  function halter(fr, d) {
    const k = L();
    const out = [
      k.band(fr, 0.76, 0.05, 0.008, ROPE, d.headSeg),
      k.band(fr, 0.14, 0.05, 0.008, ROPE, d.headSeg),
    ];
    if (!d.extras) return out;
    [1, -1].forEach(function (s) {
      out.push(
        k.rope(
          [
            k.point(fr, 0.14, s * 1.6, 0.01),
            k.point(fr, 0.45, s * 1.7, 0.012),
            k.point(fr, 0.76, s * 1.6, 0.01),
          ],
          0.01,
          ROPE,
          4,
        ),
      );
    });
    return out.concat(lead(fr, d));
  }

  /** A short lead rope looping down from the chin, with a pom-pom. */
  function lead(fr, d) {
    const chin = L().point(fr, 0.76, Math.PI, 0.012);
    const end = chin.clone().add(new THREE.Vector3(0, -0.2, -0.14));
    const pts = [chin, chin.clone().add(new THREE.Vector3(0, -0.12, -0.04)), end];
    return [
      L().rope(pts, 0.009, ROPE2, 8),
      L().ball([0.03, 0.045, 0.03], [end.x, end.y - 0.03, end.z], ROPE, d.small),
    ];
  }

  /** Neck and head parts for a detail level and coat tint: { neck: [...], head: [...] }. */
  function parts(d, tint) {
    const head = skull(d, tint);
    const fr = head.userData.frames;
    let list = [head];
    [1, -1].forEach((s) => (list = list.concat(eye(fr, s, d, tint), ear(fr, s, d, tint))));
    list = list.concat(muzzle(fr, d), halter(fr, d));
    return { neck: neck(d, tint), head: list };
  }

  F.CamelFace = { parts, NECK, HEAD };
})((window.KQ = window.KQ || {}));
