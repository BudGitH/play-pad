/* ============================================================================
 * FILE: holy-camel-mesh.js
 * PURPOSE: The herd camel and its handler as separate rigid geometries
 *          (KQ.WorldParts.CamelMesh): body (with the hump), neck + head, one leg (hip pivot),
 *          tail, the Bedouin blanket, and a robed handler. The camel parts are the shared toy
 *          camel (KQ.Figures.CamelToy, low detail) so the herd looks like the rideable camels.
 *          Each part is one merged, vertex-coloured geometry so the whole herd draws as a
 *          handful of InstancedMeshes whose per-camel matrices are driven by holy-camel-herd.js.
 * BUSINESS CONTEXT: owner feedback "show camels in the Makkah region"; the toy style is kept:
 *   soft ellipsoid volumes, simple colours, a long S-curved neck and a hump so it reads at once.
 * DEPENDENCIES: three.js, js/figures/camel-mesh.js (KQ.Figures.CamelToy).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const UP = new THREE.Vector3(0, 1, 0);

  /** Paint a geometry one colour. */
  function paint(g, hex) {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
    return g;
  }

  /** An ellipsoid with radii r = [x, y, z] at p = [x, y, z], optionally pitched about X. */
  function ell(r, p, hex, pitch) {
    const g = new THREE.SphereGeometry(1, 10, 7).scale(r[0], r[1], r[2]);
    if (pitch) g.rotateX(pitch);
    return paint(g.translate(p[0], p[1], p[2]), hex);
  }

  /** A tapered cylinder from point a to point b (radius ra at a, rb at b). */
  function limb(a, b, ra, rb, hex) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const g = new THREE.CylinderGeometry(rb, ra, len, 8, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, vb.clone().sub(va).normalize());
    g.applyQuaternion(q);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    return paint(g.translate(mid.x, mid.y, mid.z), hex);
  }

  /**
   * Merge coloured geometries into one non-indexed geometry, keeping each part's own (smooth)
   * normals: recomputing them on a non-indexed merge would make every face flat and faceted.
   */
  function merge(list) {
    const pos = [];
    const col = [];
    const nor = [];
    const uv = [];
    list.forEach((g0) => {
      const g = g0.index ? g0.toNonIndexed() : g0;
      pos.push(...g.attributes.position.array);
      col.push(...g.attributes.color.array);
      nor.push(...g.attributes.normal.array);
      uv.push(...g.attributes.uv.array);
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    m.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    m.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    m.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    list.forEach((g) => g.dispose());
    return m;
  }

  /** Move a list of model-space parts so `pivot` is their origin. */
  const at = (list, pv) => list.map((g) => g.translate(-pv[0], -pv[1], -pv[2]));

  /** The herd's camel parts from the shared toy camel (KQ.Figures.CamelToy, low detail, untinted). */
  function camelGeos() {
    const T = KQ.Figures.CamelToy;
    const p = T.parts("lo", 0xffffff);
    return {
      body: merge(p.body),
      neck: merge(at(p.neck.concat(p.head), T.PIVOT.neck)),
      leg: merge(at(p.legs[0], T.PIVOT.hips[0])),
      tail: merge(at(p.tail, T.PIVOT.tail)),
      saddle: merge(p.saddle),
    };
  }

  /** A robed handler (about 1.4 m): white robe, head cloth with a dark band, arms, a staff. */
  function handlerGeo() {
    const cyl = (r0, r1, h, p, hex) =>
      paint(new THREE.CylinderGeometry(r1, r0, h, 10).translate(p[0], p[1], p[2]), hex);
    return merge([
      cyl(0.34, 0.2, 1.0, [0, 0.5, 0], 0xf1ece0),
      ell([0.16, 0.18, 0.16], [0, 1.2, 0], 0xb07a50),
      ell([0.2, 0.14, 0.2], [0, 1.34, 0], 0xf6f2e8),
      cyl(0.2, 0.2, 0.04, [0, 1.3, 0], 0x1d1d1f),
      limb([-0.2, 0.98, 0], [-0.34, 0.62, 0.12], 0.07, 0.06, 0xf1ece0),
      limb([0.2, 0.98, 0], [0.36, 0.72, 0.3], 0.07, 0.06, 0xf1ece0),
      limb([0.36, 0.0, 0.3], [0.36, 1.5, 0.3], 0.03, 0.03, 0x7a5a38),
    ]);
  }

  /** All the parts, built once. */
  function parts() {
    return P.cached("holyCamelParts", () => Object.assign(camelGeos(), { handler: handlerGeo() }));
  }

  /** Where each part pivots, relative to the camel's ground point: neck base, tail root, the four hips. */
  const PIVOT = (function () {
    const T = KQ.Figures.CamelToy.PIVOT;
    return { neck: T.neck, tail: T.tail, hips: T.hips };
  })();
  const HIP_Y = PIVOT.hips[0][1];

  P.CamelMesh = { parts, PIVOT, HIP_Y };
})((window.KQ = window.KQ || {}));
