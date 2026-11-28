/* ============================================================================
 * FILE: animal-rig.js
 * PURPOSE: A rideable animal as ONE rigidly skinned mesh (KQ.Figures.AnimalRig): every part
 *          (body, neck, head, tail, the upper and lower half of each leg, saddle, bridle) is a
 *          vertex-coloured piece weighted 100 % to one bone, merged into a single geometry, so a
 *          whole animal with a moving gait costs one draw call (plus its shadow). Also the small
 *          geometry kit the horse and camel builders share (ellipsoid, limb, box, cone).
 * BUSINESS CONTEXT: AC-P5..P7 (ridden camels and horses walk / trot with moving legs) within the
 *   low-tier draw-call budget (< 400): a rig per part would cost ~12 calls an animal.
 * CONVENTIONS: model space has its origin on the ground under the body, +z forward, +y up. A leg
 *   bone's +rotation.x swings the hoof backward; a neck's +rotation.x lowers the head.
 * DEPENDENCIES: three.js (SkinnedMesh, Skeleton, Bone). Used by js/game/mount-rigs.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const UP = new THREE.Vector3(0, 1, 0);
  const LEGS = ["FL", "FR", "HL", "HR"];

  /* ------------------------------ geometry kit ------------------------------ */

  /** Paint a geometry one colour (a "color" attribute). */
  function paint(g, hex) {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
    return g;
  }

  /** An ellipsoid with radii r at p, optionally pitched about X (segments kept low: toy style). */
  function ell(r, p, hex, pitch) {
    const g = new THREE.SphereGeometry(1, 12, 8).scale(r[0], r[1], r[2]);
    if (pitch) g.rotateX(pitch);
    return paint(g.translate(p[0], p[1], p[2]), hex);
  }

  /** A tapered cylinder from a to b (radius ra at a, rb at b). */
  function limb(a, b, ra, rb, hex, seg) {
    const va = new THREE.Vector3(a[0], a[1], a[2]);
    const vb = new THREE.Vector3(b[0], b[1], b[2]);
    const g = new THREE.CylinderGeometry(rb, ra, va.distanceTo(vb), seg || 8, 1);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(UP, vb.clone().sub(va).normalize()),
    );
    const mid = va.add(vb).multiplyScalar(0.5);
    return paint(g.translate(mid.x, mid.y, mid.z), hex);
  }

  /** A box of size s centred at p. */
  function box(s, p, hex) {
    return paint(new THREE.BoxGeometry(s[0], s[1], s[2]).translate(p[0], p[1], p[2]), hex);
  }

  /** An upright cone (an ear) of radius r and height h with its base centre at p, tipped by `tilt` about X. */
  function cone(r, h, p, hex, tilt) {
    const g = new THREE.ConeGeometry(r, h, 6).translate(0, h / 2, 0);
    if (tilt) g.rotateX(tilt);
    return paint(g.translate(p[0], p[1], p[2]), hex);
  }

  /* ------------------------------ the rig ------------------------------ */

  /** Append one part's vertices (non-indexed) with its bone weights to the buffers. */
  function appendPart(buf, part, boneIx) {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    const pos = g.attributes.position.array;
    const col = g.attributes.color.array;
    const nor = g.attributes.normal.array;
    const lower = part.split ? boneIx[part.split.bone] : -1;
    for (let i = 0; i < pos.length / 3; i += 1) {
      const y = pos[i * 3 + 1];
      buf.pos.push(pos[i * 3], y, pos[i * 3 + 2]);
      buf.col.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
      buf.nor.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
      buf.skin.push(lower >= 0 && y < part.split.y ? lower : boneIx[part.bone], 0, 0, 0);
      buf.weight.push(1, 0, 0, 0);
    }
  }

  /** Merge every part into one skinned geometry (each part keeps its own normals: smooth ellipsoids). */
  function mergeParts(parts, boneIx) {
    const buf = { pos: [], col: [], nor: [], skin: [], weight: [] };
    parts.forEach((p) => appendPart(buf, p, boneIx));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(buf.col, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(buf.nor, 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(buf.skin, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(buf.weight, 4));
    g.computeBoundingSphere();
    return g;
  }

  /** The bones, each placed relative to its parent from the model-space pivots. */
  function makeBones(defs) {
    const byName = {};
    const list = defs.map(function (d) {
      const b = new THREE.Bone();
      b.name = d.name;
      const par = d.parent ? defs.find((x) => x.name === d.parent) : null;
      const base = par ? par.at : [0, 0, 0];
      b.position.set(d.at[0] - base[0], d.at[1] - base[1], d.at[2] - base[2]);
      byName[d.name] = b;
      return b;
    });
    defs.forEach((d) => d.parent && byName[d.parent].add(byName[d.name]));
    return { list, byName };
  }

  /**
   * Build a rig: spec = { bones: [{name, parent, at}], parts: [{geo, bone, split?: {y, bone}}] },
   * material = a vertexColors material. Returns { mesh, bones (by name), height }.
   */
  function build(spec, material) {
    const bones = makeBones(spec.bones);
    const ix = {};
    spec.bones.forEach((d, i) => (ix[d.name] = i));
    const geo = mergeParts(spec.parts, ix);
    spec.parts.forEach((p) => p.geo.dispose());
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.add(bones.list[0]);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones.list));
    mesh.receiveShadow = true;
    return { mesh, bones: bones.byName };
  }

  /**
   * Pose a rig: p = { y, pitch, roll, neckP, neckY, headP, tail, legs: [{hip, knee}] x4 }
   * (hip + = swing forward, knee + = fold). Missing bones are skipped.
   */
  function pose(rig, p) {
    const b = rig.bones;
    b.root.position.y = p.y || 0;
    b.body.rotation.set(p.pitch || 0, 0, p.roll || 0);
    b.neck.rotation.set(p.neckP || 0, p.neckY || 0, 0);
    if (b.head) b.head.rotation.set(p.headP || 0, 0, p.headR || 0);
    if (b.tail) b.tail.rotation.set(p.tailP || 0, 0, p.tail || 0);
    LEGS.forEach(function (k, i) {
      const l = p.legs[i];
      b["hip" + k].rotation.x = -l.hip;
      b["knee" + k].rotation.x = l.knee;
    });
  }

  /** The bone list every quadruped shares, from its pivots: body, neck, head?, tail, 4 hips + 4 knees. */
  function quadBones(pv) {
    const list = [
      { name: "root", at: [0, 0, 0] },
      { name: "body", parent: "root", at: pv.body },
      { name: "neck", parent: "body", at: pv.neck },
      { name: "tail", parent: "body", at: pv.tail },
    ];
    if (pv.head) list.push({ name: "head", parent: "neck", at: pv.head });
    LEGS.forEach(function (k, i) {
      list.push({ name: "hip" + k, parent: "body", at: pv.hips[i] });
      list.push({ name: "knee" + k, parent: "hip" + k, at: pv.knees[i] });
    });
    return list;
  }

  F.AnimalRig = { build, pose, quadBones, LEGS, geo: { paint, ell, limb, box, cone } };
})((window.KQ = window.KQ || {}));
