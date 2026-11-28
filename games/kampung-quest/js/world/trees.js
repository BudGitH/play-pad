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
        B.geo(
          "t",
          c,
          P.compose(
            Math.sin(a) * 1.0,
            3.9,
            Math.cos(a) * 1.0,
            [tilt * Math.cos(a), 0, -tilt * Math.sin(a)],
            0.55,
            3.0,
            0.55,
          ),
        );
      }
      return B.build({ t: new THREE.MeshBasicMaterial() })[0].geometry;
    });
  }

  /** Expand tree specs ({x,z,s,kind}) into trunk + canopy instance lists. */
  function layout(trees) {
    const trunks = [];
    const blobs = [];
    const greens = [0xb8c8a8, 0xa8bc98, 0x9cb48c, 0xc0ccb0, 0x94a884];
    trees.forEach((t, i) => {
      const r = P.rng(i * 17 + 3);
      const s = t.s;
      trunks.push({
        x: t.x,
        y: 0,
        z: t.z,
        ry: r() * 6,
        color: 0x8f8274,
        sx: s,
        sy: s * (t.kind === "rain" || P.Foliage ? 1 : 1.25),
        sz: s,
      });
      const spread = (t.kind === "rain" ? 4.2 : 2.2) * s;
      const top = (t.kind === "rain" ? 5.6 : 5.0) * s;
      for (let k = 0; k < BLOBS; k++) {
        const a = (k / BLOBS) * Math.PI * 2 + r();
        const d = k === 0 ? 0 : spread * (0.45 + r() * 0.5);
        const bs = (t.kind === "rain" ? 2.3 : 1.5) * s * (0.8 + r() * 0.4);
        blobs.push({
          x: t.x + Math.cos(a) * d,
          y: top + r() * 1.2 * s - d * 0.15,
          z: t.z + Math.sin(a) * d,
          ry: r() * 6,
          sx: bs * 1.2,
          sy: bs * 0.75,
          sz: bs * 1.2,
          color: greens[Math.floor(r() * greens.length)],
        });
      }
    });
    return { trunks, blobs, cards: cards(trees) };
  }

  /** Alpha leaf-cluster cards scattered through each canopy (breaks up the blob silhouette). */
  function cards(trees) {
    const out = [];
    const tints = [0xd8e4c8, 0xc8d8b4, 0xe0e8d0, 0xbccca8];
    trees.forEach((t, i) => {
      const r = P.rng(i * 29 + 5);
      const rain = t.kind === "rain";
      const n = rain ? 110 : 48;
      const spread = (rain ? 5.4 : 2.9) * t.s;
      const top = (rain ? 6.0 : 5.3) * t.s;
      for (let k = 0; k < n; k++) {
        const a = r() * Math.PI * 2;
        const d = (0.35 + 0.65 * Math.sqrt(r())) * spread;
        const y = top + (r() - 0.35) * (rain ? 2.4 : 2.6) * t.s - (d / spread) * 0.9 * t.s;
        const sz = (rain ? 2.0 : 1.5) * t.s * (0.7 + r() * 0.6);
        out.push({
          x: t.x + Math.cos(a) * d,
          y,
          z: t.z + Math.sin(a) * d,
          rot: [r() * 3, r() * 3, r() * 3],
          sx: sz,
          sy: sz,
          sz: 1,
          color: tints[Math.floor(r() * 4)],
        });
      }
    });
    return out;
  }

  /** Build tree meshes and trunk colliders (photo leaf cards + branching trunks via Foliage). */
  function build(group, mats, trees, colliders) {
    const F = P.Foliage;
    const lists = layout(trees);
    const out = F ? foliageTrees(group, mats, trees, lists) : blobTrees(group, mats, lists);
    trees.forEach((t) =>
      P.collide(
        colliders,
        t.x - 0.45 * t.s,
        t.x + 0.45 * t.s,
        t.z - 0.45 * t.s,
        t.z + 0.45 * t.s,
        "tree",
      ),
    );
    return out;
  }
  /** Original look: trunk + noise blobs + canvas leaf cards (kept as the fallback). */
  function blobTrees(group, mats, lists) {
    const trunk = P.instanced(trunkGeo(), mats.bark, lists.trunks);
    trunk.name = "treeTrunks";
    const canopy = P.instanced(blobGeo(), mats.leaf, lists.blobs);
    canopy.name = "treeCanopy";
    const card = P.cached("card", () => new THREE.PlaneGeometry(1, 1));
    const leafCards = P.instanced(card, mats.leafCard, lists.cards);
    leafCards.name = "treeLeafCards";
    leafCards.userData.density = true;
    group.add(trunk, canopy, leafCards);
    return { trunk, canopy, leafCards };
  }
  /** Realistic look: forked trunks per kind, a dark inner canopy volume, dense photo cards. */
  function foliageTrees(group, mats, trees, lists) {
    const F = P.Foliage;
    const byKind = (rain) => lists.trunks.filter((_, i) => (trees[i].kind === "rain") === rain);
    const trunks = [true, false].map((rain) => {
      const im = P.instanced(F.trunkGeo(rain ? "rain" : "street"), mats.bark, byKind(rain));
      im.name = rain ? "treeTrunks" : "treeTrunksStreet";
      return im;
    });
    const cards = F.canopies(group, mats, trees);
    group.add(trunks[0], trunks[1]);
    return { trunk: trunks[0], leafCards: cards[0], leafCardsStreet: cards[1] };
  }

  /** Shrub blobs (decoration, density-scaled on lower tiers, no colliders). */
  function shrubs(group, mats, spots) {
    const list = spots.map((p, i) => {
      const r = P.rng(i * 7 + 1);
      const k = p.s || 1;
      return {
        x: p.x,
        y: p.y || 0.35,
        z: p.z,
        ry: r() * 6,
        sx: (0.7 + r() * 0.4) * k,
        sy: (0.55 + r() * 0.2) * k,
        sz: (0.7 + r() * 0.4) * k,
        color: r() < 0.5 ? 0xd8eac0 : 0xffffff,
      };
    });
    const im = P.instanced(blobGeo(), mats.hedge || mats.leaf, list);
    im.name = "shrubs";
    im.userData.density = true;
    group.add(im);
    return im;
  }

  /**
   * One stool of a table set: a stone drum (void deck), or the thin plastic seat of a hawker
   * swing-out stool (its steel stem and arm are in the hawker batch), top at 0.60 m either way.
   */
  function stool(t, k) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const x = t.x + Math.cos(a) * 0.95;
    const z = t.z + Math.sin(a) * 0.95;
    if (t.stone) return { x, y: 0.37, z, color: 0x9da3a6 };
    return { x, y: 0.57, z, sy: 0.13, sx: 1.15, sz: 1.15, color: t.stool || 0x2e9e62 };
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
      for (let k = 0; k < 4; k++) stools.push(stool(t, k));
      P.collide(colliders, t.x - 0.75, t.x + 0.75, t.z - 0.75, t.z + 0.75, "table");
    });
    const mat = mats.paint;
    const g1 = P.cached("ttop", () => new THREE.CylinderGeometry(0.62, 0.62, 0.07, 24));
    const g2 = P.cached("tleg", () => new THREE.CylinderGeometry(0.12, 0.2, 0.72, 12));
    const g3 = P.cached("tstool", () => new THREE.CylinderGeometry(0.2, 0.16, 0.46, 14));
    const meshes = [
      P.instanced(g1, mat, tops),
      P.instanced(g2, mat, legs),
      P.instanced(g3, mat, stools),
    ];
    meshes.forEach((m, i) => (m.name = ["tableTops", "tableLegs", "stools"][i]));
    group.add(...meshes);
  }

  P.Trees = { build, shrubs, tables, blobGeo };
})((window.KQ = window.KQ || {}));
