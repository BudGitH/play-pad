/* Kampung Quest — trees, shrubs and table sets as instanced meshes (KQ.WorldParts.Trees).
   Rain trees (wide umbrella canopy on a branching trunk) fill the park and mosque grounds;
   smaller street trees line the grass verges. Canopies are clusters of noise-displaced blobs
   with a leaf texture and per-instance tints. Shrubs are the density-scaled decoration. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const BLOBS = 7;

  /** A lumpy leaf blob (icosahedron displaced by value noise), built once. */
  function blobGeo() {
    return P.cached("blob", () => {
      const g = new THREE.IcosahedronGeometry(1, 3);
      const n = P.Tex.valueNoise(5);
      const p = g.attributes.position;
      const v = new THREE.Vector3();
      const nor = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).normalize();
        nor.setXYZ(i, v.x, v.y, v.z); // smooth, sphere-like normals (the polyhedron is non-indexed)
        const k = 0.8 + n(v.x * 2.2 + 9, v.z * 2.2 + v.y * 1.6 + 9) * 0.38;
        p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
      }
      return g;
    });
  }

  /** Trunk + four limbs merged into one geometry (unit tree, ~4.5 m to the fork). */
  function trunkGeo() {
    return P.cached("trunk", () => {
      const B = new P.Batch();
      const c = new THREE.CylinderGeometry(0.22, 0.34, 1, 9);
      B.geo("t", c, P.compose(0, 1.6, 0, 0, 1, 3.2, 1));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        const tilt = 0.75 + (k % 2) * 0.2;
        B.geo("t", c, P.compose(Math.sin(a) * 1.0, 3.9, Math.cos(a) * 1.0, [tilt * Math.cos(a), 0, -tilt * Math.sin(a)], 0.55, 3.0, 0.55));
      }
      return B.build({ t: new THREE.MeshBasicMaterial() })[0].geometry;
    });
  }

  /** Expand tree specs ({x,z,s,kind}) into trunk + canopy instance lists. */
  function layout(trees) {
    const trunks = [];
    const blobs = [];
    const greens = [0xffffff, 0xe4f0d0, 0xd2e6b8, 0xf0f6e4, 0xc8dca8];
    trees.forEach((t, i) => {
      const r = P.rng(i * 17 + 3);
      const s = t.s;
      trunks.push({ x: t.x, y: 0, z: t.z, ry: r() * 6, sx: s, sy: s * (t.kind === "rain" ? 1 : 1.25), sz: s });
      const spread = (t.kind === "rain" ? 4.2 : 2.2) * s;
      const top = (t.kind === "rain" ? 5.6 : 5.0) * s;
      for (let k = 0; k < BLOBS; k++) {
        const a = (k / BLOBS) * Math.PI * 2 + r();
        const d = k === 0 ? 0 : spread * (0.45 + r() * 0.5);
        const bs = (t.kind === "rain" ? 2.6 : 1.7) * s * (0.8 + r() * 0.4);
        blobs.push({ x: t.x + Math.cos(a) * d, y: top + r() * 1.2 * s - d * 0.15, z: t.z + Math.sin(a) * d, ry: r() * 6, sx: bs * 1.2, sy: bs * 0.75, sz: bs * 1.2, color: greens[Math.floor(r() * greens.length)] });
      }
    });
    return { trunks, blobs };
  }

  /** Build tree meshes and trunk colliders. */
  function build(group, mats, trees, colliders) {
    const lists = layout(trees);
    const trunk = P.instanced(trunkGeo(), mats.bark, lists.trunks);
    trunk.name = "treeTrunks";
    const canopy = P.instanced(blobGeo(), mats.leaf, lists.blobs);
    canopy.name = "treeCanopy";
    group.add(trunk, canopy);
    trees.forEach((t) => colliders.push({ minX: t.x - 0.45 * t.s, maxX: t.x + 0.45 * t.s, minZ: t.z - 0.45 * t.s, maxZ: t.z + 0.45 * t.s, kind: "tree" }));
    return { trunk, canopy };
  }

  /** Shrub blobs (decoration, density-scaled on lower tiers, no colliders). */
  function shrubs(group, mats, spots) {
    const list = spots.map((p, i) => {
      const r = P.rng(i * 7 + 1);
      return { x: p.x, y: 0.35, z: p.z, ry: r() * 6, sx: 0.7 + r() * 0.4, sy: 0.55 + r() * 0.2, sz: 0.7 + r() * 0.4, color: r() < 0.5 ? 0xd8eac0 : 0xffffff };
    });
    const im = P.instanced(blobGeo(), mats.leaf, list);
    im.name = "shrubs";
    im.userData.density = true;
    group.add(im);
    return im;
  }

  /** Round table sets: stone (void deck) or white-top (hawker), with four stools. */
  function tables(group, mats, list, colliders) {
    const tops = [];
    const legs = [];
    const stools = [];
    list.forEach((t) => {
      const top = t.stone ? 0x9da3a6 : 0xf3f1ec;
      tops.push({ x: t.x, y: 0.86, z: t.z, sx: 1, sy: 1, sz: 1, color: top });
      legs.push({ x: t.x, y: 0.5, z: t.z, color: t.stone ? 0x8d9396 : 0x6f757a });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        stools.push({ x: t.x + Math.cos(a) * 0.95, y: 0.37, z: t.z + Math.sin(a) * 0.95, color: t.stone ? 0x9da3a6 : 0xd9663a });
      }
      colliders.push({ minX: t.x - 0.75, maxX: t.x + 0.75, minZ: t.z - 0.75, maxZ: t.z + 0.75, kind: "table" });
    });
    const mat = mats.paint;
    const g1 = P.cached("ttop", () => new THREE.CylinderGeometry(0.62, 0.62, 0.07, 24));
    const g2 = P.cached("tleg", () => new THREE.CylinderGeometry(0.12, 0.2, 0.72, 12));
    const g3 = P.cached("tstool", () => new THREE.CylinderGeometry(0.2, 0.16, 0.46, 14));
    const meshes = [P.instanced(g1, mat, tops), P.instanced(g2, mat, legs), P.instanced(g3, mat, stools)];
    meshes.forEach((m, i) => (m.name = ["tableTops", "tableLegs", "stools"][i]));
    group.add(...meshes);
  }

  P.Trees = { build, shrubs, tables, blobGeo };
})((window.KQ = window.KQ || {}));
