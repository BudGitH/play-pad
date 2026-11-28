/* ============================================================================
 * FILE: holy-palms.js
 * PURPOSE: Date palms for the Haramain cities (KQ.WorldParts.HolyPalms): a gently leaning trunk
 *          with a leaf-scar texture and a bulging crown base, and a crown of 15 feathered fronds
 *          (a canvas leaflet card with alpha). Two instanced meshes however many palms there are.
 * BUSINESS CONTEXT: owner feedback "palm trees ... push realism up a notch": the old palm was
 *   nine flat green strips on a brown pole.
 * DEPENDENCIES: geo.js (instanced, cached), canvas.js (canvas, tex), holy-kit.js (solid collider).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const TAU = Math.PI * 2;
  const TRUNK_H = 8;
  const FROND_SEGS = 6;

  /** Trunk texture: grey-brown fibre with rows of diamond leaf scars. */
  function trunkTexture() {
    const c = P.Canvas.canvas(128, 128);
    const g = c.getContext("2d");
    g.fillStyle = "#8a7152";
    g.fillRect(0, 0, 128, 128);
    const r = P.rng(31);
    for (let i = 0; i < 700; i += 1) {
      g.fillStyle = r() < 0.5 ? "rgba(60,44,28,0.22)" : "rgba(210,190,150,0.16)";
      g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 4 + r() * 12);
    }
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 4; col += 1) scar(g, col * 32 + (row % 2) * 16 + 8, row * 16 + 8);
    }
    return P.Canvas.tex(c, true, true);
  }

  /** One diamond leaf scar. */
  function scar(g, x, y) {
    g.fillStyle = "rgba(58,40,24,0.38)";
    g.beginPath();
    g.moveTo(x, y - 7);
    g.lineTo(x + 8, y);
    g.lineTo(x, y + 7);
    g.lineTo(x - 8, y);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(220,200,160,0.35)";
    g.fillRect(x - 5, y - 6, 10, 2);
  }

  /** Frond card: a central rib with slanted leaflets on both sides, tapering to the tip (alpha-tested). */
  function frondTexture() {
    const c = P.Canvas.canvas(256, 64);
    const g = c.getContext("2d");
    g.lineCap = "round";
    for (let i = 0; i < 46; i += 1) {
      const t = i / 46;
      const x = 6 + t * 240;
      const len = 26 * (1 - t * 0.7);
      g.strokeStyle = i % 2 ? "#3f9a34" : "#62b843"; // a fresh, friendly green (AC-P20)
      g.lineWidth = 3.2 - t * 1.6;
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.moveTo(x, 32);
        g.lineTo(x + 12 * (1 - t * 0.4), 32 + s * len);
        g.stroke();
      });
    }
    g.strokeStyle = "#8a7a3e";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 32);
    g.lineTo(250, 32);
    g.stroke();
    return P.Canvas.tex(c, true, false);
  }

  /** Trunk geometry (leans a little, tapers, ends in a crown-base bulge), UVs for the scar texture. */
  function trunkGeo() {
    const g = new THREE.CylinderGeometry(0.2, 0.36, TRUNK_H, 10, 8);
    g.translate(0, TRUNK_H / 2, 0);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      pos.setX(i, pos.getX(i) + Math.sin((y / TRUNK_H) * 1.6) * 0.35);
      uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 11);
    }
    const bulge = new THREE.SphereGeometry(0.42, 8, 6).translate(
      0.35 * Math.sin(1.6),
      TRUNK_H + 0.1,
      0,
    );
    return mergeIndexed([g, bulge]);
  }

  /** Merge indexed geometries that share position / normal / uv attributes. */
  function mergeIndexed(list) {
    const pos = [];
    const uv = [];
    const idx = [];
    list.forEach((g) => {
      const base = pos.length / 3;
      pos.push(...g.attributes.position.array);
      uv.push(...g.attributes.uv.array);
      g.index.array.forEach((i) => idx.push(i + base));
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    m.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    m.setIndex(idx);
    m.computeVertexNormals();
    return m;
  }

  /** One frond strip arching out at yaw `yaw`: `reach` metres long, `lift` raises the arc, `droop` bends the tip down. */
  function frond(yaw, o) {
    const pos = [];
    const uv = [];
    const pt = (t, side) => {
      const w = 0.62 * (1 - t * 0.55) * side;
      const out = t * o.reach;
      return [
        0.35 + Math.cos(yaw) * out - Math.sin(yaw) * w,
        TRUNK_H + 0.2 + o.lift * Math.sin(t * 2.0) - o.droop * t * t,
        Math.sin(yaw) * out + Math.cos(yaw) * w,
      ];
    };
    for (let i = 0; i < FROND_SEGS; i += 1) {
      const a = i / FROND_SEGS;
      const b = (i + 1) / FROND_SEGS;
      pos.push(...pt(a, -1), ...pt(a, 1), ...pt(b, -1), ...pt(a, 1), ...pt(b, 1), ...pt(b, -1));
      uv.push(a, 0, a, 1, b, 0, a, 1, b, 1, b, 0);
    }
    return { pos, uv };
  }

  /** The crown: three rings of fronds (short and upright, mid, long and drooping), all in one geometry. */
  function crownGeo() {
    const pos = [];
    const uv = [];
    const rings = [
      { n: 5, reach: 2.6, lift: 1.9, droop: 0.4, off: 0 },
      { n: 5, reach: 3.5, lift: 1.5, droop: 1.3, off: 0.6 },
      { n: 5, reach: 4.0, lift: 0.9, droop: 2.1, off: 0.3 },
    ];
    rings.forEach((rg) => {
      for (let i = 0; i < rg.n; i += 1) {
        const f = frond((i / rg.n) * TAU + rg.off, rg);
        pos.push(...f.pos);
        uv.push(...f.uv);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }

  /** Materials for the palms (own textures, no vertex colours). */
  function palmMats() {
    return P.cached("holyPalmMats", () => ({
      trunk: new THREE.MeshStandardMaterial({ map: trunkTexture(), roughness: 0.95 }),
      crown: new THREE.MeshStandardMaterial({
        map: frondTexture(),
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.75,
      }),
    }));
  }

  /** Add palms at `spots` ({x, z, s, ry}) as two instanced meshes; trunk-sized colliders are pushed to `colliders`. */
  function build(group, spots, colliders) {
    const m = palmMats();
    const list = spots.map((s, i) => ({
      x: s.x,
      y: 0,
      z: s.z,
      ry: s.ry !== undefined ? s.ry : i * 2.4,
      sx: s.s,
      sy: s.s * (0.85 + ((i * 37) % 30) / 100),
      sz: s.s,
    }));
    const trunk = P.instanced(P.cached("holyPalmTrunk2", trunkGeo), m.trunk, list);
    const crown = P.instanced(P.cached("holyPalmCrown2", crownGeo), m.crown, list, { cast: false });
    trunk.name = "holyPalmTrunk";
    crown.name = "holyPalmCrown";
    group.add(trunk, crown);
    spots.forEach((s) =>
      P.HolyKit.solid(colliders, s.x - 0.3, s.z - 0.3, s.x + 0.3, s.z + 0.3, "palm"),
    );
  }

  P.HolyPalms = { build };
})((window.KQ = window.KQ || {}));
