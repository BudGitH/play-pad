/* Kampung Quest — the hawker centre (KQ.WorldParts.Hawker): open-sided pavilion with a
   two-tier terracotta roof and clerestory, ceiling fans (instanced, they spin), fluorescent
   tubes, five halal stall fronts with lit signboards, a tray-return point and round tables.
   Returns each stall's counter spot for POIs/interactables. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const STALL_D = 3.6;

  /** A sloped roof slab with a painted ceiling underneath (rotation about X). */
  function slope(B, x0, x1, zEave, yEave, zTop, yTop) {
    const dz = zTop - zEave;
    const dy = yTop - yEave;
    const len = Math.hypot(dz, dy);
    const th = Math.atan2(dy, Math.abs(dz)) * (dz < 0 ? 1 : -1);
    const cz = (zEave + zTop) / 2;
    const cy = (yEave + yTop) / 2;
    B.box("roof", (x0 + x1) / 2, cy, cz, x1 - x0, 0.14, len, 0xffffff, [th, 0, 0]);
    const nz = Math.sin(th) * 0.13;
    const ny = Math.cos(th) * 0.13;
    B.box("paint", (x0 + x1) / 2, cy - ny, cz - nz, x1 - x0 - 0.2, 0.06, len - 0.2, 0xcdbfa4, [th, 0, 0]);
    B.box("paint", (x0 + x1) / 2, yEave - 0.12, zEave, x1 - x0, 0.32, 0.08, 0x2f6b4a);
  }

  /** Columns, floor, roof tiers and the front name board. */
  function shell(B, H, ctx) {
    const h = H.h;
    B.aabb("tiles", H.x0 - 1.5, 0, H.z0 - 1.5, H.x1 + 1.5, 0.14, H.z1 + 1.5, 0xc98a62);
    for (let x = H.x0; x <= H.x1; x += 6) {
      [H.z0, (H.z0 + H.z1) / 2, H.z1].forEach((z, i) => {
        if (x === 26 || (i === 1 && (x === H.x0 || x === H.x1))) return;
        B.box("plaster", x, h / 2, z, 0.45, h, 0.45, 0xf1ead8);
        B.box("plaster", x, 0.5, z, 0.5, 1.0, 0.5, 0x2f6b4a);
        ctx.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, kind: "column" });
      });
    }
    const zm = (H.z0 + H.z1) / 2;
    const x0 = H.x0 - 1.6;
    const x1 = H.x1 + 1.6;
    slope(B, x0, x1, H.z1 + 1.6, h, zm + 4, h + 1.7);
    slope(B, x0, x1, H.z0 - 1.6, h, zm - 4, h + 1.7);
    slope(B, x0 + 2, x1 - 2, zm + 5, h + 2.3, zm, h + 3.3);
    slope(B, x0 + 2, x1 - 2, zm - 5, h + 2.3, zm, h + 3.3);
    for (let x = x0 + 2; x <= x1 - 2; x += 3) {
      [zm - 4.4, zm + 4.4].forEach((z) => B.box("paint", x, h + 2.0, z, 0.12, 0.9, 0.12, 0x2f6b4a));
    }
    B.aabb("paint", x0 + 2, h + 1.6, zm - 4.6, x1 - 2, h + 1.75, zm + 4.6, 0xe9e2cf);
    roofFrame(B, H, zm);
    const uv = ctx.atlas.sign({ w: 8, h: 1.1, text: "PUSAT MAKANAN", sub: "Kampung Food Centre", bg: "#2f6b4a", bg2: "#245a3d" });
    B.plane("sign", (H.x0 + H.x1) / 2, h + 0.75, H.z1 + 1.72, 7.2, 1.0, 0, uv);
  }

  /** Exposed roof structure: tie beams at every column line, ring beams, purlins. */
  function roofFrame(B, H, zm) {
    const h = H.h;
    for (let x = H.x0; x <= H.x1; x += 6) B.box("paint", x, h + 0.12, zm, 0.2, 0.32, H.z1 - H.z0 + 3, 0x2f6b4a);
    [H.z0, zm, H.z1].forEach((z) => B.box("paint", (H.x0 + H.x1) / 2, h + 0.1, z, H.x1 - H.x0 + 3, 0.28, 0.2, 0x2f6b4a));
    for (let z = H.z0 - 1; z <= H.z1 + 1; z += 1.6) {
      const y = h + 0.3 + (1.7 * (1 - Math.min(1, Math.abs(z - zm) / ((H.z1 - H.z0) / 2 + 1.6)))) * 0.95;
      if (Math.abs(z - zm) < 3.8) continue;
      B.box("paint", (H.x0 + H.x1) / 2, y, z, H.x1 - H.x0 + 3, 0.08, 0.08, 0x3b5f4a);
    }
  }

  /** Ceiling fans (static rods/hubs in the batch, blades instanced) and tube lights. */
  function fans(B, H, out, ctx) {
    const list = [];
    for (let x = H.x0 + 3; x < H.x1; x += 6) {
      [H.z1 - 4.5, H.z1 - 10.5].forEach((z) => {
        B.cyl("metal", x, H.h + 0.2, z, 0.03, 1.4, 6, 0xd0d0d0);
        B.cyl("paint", x, H.h - 0.55, z, 0.16, 0.18, 12, 0xf2f2f2);
        list.push({ x, y: H.h - 0.6, z, ry: (x * 13) % 6 });
        B.box("lamp", x + 3, H.h - 0.35, z, 1.2, 0.06, 0.1, 0xffffff);
        ctx.pools.push({ x: x + 3, z, s: 0.9, y: H.h - 0.5 });
      });
    }
    const blade = new THREE.BoxGeometry(0.95, 0.02, 0.13);
    blade.translate(0.5, 0, 0);
    const g = mergeBlades(blade);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.4 });
    const im = P.instanced(g, mat, list, { cast: false });
    im.name = "hawkerFans";
    out.fans = { mesh: im, list };
  }
  function mergeBlades(blade) {
    const B = new P.Batch();
    [0, 1, 2].forEach((k) => B.geo("b", blade, P.compose(0, 0, 0, (k * Math.PI * 2) / 3, 1, 1, 1)));
    return B.build({ b: new THREE.MeshBasicMaterial() })[0].geometry;
  }

  /** One stall box: tiled walls, soffit, steel counter, signboard, number plate. */
  function stall(B, x0, x1, z0, st, idx, ctx) {
    const z1 = z0 + STALL_D;
    const xc = (x0 + x1) / 2;
    B.aabb("wallTile", x0, 0.14, z0, x1, 3.0, z0 + 0.2, 0xffffff);
    B.aabb("plaster", x0, 0.14, z0, x0 + 0.15, 3.0, z1, 0xf1ead8);
    B.aabb("plaster", x1 - 0.15, 0.14, z0, x1, 3.0, z1, 0xf1ead8);
    B.aabb("paint", x0, 2.9, z0, x1, 3.0, z1, 0xf4f1e8);
    B.aabb("metal", x0 + 0.15, 0.14, z1 - 0.7, x1 - 0.15, 0.95, z1 - 0.05, 0xc8ccd0);
    B.aabb("metal", x0 + 0.1, 0.95, z1 - 0.75, x1 - 0.1, 1.0, z1, 0xe0e3e6);
    B.box("glass", xc - 0.6, 1.25, z1 - 0.35, 1.8, 0.5, 0.55);
    B.box("lamp", xc, 2.85, z0 + 1.6, 2.4, 0.05, 0.12, 0xffffff);
    const uv = ctx.atlas.sign({ w: 4.4, h: 0.8, text: st.text, sub: st.sub, bg: st.bg, halal: true });
    B.plane("sign", xc, 3.45, z1 + 0.02, x1 - x0 - 0.2, 0.86, 0, uv);
    B.aabb("paint", x0, 3.0, z1 - 0.1, x1, 3.9, z1, 0xf1ead8);
    const menu = ctx.atlas.panel({ w: 2.6, h: 1.0, text: "MENU", sub: st.sub, bg: "#fbf6e6", bg2: "#efe4c8", fg: "#5a2a1a" });
    B.plane("decal", xc + 0.3, 2.25, z0 + 0.21, 2.2, 0.85, 0, menu);
    const plate = ctx.atlas.panel({ w: 0.8, h: 0.35, text: "#01-0" + (idx + 1), bg: "#f7f2e2", fg: "#333" });
    B.plane("decal", x0 + 0.55, 2.6, z1 + 0.01, 0.6, 0.26, 0, plate);
    return { x: xc, z: z1 + 0.9, counterZ: z1 };
  }

  /** Little props that say what each stall sells. */
  const PROPS = {
    stall_prata: (B, x, z) => {
      B.cyl("dark", x + 0.7, 1.02, z - 0.4, 0.45, 0.04, 20, 0x2a2a2a);
      for (let i = 0; i < 6; i++) B.geo("paint", sph(), P.compose(x - 0.9 + i * 0.12, 1.32, z - 0.35, 0, 0.6, 0.45, 0.6), 0xf3dfb0);
    },
    stall_nasi_lemak: (B, x, z) => {
      B.cyl("metal", x + 0.9, 1.15, z - 0.4, 0.28, 0.4, 14, 0xd8d8d8);
      [0x4f9d4f, 0xc8402e, 0xe8c070, 0x8a5a2b].forEach((c, i) => B.box("paint", x - 1.1 + i * 0.32, 1.06, z - 0.32, 0.28, 0.08, 0.3, c));
    },
    stall_mee_soto: (B, x, z) => {
      B.cyl("metal", x + 0.8, 1.3, z - 1.0, 0.38, 0.7, 16, 0xbfc3c7);
      B.cyl("metal", x - 0.9, 1.15, z - 1.0, 0.3, 0.4, 16, 0xbfc3c7);
      B.box("paint", x - 0.2, 1.06, z - 0.35, 0.6, 0.1, 0.3, 0xf0d060);
    },
    stall_drinks: (B, x, z) => {
      B.aabb("paint", x + 0.6, 0.14, z - 3.1, x + 1.9, 2.1, z - 2.4, 0xe9ecef);
      B.box("lamp", x + 1.25, 1.2, z - 2.38, 1.1, 1.6, 0.02, 0xdfefff);
      [0xb07a4a, 0x7a4a2a, 0xd9a066].forEach((c, i) => B.cyl("paint", x - 1.1 + i * 0.25, 1.1, z - 0.35, 0.07, 0.16, 10, c));
    },
    stall_satay: (B, x, z) => {
      B.aabb("dark", x - 1.6, 0.9, z - 0.65, x + 1.6, 1.05, z - 0.2, 0x2b2b2b);
      B.aabb("beacon", x - 1.5, 1.05, z - 0.6, x + 1.5, 1.08, z - 0.25, 0xff6a2a);
      for (let i = 0; i < 14; i++) B.box("wood", x - 1.4 + i * 0.21, 1.12, z - 0.42, 0.03, 0.03, 0.6, 0xa0582a);
    },
  };
  const sph = () => P.cached("sph8", () => new THREE.SphereGeometry(0.1, 10, 8));

  /** The five stalls along the north side; returns counter spots by stall id. */
  function stalls(B, H, L, ctx) {
    const w = (H.x1 - H.x0) / L.stalls.length;
    const spots = {};
    L.stalls.forEach((st, i) => {
      const x0 = H.x0 + i * w;
      const s = stall(B, x0, x0 + w, H.z0, st, i, ctx);
      PROPS[st.id](B, s.x, s.counterZ);
      spots[st.id] = s;
    });
    ctx.colliders.push({ minX: H.x0, maxX: H.x1, minZ: H.z0 - 0.3, maxZ: H.z0 + STALL_D, kind: "stalls" });
    const m = spots.stall_mee_soto;
    const d = spots.stall_drinks;
    const sa = spots.stall_satay;
    B.cyl("chrome", d.x - 0.2, 1.12, d.counterZ - 0.4, 0.12, 0.22, 12, 0xffffff);
    ctx.steam = [
      { x: m.x + 0.8, y: 1.75, z: m.counterZ - 1.0 }, { x: m.x - 0.9, y: 1.45, z: m.counterZ - 1.0 },
      { x: d.x - 0.2, y: 1.3, z: d.counterZ - 0.4 }, { x: sa.x, y: 1.2, z: sa.counterZ - 0.4 },
    ];
    const trayUV = ctx.atlas.panel({ w: 1.6, h: 0.5, text: "TRAY RETURN", sub: "Pulangkan dulang", bg: "#2f6b4a" });
    B.aabb("metal", H.x1 - 1.2, 0.14, H.z1 - 6, H.x1 - 0.3, 1.1, H.z1 - 3.5, 0xb8bcc0);
    B.plane("decal", H.x1 - 1.22, 1.6, H.z1 - 4.75, 1.4, 0.44, -Math.PI / 2, trayUV);
    ctx.colliders.push({ minX: H.x1 - 1.3, maxX: H.x1 - 0.2, minZ: H.z1 - 6.1, maxZ: H.z1 - 3.4, kind: "tray" });
    const tc = [0x2a7fc4, 0xd9473a, 0x3f9a5a, 0xf2c230];
    for (let k = 0; k < 4; k++) {
      for (let n = 0; n < 5; n++) B.box("plastic", H.x1 - 0.75, 1.13 + n * 0.025, H.z1 - 5.6 + k * 0.6, 0.36, 0.02, 0.5, tc[k]);
    }
    B.aabb("metal", H.x1 - 1.2, 1.1, H.z1 - 6, H.x1 - 1.15, 1.9, H.z1 - 3.5, 0x9aa0a6);
    B.aabb("metal", H.x1 - 1.2, 1.85, H.z1 - 6, H.x1 - 0.3, 1.9, H.z1 - 3.5, 0x9aa0a6);
    return spots;
  }

  /** Table sets (drawn by Props from ctx.tables), avoiding the aisle to the stalls. */
  function tables(H, ctx) {
    [H.x0 + 3, H.x0 + 7.5, H.x1 - 7.5, H.x1 - 3].forEach((x) => {
      [H.z0 + 6.4, H.z0 + 13.0, H.z0 + 17.2].forEach((z) => ctx.tables.push({ x, z, stone: false }));
    });
  }

  /** Build everything; returns { spots, fans }. */
  function build(B, ctx) {
    const H = ctx.L.hawker;
    const out = {};
    shell(B, H, ctx);
    fans(B, H, out, ctx);
    out.spots = stalls(B, H, ctx.L, ctx);
    tables(H, ctx);
    return out;
  }

  P.Hawker = { build, slope, STALL_D };
})((window.KQ = window.KQ || {}));
