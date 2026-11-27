/* ============================================================================
 * FILE: holy-camel-mesh.js
 * PURPOSE: The low-poly camel and its handler as separate rigid geometries
 *          (KQ.WorldParts.CamelMesh): body (torso, hump, haunch, chest), neck + head, one leg
 *          (hip pivot), tail, a saddle blanket, and a robed handler. Each part is one merged,
 *          vertex-coloured geometry so the whole herd draws as a handful of InstancedMeshes
 *          whose per-camel matrices are driven by holy-camels.js.
 * BUSINESS CONTEXT: owner feedback "show camels in the Makkah region"; the toy style is kept:
 *   soft ellipsoid volumes, simple colours, a long S-curved neck and a hump so it reads at once.
 * DEPENDENCIES: three.js only (plain geometry maths; no world state).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const UP = new THREE.Vector3(0, 1, 0);
  /** Hip height above the ground: the legs hang this far. */
  const HIP_Y = 1.12;

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

  /** Merge coloured, indexed or non-indexed geometries into one non-indexed geometry with normals. */
  function merge(list) {
    const pos = [];
    const col = [];
    const uv = [];
    list.forEach((g0) => {
      const g = g0.index ? g0.toNonIndexed() : g0;
      pos.push(...g.attributes.position.array);
      col.push(...g.attributes.color.array);
      uv.push(...g.attributes.uv.array);
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    m.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    m.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    m.computeVertexNormals();
    return m;
  }

  const COAT = 0xcfa86e;
  const COAT_DARK = 0xa98350;
  const BELLY = 0xe3cfa2;
  const HOOF = 0x6a5238;

  /** Torso, hump, haunch and chest (origin on the ground below the body centre; +z forward). */
  function bodyGeo() {
    return merge([
      ell([0.52, 0.56, 1.18], [0, 1.38, 0], COAT),
      ell([0.46, 0.34, 0.98], [0, 1.1, 0.02], BELLY),
      ell([0.44, 0.5, 0.52], [0, 1.9, -0.12], COAT_DARK),
      ell([0.5, 0.56, 0.55], [0, 1.4, -0.72], COAT),
      ell([0.46, 0.58, 0.55], [0, 1.4, 0.8], COAT),
      ell([0.3, 0.3, 0.3], [0, 1.1, 1.18], BELLY),
    ]);
  }

  /** Neck and head, pivot at the neck base (0, 0, 0): a thick S-curve forward and up, a long face, small ears. */
  function neckGeo() {
    return merge([
      limb([0, 0, 0], [0, 0.26, 0.4], 0.27, 0.2, COAT),
      limb([0, 0.26, 0.4], [0, 0.62, 0.62], 0.2, 0.15, COAT),
      limb([0, 0.62, 0.62], [0, 0.86, 0.7], 0.15, 0.14, COAT),
      ell([0.16, 0.19, 0.32], [0, 0.92, 0.9], COAT, 0.7),
      ell([0.12, 0.12, 0.2], [0, 0.78, 1.18], BELLY, 0.5),
      ell([0.1, 0.05, 0.1], [0, 0.66, 1.26], 0xd9b88a, 0.5),
      ell([0.05, 0.1, 0.06], [-0.14, 1.1, 0.78], COAT_DARK, -0.3),
      ell([0.05, 0.1, 0.06], [0.14, 1.1, 0.78], COAT_DARK, -0.3),
      ell([0.04, 0.04, 0.04], [-0.16, 0.99, 0.98], 0x1f1812),
      ell([0.04, 0.04, 0.04], [0.16, 0.99, 0.98], 0x1f1812),
    ]);
  }

  /** One leg hanging from the hip (0, 0, 0) down to -HIP_Y: thigh, knee, shin, foot pad. */
  function legGeo() {
    return merge([
      limb([0, 0, 0], [0, -0.52, 0.02], 0.2, 0.13, COAT),
      ell([0.14, 0.14, 0.14], [0, -0.56, 0.04], COAT_DARK),
      limb([0, -0.56, 0.04], [0, -1.02, 0], 0.11, 0.09, COAT),
      ell([0.17, 0.08, 0.22], [0, -HIP_Y + 0.08, 0.06], HOOF),
    ]);
  }

  /** Tail, pivot at its root: a thin cord with a dark tuft. */
  function tailGeo() {
    return merge([
      limb([0, 0, 0], [0, -0.62, -0.1], 0.05, 0.035, COAT_DARK),
      ell([0.06, 0.12, 0.06], [0, -0.7, -0.11], 0x4a3a2a),
    ]);
  }

  /** A woven saddle blanket with a coloured stripe and a rolled seat on the back (instance colour tints it). */
  function saddleGeo() {
    const box = (s, p, hex) =>
      paint(new THREE.BoxGeometry(s[0], s[1], s[2]).translate(p[0], p[1], p[2]), hex);
    return merge([
      box([1.0, 0.07, 0.95], [0, 1.86, 0.34], 0xffffff),
      box([1.04, 0.075, 0.2], [0, 1.865, 0.34], 0xb83a2e),
      box([1.04, 0.075, 0.08], [0, 1.866, 0.66], 0x2a6a58),
      box([0.5, 0.18, 0.4], [0, 1.99, 0.34], 0x8a5a38),
    ]);
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
    return P.cached("holyCamelParts", () => ({
      body: bodyGeo(),
      neck: neckGeo(),
      leg: legGeo(),
      tail: tailGeo(),
      saddle: saddleGeo(),
      handler: handlerGeo(),
    }));
  }

  /** Where each part pivots, relative to the camel's ground point: neck base, tail root, the four hips. */
  const PIVOT = {
    neck: [0, 1.58, 1.05],
    tail: [0, 1.66, -1.26],
    hips: [
      [-0.3, HIP_Y, 0.8],
      [0.3, HIP_Y, 0.8],
      [-0.3, HIP_Y, -0.76],
      [0.3, HIP_Y, -0.76],
    ],
  };

  P.CamelMesh = { parts, PIVOT, HIP_Y };
})((window.KQ = window.KQ || {}));
