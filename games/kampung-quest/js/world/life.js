/* Kampung Quest — lived-in clutter (KQ.WorldParts.Life): drinks (canned soft drinks, teh /
   kopi glasses, soya and chrysanthemum packs — no pork, no alcohol) and "chope" tissue packets
   on the hawker tables, resting pigeons (static) on floors, ledges and parapets, void-deck
   notice boards, and grey satay-grill smoke (animated with `animateSmoke`). Everything small
   is instanced: one draw call per kind. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const TOP = 0.895; // hawker table-top height

  /** A small canned drink / glass / packet placed on a table top. */
  const DRINKS = [
    { c: 0xc8202a, r: 0.033, h: 0.12 }, // red soft-drink can
    { c: 0x2f8a3c, r: 0.033, h: 0.12 }, // green soda can
    { c: 0xe8c23a, r: 0.033, h: 0.12 }, // chrysanthemum-tea can
    { c: 0xc8a070, r: 0.04, h: 0.11 }, // teh tarik in a glass mug
    { c: 0x3b2416, r: 0.04, h: 0.1 }, // kopi in a glass
    { c: 0xf2efe6, r: 0.035, h: 0.13 }, // soya bean drink cup
  ];

  /** Drinks, trays and tissue packets on the hawker tables (seeded, ~60% of tables). */
  function tableTops(group, mats, tables) {
    const r = P.rng(555);
    const cans = [];
    const packs = [];
    tables
      .filter((t) => !t.stone)
      .forEach((t) => {
        if (r() < 0.35) packs.push(packet(t, r)); // "chope": a tissue packet reserves the seat
        const n = r() < 0.4 ? 0 : 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) cans.push(drink(t, r));
      });
    const canGeo = P.cached("can", () => new THREE.CylinderGeometry(1, 1, 1, 12));
    const a = P.instanced(canGeo, mats.plastic, cans, { cast: false });
    a.name = "tableDrinks";
    const box = P.cached("box", () => new THREE.BoxGeometry(1, 1, 1));
    const b = P.instanced(box, mats.plastic, packs, { cast: false });
    b.name = "chopePackets";
    group.add(a, b);
  }
  function drink(t, r) {
    const d = DRINKS[Math.floor(r() * DRINKS.length)];
    const a = r() * Math.PI * 2;
    const rad = 0.18 + r() * 0.3;
    const x = t.x + Math.cos(a) * rad;
    const z = t.z + Math.sin(a) * rad;
    return { x, y: TOP + d.h / 2, z, sx: d.r, sy: d.h, sz: d.r, color: d.c };
  }
  function packet(t, r) {
    const a = r() * Math.PI * 2;
    const tint = [0xffffff, 0xf6d6e2, 0xd6e6f6, 0xfff2c8][Math.floor(r() * 4)];
    const x = t.x + Math.cos(a) * 0.42;
    const z = t.z + Math.sin(a) * 0.42;
    return { x, y: TOP + 0.013, z, ry: a, sx: 0.11, sy: 0.026, sz: 0.075, color: tint };
  }

  /** One merged pigeon (body, head, beak, tail), ~0.3 m long, facing +X. */
  function pigeonGeo() {
    return P.cached("pigeon", () => {
      const B = new P.Batch();
      const s = new THREE.SphereGeometry(1, 10, 8);
      B.geo("p", s, P.compose(0, 0.12, 0, 0, 0.14, 0.085, 0.08), 0xffffff);
      B.geo("p", s, P.compose(0.11, 0.2, 0, 0, 0.045, 0.045, 0.042), 0xd8dce4);
      B.geo("p", s, P.compose(0.16, 0.2, 0, 0, 0.022, 0.01, 0.01), 0x404040);
      B.box("p", -0.15, 0.12, 0, 0.12, 0.02, 0.07, 0x707880, [0, 0, 0.25]);
      B.box("p", 0.0, 0.03, 0.025, 0.012, 0.06, 0.012, 0xc05050);
      B.box("p", 0.0, 0.03, -0.025, 0.012, 0.06, 0.012, 0xc05050);
      return B.build({ p: new THREE.MeshBasicMaterial() })[0].geometry;
    });
  }

  /** Pigeon spots: hawker floor, void decks, plazas, the mosque courtyard, a few parapets. */
  function pigeonSpots(L) {
    const r = P.rng(777);
    const out = [];
    const flock = (cx, cz, n, y, spread) => {
      for (let k = 0; k < n; k++)
        out.push({ x: cx + (r() - 0.5) * spread, y, z: cz + (r() - 0.5) * spread, ry: r() * 6 });
    };
    const H = L.hawker;
    flock((H.x0 + H.x1) / 2, H.z1 - 2.5, 5, 0.14, 5);
    flock(H.x1 + 1, H.z1 + 1.5, 4, 0.14, 2.5);
    L.blocks.forEach((b) => flock(b.x0 + 3, (b.z0 + b.z1) / 2 + 2.5, 3, 0.14, 3));
    flock(-20, -30, 5, 0.12, 4);
    flock(21, 4.6, 3, 0.12, 2);
    L.blocks.forEach((b, i) => {
      const top = (P.HDB ? P.HDB.VOID_H + b.floors * P.HDB.FLOOR_H : 30) + 1.1;
      for (let k = 0; k < 4; k++)
        out.push({ x: b.x0 + 4 + k * 0.6 + i, y: top, z: b.z0, ry: Math.PI / 2 });
    });
    return out;
  }

  /** Resting pigeons in slate, ash and chequered greys (one instanced draw). */
  function pigeons(group, mats, L) {
    const tones = [0x8e96a2, 0x7d8591, 0xa3a9b2, 0x6c727c, 0xb4b6ba];
    const list = pigeonSpots(L).map((p, i) => Object.assign(p, { color: tones[i % tones.length] }));
    const im = P.instanced(pigeonGeo(), mats.plastic, list, { cast: false });
    im.name = "pigeons";
    group.add(im);
    return im;
  }

  /** Billowy smoke puff: a cluster of soft blobs (denser than the steam puff). */
  function smokeTex() {
    const c = P.Canvas.canvas(128, 128);
    const ctx = c.getContext("2d");
    const r = P.rng(12);
    for (let k = 0; k < 9; k++) {
      const x = 40 + r() * 48;
      const y = 40 + r() * 48;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 26 + r() * 14);
      g.addColorStop(0, "rgba(255,255,255,0.6)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    return P.Canvas.tex(c, true);
  }

  /** Satay-grill smoke: bigger, greyer, drifting puffs (sprites). */
  function smoke(group, spot) {
    if (!spot) return [];
    const mat = new THREE.SpriteMaterial({
      map: smokeTex(),
      color: 0xc4c0ba,
      transparent: true,
      depthWrite: false,
      opacity: 0.35,
    });
    const list = [];
    for (let k = 0; k < 7; k++) {
      const s = new THREE.Sprite(mat.clone()); // own material: per-puff fading opacity
      s.userData = { base: spot, phase: k / 7 };
      s.name = "sataySmoke";
      group.add(s);
      list.push(s);
    }
    return list;
  }
  function animateSmoke(list, t) {
    (list || []).forEach((s) => {
      const u = (t * 0.22 + s.userData.phase) % 1;
      const b = s.userData.base;
      s.position.set(
        b.x + u * 0.9 + Math.sin(u * 5 + s.userData.phase * 9) * 0.2,
        b.y + 0.1 + u * 2.4,
        b.z + u * 0.4,
      );
      s.scale.setScalar(0.6 + u * 2.0);
      s.material.opacity = 0.85 * (1 - u * 0.7);
    });
  }

  /** Notice board panel (cork board under glass, pinned colourful notices) via the atlas. */
  function noticeUV(atlas) {
    const s = atlas.alloc(300, 200);
    const ctx = atlas.ctx;
    ctx.fillStyle = "#3a4a5c";
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = "#b8935e";
    ctx.fillRect(s.x + 10, s.y + 10, s.w - 20, s.h - 20);
    const r = P.rng(3);
    const cols = ["#f4f1e8", "#fff3a8", "#cfe8ff", "#ffd7d7", "#d8f0d0", "#ffffff"];
    for (let k = 0; k < 9; k++) {
      const w = 50 + r() * 40;
      const h = 60 + r() * 50;
      const x = s.x + 16 + r() * (s.w - 32 - w);
      const y = s.y + 16 + r() * (s.h - 32 - h);
      ctx.fillStyle = cols[k % cols.length];
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(60,60,70,0.55)";
      for (let l = y + 10; l < y + h - 8; l += 7) ctx.fillRect(x + 6, l, w * (0.4 + r() * 0.45), 2);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(x + w / 2 - 2, y + 2, 4, 4);
    }
    return s.uv;
  }

  P.Life = { tableTops, pigeons, smoke, animateSmoke, noticeUV, DRINKS };
})((window.KQ = window.KQ || {}));
