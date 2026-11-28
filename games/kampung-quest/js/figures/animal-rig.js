/* ============================================================================
 * FILE: animal-rig.js
 * PURPOSE: A rideable animal as ONE rigidly skinned mesh (KQ.Figures.AnimalRig): every part
 *          (body, neck, head, tail, the upper and lower half of each leg, saddle, bridle) is a
 *          vertex-coloured piece weighted 100 % to one bone, merged into a single geometry, so a
 *          whole animal with a moving gait costs one draw call (plus its shadow). With leg data
 *          on the spec, pose() drops the body so the lowest hoof / pad stays on the ground in
 *          every stride (groundDrop). The shapes come from animal-loft.js.
 * BUSINESS CONTEXT: AC-P5..P7 (ridden camels and horses walk / trot with moving legs) within the
 *   low-tier draw-call budget (< 400): a rig per part would cost ~12 calls an animal.
 * CONVENTIONS: model space has its origin on the ground under the body, +z forward, +y up. A leg
 *   bone's +rotation.x swings the hoof backward; a neck's +rotation.x lowers the head.
 * DEPENDENCIES: three.js (SkinnedMesh, Skeleton, Bone). Used by camel-mesh.js, horse-mesh.js and
 *   js/game/mount-rigs.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const LEGS = ["FL", "FR", "HL", "HR"];

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
    return { mesh, bones: bones.byName, seat: spec.seat, legLen: spec.legLen };
  }

  /** Rotate (y, z) about the x axis by t (three.js rotation.x). */
  function rotYZ(y, z, t) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [y * c - z * s, y * s + z * c];
  }

  /**
   * How far a foot's lowest point rises above the ground (negative = it would dig in) for a leg
   * pose l = {hip, knee} and a body tilt t = {y (body pivot height), pitch, roll}:
   * n = { x, hip: [y, z], knee: [y, z], pts: [[y, z], ...] } in model space, pts outlining the
   * hoof / pad at rest (on the ground).
   */
  function footRise(n, l, t) {
    const a = -l.hip;
    const b = a + l.knee;
    const k = rotYZ(n.knee[0] - n.hip[0], n.knee[1] - n.hip[1], a);
    const by = t ? t.y : 0;
    const cr = Math.cos((t && t.roll) || 0);
    const sr = Math.sin((t && t.roll) || 0);
    const p = (t && t.pitch) || 0;
    let low = Infinity;
    n.pts.forEach(function (pt) {
      const q = rotYZ(pt[0] - n.knee[0], pt[1] - n.knee[1], b);
      const y = n.hip[0] + k[0] + q[0] - by;
      const z = n.hip[1] + k[1] + q[1];
      const y1 = n.x * sr + y * cr;
      low = Math.min(low, by + y1 * Math.cos(p) - z * Math.sin(p));
    });
    return low;
  }

  /**
   * The outline points of a foot for footRise: an ellipse (centre y, z, half height, half length)
   * sampled round its lower half, plus any extra [y, z] points (toes).
   */
  function footOutline(y, z, ry, rz, extra) {
    const pts = [];
    for (let i = 0; i <= 8; i += 1) {
      const t = Math.PI + (i / 8) * Math.PI;
      pts.push([y + ry * Math.sin(t), z + rz * Math.cos(t)]);
    }
    return pts.concat(extra || []);
  }

  /** Leg data for footRise from a hip pivot, a knee pivot and a foot outline (model space). */
  function legData(hip, knee, pts) {
    return { x: hip[0], hip: [hip[1], hip[2]], knee: [knee[1], knee[2]], pts };
  }

  /**
   * The body drop that keeps the lowest foot of a pose on the ground (0 without leg data);
   * t = {y: body pivot height, pitch, roll}.
   */
  function groundDrop(legLen, legs, t) {
    if (!legLen) return 0;
    let low = Infinity;
    legs.forEach((l, i) => (low = Math.min(low, footRise(legLen[i], l, t))));
    return -low;
  }

  /**
   * Pose a rig: p = { y, pitch, roll, neckP, neckY, headP, tail, legs: [{hip, knee}] x4 }
   * (hip + = swing forward, knee + = fold). Missing bones are skipped. With leg lengths on the rig
   * the root drops so the lowest foot stays on the ground; returns the root's height.
   */
  function pose(rig, p) {
    const b = rig.bones;
    const tilt = { y: b.body.position.y, pitch: p.pitch || 0, roll: p.roll || 0 };
    b.root.position.y = (p.y || 0) + groundDrop(rig.legLen, p.legs, tilt);
    b.body.rotation.set(p.pitch || 0, 0, p.roll || 0);
    b.neck.rotation.set(p.neckP || 0, p.neckY || 0, 0);
    if (b.head) b.head.rotation.set(p.headP || 0, 0, p.headR || 0);
    if (b.tail) b.tail.rotation.set(p.tailP || 0, 0, p.tail || 0);
    LEGS.forEach(function (k, i) {
      const l = p.legs[i];
      b["hip" + k].rotation.x = -l.hip;
      b["knee" + k].rotation.x = l.knee;
    });
    return b.root.position.y;
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

  F.AnimalRig = {
    build,
    pose,
    quadBones,
    footRise,
    footOutline,
    legData,
    groundDrop,
    LEGS,
  };
})((window.KQ = window.KQ || {}));
