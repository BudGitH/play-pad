/* Kampung Quest — realistic foliage (KQ.WorldParts.Foliage): branching trunks (limbs that fork
   into twigs), dense canopies of photographic alpha leaf-cluster cards (CC0 ambientCG leaf
   sets composited into a 2-cell atlas) laid on an umbrella / dome shell with baked
   self-shadowing (inner and lower cards darker), a dark inner volume so the sky never shows
   through the middle, and crossed-card grass tufts along paved edges, fences and tree bases.
   Every kind is one instanced draw call. Used by trees.js when present. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const UP = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const tmpQ = new THREE.Quaternion();
  const tmpQ2 = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const tmpC = new THREE.Color();

  /** A tapered cylinder from a to b (radii r0 → r1) pushed into batch B. */
  function limb(B, a, b, r0, r1) {
    const d = tmpV.copy(b).sub(a);
    const len = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, 1, 7, 1, true);
    const q = tmpQ.setFromUnitVectors(UP, d.normalize());
    const m = new THREE.Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      q,
      tmpS.set(1, len, 1),
    );
    B.geo("t", g, m);
    g.dispose();
  }

  /** Unit rain tree: short trunk, 6 spreading limbs each forking into 2–3 twigs. */
  function trunkGeo(kind) {
    return P.cached("trunk2:" + kind, () => {
      const B = new P.Batch();
      const rain = kind === "rain";
      const fork = new THREE.Vector3(0, rain ? 2.6 : 3.0, 0);
      limb(B, new THREE.Vector3(0, -0.1, 0), fork, rain ? 0.42 : 0.26, rain ? 0.34 : 0.2);
      const r = P.rng(rain ? 71 : 37);
      const n = rain ? 6 : 4;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r() * 0.5;
        const reach = (rain ? 3.4 : 1.6) * (0.75 + r() * 0.35);
        const rise = (rain ? 1.5 : 1.0) + r() * (rain ? 1 : 0.6);
        const end = new THREE.Vector3(Math.cos(a) * reach, fork.y + rise, Math.sin(a) * reach);
        limb(B, fork, end, rain ? 0.2 : 0.13, rain ? 0.11 : 0.07);
        for (let j = 0; j < 3; j++) {
          const b2 = a + (r() - 0.5) * 1.4;
          const out = rain ? 1.3 : 0.8;
          const lift = rain ? 0.7 + r() * 0.8 : 0.3 + r() * 0.5;
          const tip = end
            .clone()
            .add(new THREE.Vector3(Math.cos(b2) * out, lift, Math.sin(b2) * out));
          limb(B, end, tip, 0.08, 0.03);
        }
      }
      return B.build({ t: new THREE.MeshBasicMaterial() })[0].geometry;
    });
  }

  /** Card UV rect for atlas cell 0 (small rain-tree leaflets) or 1 (broad leaves). */
  function cardGeo(cell, atlas) {
    return P.cached("leafCard:" + cell + atlas, () => {
      const g = new THREE.PlaneGeometry(1, 1);
      g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(12).fill(1), 3));
      if (!atlas) return g;
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, cell * 0.5 + uv.getX(i) * 0.5);
      return g;
    });
  }

  /** Canopy envelope for a tree: centre, radius, top / dome / thickness (metres). */
  function envelope(t) {
    const rain = t.kind === "rain";
    return {
      R: (rain ? 5.8 : 2.8) * t.s,
      top: (rain ? 6.4 : 5.2) * t.s,
      dome: (rain ? 1.6 : 2.2) * t.s,
      thick: (rain ? 2.4 : 2.6) * t.s,
    };
  }

  /** One card in the canopy volume (biased to the outer skin) with baked shade. */
  function sampleCard(t, e, r) {
    const a = r() * Math.PI * 2;
    const u = Math.min(1, Math.sqrt(r()) * 1.05);
    const hi = e.top + e.dome * (1 - u * u);
    const lo = e.top - e.thick * (1 - u * u * 0.7);
    const v = Math.pow(r(), 0.55);
    const p = new THREE.Vector3(
      t.x + Math.cos(a) * u * e.R,
      lo + (hi - lo) * v,
      t.z + Math.sin(a) * u * e.R,
    );
    const mid = e.top - e.thick * 0.4;
    const n = new THREE.Vector3(p.x - t.x, (p.y - mid) * 2.2, p.z - t.z).normalize();
    n.x += (r() - 0.5) * 0.8;
    n.z += (r() - 0.5) * 0.8;
    const shade = 0.32 + 0.5 * v * (0.6 + 0.4 * u) + r() * 0.12;
    return { p, n: n.normalize(), twist: r() * Math.PI * 2, shade };
  }

  /** Instance matrices + baked-shade colours for every leaf card of `trees`. */
  function cardList(trees) {
    const out = [];
    trees.forEach((t, i) => {
      const r = P.rng(i * 131 + 7);
      const rain = t.kind === "rain";
      const e = envelope(t);
      const n = Math.round((rain ? 320 : 130) * Math.min(1.3, t.s));
      for (let k = 0; k < n; k++) {
        const c = sampleCard(t, e, r);
        c.size = (rain ? 2.8 : 2.0) * t.s * (0.75 + r() * 0.5);
        out.push(c);
      }
    });
    return out;
  }

  /** Build an InstancedMesh of cards from cardList entries. */
  function cardMesh(geo, mat, list, name) {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    const m = new THREE.Matrix4();
    list.forEach((c, i) => {
      tmpQ.setFromUnitVectors(Z, c.n);
      tmpQ2.setFromAxisAngle(Z, c.twist);
      tmpQ.multiply(tmpQ2);
      m.compose(c.p, tmpQ, tmpS.set(c.size, c.size, c.size));
      im.setMatrixAt(i, m);
      im.setColorAt(i, tmpC.setRGB(c.shade * 0.86, c.shade * 0.94, c.shade * 0.8));
    });
    im.count = list.length;
    im.userData.fullCount = list.length;
    im.userData.density = true;
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = name;
    return im;
  }

  /** Seeded Fisher–Yates, so a lower tier's shorter instance count thins every tree evenly. */
  function shuffle(list) {
    const r = P.rng(2718);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** All canopy cards: rain trees use atlas cell 0, street trees cell 1 (2 draw calls). */
  function canopies(group, mats, trees) {
    const atlas = !!mats.leafCard.userData.atlas;
    const rain = trees.filter((t) => t.kind === "rain");
    const street = trees.filter((t) => t.kind !== "rain");
    const a = cardMesh(cardGeo(0, atlas), mats.leafCard, shuffle(cardList(rain)), "treeLeafCards");
    const b = cardMesh(
      cardGeo(1, atlas),
      mats.leafCard,
      shuffle(cardList(street)),
      "treeLeafCardsStreet",
    );
    group.add(a, b);
    return [a, b];
  }

  /** Crossed-card grass tuft geometry (two vertical planes, base at y = 0). */
  function tuftGeo() {
    return P.cached("tuft", () => {
      const B = new P.Batch();
      const pl = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
      B.geo("g", pl, P.compose(0, 0, 0, 0, 1, 1, 1));
      B.geo("g", pl, P.compose(0, 0, 0, Math.PI / 2, 1, 1, 1));
      return B.build({ g: new THREE.MeshBasicMaterial() })[0].geometry;
    });
  }

  /** Grass tufts at candidate spots that are on bare grass (heightAt ≈ 0) and not blocked. */
  function tufts(group, mat, spots, heightAt, blocked) {
    if (!mat) return null;
    const r = P.rng(99);
    const list = [];
    spots.forEach((s) => {
      if (heightAt(s.x, s.z) > 0.001 || blocked(s.x, s.z)) return;
      const k = 0.18 + r() * 0.22;
      const g = 0.75 + r() * 0.35;
      list.push({
        x: s.x,
        y: 0,
        z: s.z,
        ry: r() * 3,
        sx: k * 1.3,
        sy: k,
        sz: k * 1.3,
        color: tmpC.setRGB(g, g, g * 0.85).getHex(),
      });
    });
    const im = P.instanced(tuftGeo(), mat, shuffle(list), { cast: false });
    im.name = "grassTufts";
    im.userData.density = true;
    group.add(im);
    return im;
  }

  /** Candidate tuft spots: tree bases, sidewalk / fence / hedge edges and a lawn scatter. */
  function tuftSpots(trees, L) {
    const r = P.rng(4321);
    const out = [];
    const jit = (x, z, k) => out.push({ x: x + (r() - 0.5) * k, z: z + (r() - 0.5) * k });
    trees.forEach((t) => {
      for (let k = 0; k < 9; k++) {
        const a = r() * Math.PI * 2;
        const d = 0.45 + r() * 0.9;
        jit(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, 0.1);
      }
    });
    const e = L.road.walk + 0.12;
    for (let t = -L.half; t < L.half; t += 0.7) {
      [-e, e].forEach((c) => {
        if (Math.abs(t) > e) jit(t, c + Math.sign(c) * r() * 0.3, 0.2);
        if (Math.abs(t) > e) jit(c + Math.sign(c) * r() * 0.3, t, 0.2);
      });
    }
    for (let k = 0; k < 700; k++) {
      const x = (r() - 0.5) * 2 * L.half;
      const z = (r() - 0.5) * 2 * L.half;
      if (Math.abs(x) > e && Math.abs(z) > e) jit(x, z, 0);
    }
    return out;
  }

  P.Foliage = { trunkGeo, canopies, tufts, tuftSpots, limb };
})((window.KQ = window.KQ || {}));
