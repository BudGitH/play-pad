/* Kampung Quest — HDB slab blocks (KQ.WorldParts.HDB): open void deck with pillars, lift
   lobby, letterboxes and stone table sets; 9–12 residential floors with a common corridor
   (parapets, rails, flat doors with gates, kitchen windows) on one side and window bays with
   AC ledges, drying poles, laundry and window grilles on the other; the repaint scheme of a
   real estate: white floor lines, pastel walls, an accent band every fourth floor and a
   contrasting stair / lift core with the big painted block number near the roof; painted
   gable bands with the number, and a roof with parapet, a water tank on legs and the lift
   motor room. The void deck is dressed in hdb-deck.js. Reference: sg-reference.md. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const VOID_H = 3.4;
  const FLOOR_H = 2.5;
  const CORR = 1.6;
  const BAY = 4;
  const TRIM = 0xfbf7ee; // the white floor lines / parapets of a repainted block
  const accent = (i) => i % 4 === 3; // every fourth floor carries the block's accent band

  /** Derived frame for a block spec. */
  function frame(b) {
    const s = b.corridor === "+z" ? 1 : -1;
    const zc = s > 0 ? b.z1 : b.z0;
    return {
      b,
      s,
      zc,
      zw: zc - s * CORR,
      zb: s > 0 ? b.z0 : b.z1,
      xc: (b.x0 + b.x1) / 2,
      top: VOID_H + b.floors * FLOOR_H,
      bays: Math.floor((b.x1 - b.x0) / BAY),
      faceOut: s > 0 ? 0 : Math.PI,
      faceBack: s > 0 ? Math.PI : 0,
    };
  }
  const bayX = (f, i) => f.b.x0 + (f.b.x1 - f.b.x0 - f.bays * BAY) / 2 + (i + 0.5) * BAY;

  /** Ground floor: tiled void deck, pillars (colliders), slab overhead. */
  function voidDeck(B, f, col, ctx) {
    const b = f.b;
    // Light cream terrazzo (AC-P20): the brown speckled tiles read muddy in the deck's shade.
    B.aabb("terrazzo", b.x0 - 1, 0, b.z0 - 1, b.x1 + 1, 0.14, b.z1 + 1, 0xffe2bd);
    const rows = [b.z0 + 0.5, (b.z0 + b.z1) / 2, b.z1 - 0.5];
    for (let x = b.x0 + 0.5; x <= b.x1 - 0.4; x += BAY) {
      rows.forEach((z, ri) => {
        if (ri === 1 && Math.abs(x - f.xc) < 4) return;
        B.box("plaster", x, VOID_H / 2, z, 0.6, VOID_H, 0.6, TRIM);
        B.box("plaster", x, 0.55, z, 0.63, 1.1, 0.63, b.dado || b.wall);
        B.box("paint", x, 1.16, z, 0.64, 0.12, 0.64, b.band);
        P.collide(col, x - 0.35, x + 0.35, z - 0.35, z + 0.35, "pillar");
      });
    }
    B.aabb("concrete", b.x0, VOID_H - 0.35, b.z0, b.x1, VOID_H, b.z1, 0xe8e6e0);
    const zm = (b.z0 + b.z1) / 2;
    const down = [Math.PI / 2, 0, 0];
    B.plane("paint", f.xc, VOID_H - 0.36, zm, b.x1 - b.x0, b.z1 - b.z0, down, null, 0xfffdf6);
    for (let x = b.x0 + 2.5; x < b.x1 - 1; x += 6) {
      [b.z0 + 2.2, b.z1 - 2.2].forEach((z) => {
        B.box("lamp", x, VOID_H - 0.38, z, 1.2, 0.05, 0.12, 0xffffff);
        ctx.pools.push({ x, z, s: 0.75, y: VOID_H - 0.5 });
      });
    }
  }

  /** Lift core rising through the block; lift doors + letterboxes on the void deck. */
  function liftCore(B, f, col, ctx) {
    const b = f.b;
    const z0 = Math.min(f.zw, f.zb) + 2;
    const z1 = Math.max(f.zw, f.zb) - 2;
    B.aabb("plaster", f.xc - 2.6, 0, z0, f.xc + 2.6, f.top + 2.8, z1, b.wall);
    B.aabb("plaster", f.xc - 2.62, 0, z0 - 0.02, f.xc + 2.62, 1.0, z1 + 0.02, b.band);
    P.collide(col, f.xc - 2.7, f.xc + 2.7, z0 - 0.1, z1 + 0.1, "core");
    const fz = f.s > 0 ? z1 + 0.02 : z0 - 0.02;
    [-1.2, 1.2].forEach((dx) => {
      B.box("metal", f.xc + dx, 1.15, fz, 1.0, 2.1, 0.06, 0xc9ccd0, f.faceOut);
      B.box("paint", f.xc + dx, 1.15, fz + f.s * 0.01, 0.03, 2.1, 0.07, 0x3b3f44, f.faceOut);
    });
    B.box("lamp", f.xc, 1.3, fz + f.s * 0.03, 0.12, 0.2, 0.03, 0xffffff, f.faceOut);
    B.plane(
      "decal",
      f.xc,
      2.55,
      fz + f.s * 0.04,
      1.8,
      0.62,
      f.faceOut,
      ctx.atlas.panel({ w: 2.4, h: 0.8, text: "BLK " + b.num, sub: "Lift · Lif", bg: b.band }),
    );
    const bz = f.s > 0 ? z0 - 0.03 : z1 + 0.03;
    B.plane("decal", f.xc, 1.45, bz, 3.6, 1.8, f.faceBack, ctx.letterUV);
    if (P.Life) {
      const uv = (ctx.noticeUV = ctx.noticeUV || P.Life.noticeUV(ctx.atlas));
      B.plane("decal", f.xc - 2.668, 1.55, (z0 + z1) / 2, 1.6, 1.07, -Math.PI / 2, uv);
      B.box("metal", f.xc - 2.64, 1.55, (z0 + z1) / 2, 0.04, 1.13, 1.66, 0x4a5562);
    }
    return { x: f.xc, z: fz + f.s * 0.9, facing: f.s > 0 ? 0 : Math.PI };
  }

  /** Per-floor corridor: slab, parapet with colour stripe, rail, doors + kitchen windows. */
  function corridorFloor(B, f, y, rnd, i) {
    const b = f.b;
    const zo = f.zc;
    const s = f.s;
    const xm = (b.x0 + b.x1) / 2;
    const len = b.x1 - b.x0;
    const ac = accent(i);
    B.aabb("concrete", b.x0, y - 0.22, Math.min(zo, f.zw), b.x1, y, Math.max(zo, f.zw), 0xdedbd4);
    B.box("plaster", xm, y - 0.11, zo + s * 0.02, len + 0.04, 0.24, 0.06, TRIM);
    B.box("plaster", xm, y + 0.45, zo - s * 0.08, len, 0.9, 0.16, ac ? b.band : TRIM);
    B.box("plaster", xm, y + 0.86, zo - s * 0.04, len + 0.02, 0.1, 0.1, ac ? TRIM : b.band);
    B.plane("railing", xm, y + 1.08, zo - s * 0.08, len, 0.34, f.faceOut, null, 0x8d949a);
    for (let i = 0; i < f.bays; i++) corridorBay(B, f, y, bayX(f, i), rnd);
  }
  /** One flat along the corridor: door + gate, kitchen window, the odd potted plant. */
  function corridorBay(B, f, y, x, rnd) {
    const s = f.s;
    const zf = f.zw + s * 0.02;
    const out = f.faceOut;
    if (rnd() < 0.4) B.plane("streak", x, y - 0.1, f.zc + s * 0.012, 2.2, 1.7, out, null, 0xffffff);
    if (Math.abs(x - f.xc) < 2.8) return;
    B.plane("window", x - 0.8, y + 0.95, zf, 1.0, 1.9, out, f.win.uv(8 + Math.floor(rnd() * 4)));
    const key = rnd() < 0.38 ? "windowLit" : "window";
    B.plane(key, x + 0.75, y + 1.45, zf, 1.1, 0.8, out, f.win.uv(Math.floor(rnd() * 8)));
    const pot = rnd() < 0.5 ? 0x3c8a3a : 0xb0603a;
    if (rnd() < 0.45) {
      B.box("plastic", x - 0.1, y + 0.2, f.zw + s * 0.3, 0.3, 0.4, 0.3, pot);
      B.box("hedge", x - 0.1, y + 0.55, f.zw + s * 0.3, 0.42, 0.4, 0.4, 0xd8e8c8);
    }
    if (rnd() < 0.4) shoeRack(B, x - 1.55, y, f.zw + s * 0.22, rnd);
  }

  /** Low shoe rack by a flat door with a few pairs of slippers and shoes on it. */
  function shoeRack(B, x, y, z, rnd) {
    B.box("metal", x, y + 0.25, z, 0.6, 0.5, 0.26, 0x9aa3ab);
    for (let k = 0; k < 3; k++) {
      const c = [0x2a2a2a, 0x3f6fb0, 0xd9663a, 0xe8e8e8][Math.floor(rnd() * 4)];
      B.box("paint", x - 0.18 + k * 0.18, y + 0.53, z, 0.12, 0.05, 0.22, c);
      if (rnd() < 0.5) B.box("paint", x - 0.18 + k * 0.18, y + 0.03, z + 0.2, 0.12, 0.04, 0.24, c);
    }
  }

  /** Back facade: window bays, floor bands, AC ledges, drying poles + laundry. */
  function backFloor(B, f, y, rnd, fl) {
    const b = f.b;
    const s = f.s;
    const zf = f.zb - s * 0.02;
    const [bh, bc] = accent(fl) ? [0.5, b.band] : [0.22, TRIM];
    B.box("plaster", (b.x0 + b.x1) / 2, y - 0.1, f.zb - s * 0.1, b.x1 - b.x0, bh, 0.2, bc);
    for (let i = 0; i < f.bays; i++) {
      const x = bayX(f, i);
      if (Math.abs(x - f.xc) < 2.8) continue; // the stair / lift core strip (coreFaces)
      [-0.95, 0.95].forEach((dx) => {
        const key = rnd() < 0.4 ? "windowLit" : "window";
        B.plane(key, x + dx, y + 1.35, zf, 1.25, 1.25, f.faceBack, f.win.uv(Math.floor(rnd() * 8)));
        if (fl < 5 && rnd() < 0.4) grille(B, x + dx, y + 1.35, f.zb - s * 0.06, f.faceBack);
        B.box("concrete", x + dx, y + 0.68, f.zb - s * 0.09, 1.45, 0.07, 0.18, 0xd5d1c8);
        B.box("concrete", x + dx, y + 2.03, f.zb - s * 0.12, 1.5, 0.08, 0.26, 0xd5d1c8);
        [-0.68, 0.68].forEach((o) =>
          B.box("concrete", x + dx + o, y + 1.35, f.zb - s * 0.05, 0.08, 1.36, 0.1, 0xe0ddd6),
        );
      });
      if (rnd() < 0.55)
        B.plane("streak", x, y - 0.15, f.zb - s * 0.025, 1.3, 1.6, f.faceBack, null, 0xffffff);
      B.box("concrete", x, y + 0.6, f.zb - s * 0.35, 1.2, 0.08, 0.7, 0xd8d5ce);
      if (rnd() < 0.6) B.box("paint", x, y + 0.88, f.zb - s * 0.38, 0.8, 0.5, 0.45, 0xe9eaea);
      if (rnd() < 0.5) laundry(B, x + 0.95, y + 2.0, f.zb, -s, rnd);
      if (i % 2 === 0)
        B.box("plaster", x - BAY / 2, y + FLOOR_H / 2, f.zb - s * 0.2, 0.3, FLOOR_H, 0.4, b.wall);
    }
  }
  /** Window grille (the painted steel grilles of lower-floor flats). */
  function grille(B, x, y, z, rot) {
    B.plane("railing", x, y, z, 1.25, 1.25, rot, null, 0xf4f1ea);
  }
  const CLOTHES = [0xd94f4f, 0x3f7fd0, 0xf2d24b, 0xffffff, 0x6fbf73, 0xf29ac0, 0x8a6bd1, 0x2b3a55];
  /** Bamboo drying poles pushed out of the window holders (dir = outward Z) with garments. */
  function laundry(B, x, y, zf, dir, rnd) {
    const n = 2 + Math.floor(rnd() * 2);
    for (let p = 0; p < n; p++) {
      const px = x - 0.35 + p * 0.35;
      const len = 1.3 + rnd() * 0.3;
      B.box("metal", px, y - 0.12, zf + dir * 0.08, 0.05, 0.05, 0.16, 0x8a9096);
      B.box("wood", px, y, zf + dir * (len / 2), 0.035, 0.035, len, 0xc9b37a);
      let z = 0.25;
      while (z < len - 0.2 && rnd() < 0.85) {
        const w = 0.22 + rnd() * 0.3;
        const h = 0.35 + rnd() * 0.45;
        const c = CLOTHES[Math.floor(rnd() * CLOTHES.length)];
        B.box("paint", px, y - h / 2 - 0.02, zf + dir * (z + w / 2), 0.015, h, w, c);
        z += w + 0.05;
      }
    }
  }

  /** Gable ends: painted vertical bands and the block number near the top. */
  function gables(B, f, ctx) {
    const b = f.b;
    const zmid = (b.z0 + b.z1) / 2;
    const depth = Math.abs(f.zw - f.zb);
    const zbody = (f.zw + f.zb) / 2;
    [-1, 1].forEach((side) => {
      const x = side < 0 ? b.x0 : b.x1;
      const rot = side < 0 ? -Math.PI / 2 : Math.PI / 2;
      B.box(
        "plaster",
        x + side * 0.08,
        (VOID_H + f.top) / 2,
        zbody,
        0.16,
        f.top - VOID_H,
        depth * 0.38,
        b.band,
      );
      B.box(
        "plaster",
        x + side * 0.1,
        (VOID_H + f.top) / 2,
        zbody + depth * 0.3,
        0.12,
        f.top - VOID_H,
        0.5,
        b.band,
      );
      B.plane(
        "decal",
        x + side * 0.18,
        f.top - 2.2,
        zmid,
        3.2,
        2.4,
        rot,
        ctx.atlas.blockNumber(b.num, "#ffffff", b.band),
      );
    });
  }

  /** Roof: slab, parapet, water tank and motor room on the core. */
  function roof(B, f) {
    const b = f.b;
    B.aabb(
      "concrete",
      b.x0 - 0.1,
      f.top,
      b.z0 - 0.1,
      b.x1 + 0.1,
      f.top + 0.3,
      b.z1 + 0.1,
      0xd9d6cf,
    );
    B.aabb(
      "plaster",
      b.x0 - 0.1,
      f.top + 0.3,
      b.z0 - 0.1,
      b.x1 + 0.1,
      f.top + 1.1,
      b.z0 + 0.1,
      b.band,
    );
    B.aabb(
      "plaster",
      b.x0 - 0.1,
      f.top + 0.3,
      b.z1 - 0.1,
      b.x1 + 0.1,
      f.top + 1.1,
      b.z1 + 0.1,
      b.band,
    );
    B.aabb("plaster", b.x0 - 0.1, f.top + 0.3, b.z0, b.x0 + 0.1, f.top + 1.1, b.z1, b.band);
    B.aabb("plaster", b.x1 - 0.1, f.top + 0.3, b.z0, b.x1 + 0.1, f.top + 1.1, b.z1, b.band);
    B.box("plaster", f.xc, f.top + 4.4, (b.z0 + b.z1) / 2, 4.2, 1.6, 3.6, b.wall);
    waterTank(B, f.xc + 8, f.top + 0.3, (b.z0 + b.z1) / 2);
  }
  /** Rooftop water tank: a pale tank on four legs with a ladder. */
  function waterTank(B, x, y, z) {
    [-1.1, 1.1].forEach((dx) =>
      [-0.9, 0.9].forEach((dz) =>
        B.box("metal", x + dx, y + 0.6, z + dz, 0.14, 1.2, 0.14, 0x9aa0a6),
      ),
    );
    B.box("plaster", x, y + 2.0, z, 2.6, 1.6, 2.2, 0xeef0ec);
    B.box("plaster", x, y + 2.86, z, 2.7, 0.12, 2.3, 0xd5d8d4);
    for (let k = 0; k < 6; k++)
      B.box("metal", x - 1.38, y + 0.3 + k * 0.42, z, 0.04, 0.04, 0.5, 0x9aa0a6);
  }

  /**
   * The stair / lift core seen from outside: a contrasting painted strip proud of the corridor
   * face and of the back face, with breeze-block stair openings and the big block number near
   * the roof (as painted on real blocks).
   */
  function coreFaces(B, f, ctx) {
    const b = f.b;
    const h = f.top + 2.8 - VOID_H;
    const uv = ctx.atlas.coreNumber(b.num, b.core, "#ffffff");
    [
      [f.zc + f.s * 0.12, f.faceOut],
      [f.zb - f.s * 0.12, f.faceBack],
    ].forEach(([z, rot]) => {
      B.box("plaster", f.xc, VOID_H + h / 2, z, 5.4, h, 0.24, b.core);
      const zf = z + Math.cos(rot) * 0.125;
      for (let i = 0; i < b.floors; i++) slits(B, f.xc, VOID_H + i * FLOOR_H, zf, rot);
      B.plane("decal", f.xc, f.top + 0.9, zf + Math.cos(rot) * 0.01, 2.0, 3.0, rot, uv);
    });
  }
  /** Two breeze-block stair openings on one floor of the core. */
  function slits(B, x, y, z, rot) {
    [-1.4, 1.4].forEach((dx) => B.plane("dark", x + dx, y + 1.5, z, 1.5, 0.5, rot, null, 0x5b6470));
  }

  /** Build one block; returns its lift-door spot (the "home door" for block A). */
  function block(B, spec, ctx) {
    const f = frame(spec);
    f.win = ctx.win;
    const rnd = P.rng(spec.num * 7);
    voidDeck(B, f, ctx.colliders, ctx);
    const lift = liftCore(B, f, ctx.colliders, ctx);
    B.aabb(
      "plaster",
      spec.x0,
      VOID_H,
      Math.min(f.zw, f.zb),
      spec.x1,
      f.top,
      Math.max(f.zw, f.zb),
      spec.wall,
    );
    for (let i = 0; i < spec.floors; i++) {
      const y = VOID_H + i * FLOOR_H;
      corridorFloor(B, f, y, rnd, i);
      backFloor(B, f, y, rnd, i);
    }
    gables(B, f, ctx);
    roof(B, f);
    coreFaces(B, f, ctx);
    const zt = (spec.z0 + spec.z1) / 2;
    const stones = [
      { x: bayX(f, 1), z: zt, stone: true },
      { x: bayX(f, f.bays - 2), z: zt, stone: true },
    ];
    ctx.tables.push(...stones);
    if (P.HdbDeck) P.HdbDeck.dress(B, f, ctx, stones);
    return { lift, frame: f };
  }

  P.HDB = { block, VOID_H, FLOOR_H, BAY };
})((window.KQ = window.KQ || {}));
