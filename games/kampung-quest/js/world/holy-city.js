/* ============================================================================
 * FILE: holy-city.js
 * PURPOSE: The city around the holy sites (KQ.WorldParts.HolyCity): generic hotel, stone-clad and
 *          apartment blocks with podiums, setback towers, parapets and rooftop tanks / air-conditioners,
 *          and a block-filling pass that packs every free lot of a city (taller near the mosque,
 *          lower further out) plus a backdrop ring of taller blocks beyond the play bounds so the
 *          horizon is a skyline, not empty sand.
 * BUSINESS CONTEXT: owner feedback "the area outside the Haram should look like the real
 *   environment". All blocks are generic (no brand, no sign, no lettering) and merge into the
 *   world batch (the facade textures come from holy-facade.js).
 * DEPENDENCIES: holy-lots.js (free-lot test), holy-kit.js (solid), geo.js (Batch, rng).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const K = () => P.HolyKit;
  const FLOOR_H = 3.6;
  const STONE = [0xf3ead6, 0xefe2c8, 0xf6efe0, 0xe9dcc0];
  const PAINT = [0xf0e3c6, 0xe8d6b0, 0xf2ead8, 0xe4d2ae];
  const GLASS = [0xf4f1ea, 0xe9eef0, 0xf6efe0];

  /** Snap a height to whole floors (at least 3). */
  const floors = (h) => Math.max(3, Math.round(h / FLOOR_H)) * FLOOR_H;

  /** Roof slab with a parapet. */
  function roofCap(B, x0, z0, x1, z1, y) {
    B.aabb("concrete", x0 - 0.3, y, z0 - 0.3, x1 + 0.3, y + 0.5, z1 + 0.3, 0xcfc7b4);
  }

  /** Rooftop clutter: a stair box, white water tanks and grey air-conditioner units. */
  function rooftop(B, o, y, r) {
    const w = o.x1 - o.x0;
    const d = o.z1 - o.z0;
    const cx = o.x0 + w * (0.25 + r() * 0.5);
    const cz = o.z0 + d * (0.25 + r() * 0.5);
    B.aabb("whitePlaster", cx - 2, y + 0.5, cz - 1.6, cx + 2, y + 3.1, cz + 1.6, 0xe9e0cc);
    const tank = Math.min(3, 1 + Math.floor(w / 14));
    for (let i = 0; i < tank; i += 1) {
      B.cyl("plastic", o.x0 + 3 + i * 3.2, y + 1.5, o.z0 + 3, 1.05, 2, 10, 0xf2f2ee);
    }
    for (let i = 0; i < 4; i += 1) {
      B.aabb(
        "metal",
        o.x1 - 3.5,
        y + 0.5,
        o.z0 + 2 + i * 2.2,
        o.x1 - 2,
        y + 1.6,
        o.z0 + 3.4 + i * 2.2,
        0xb8bec2,
      );
    }
  }

  /** A hotel crown: a stepped cream cap on the tallest blocks. */
  function crown(B, o, y) {
    const mx = (o.x0 + o.x1) / 2;
    const mz = (o.z0 + o.z1) / 2;
    B.aabb("paint", mx - 4.5, y + 0.5, mz - 4.5, mx + 4.5, y + 4.5, mz + 4.5, 0xd9c89c);
    B.aabb("gold", mx - 4.9, y + 4.5, mz - 4.9, mx + 4.9, y + 5, mz + 4.9, 0xd9b04a);
    B.cyl("metal", mx, y + 9.5, mz, 0.25, 9, 6, 0xaab0b6);
  }

  /**
   * One block: a podium and a setback tower in the style's facade, a roof cap and rooftop clutter.
   * o = { x0, z0, x1, z1, h, style, seed, solid }.
   */
  function block(c, o) {
    const B = c.B;
    const r = P.rng(o.seed);
    const pod = Math.min(o.h, FLOOR_H * (o.h > 40 ? 4 : 2));
    const tint = (o.style === "hotel" ? GLASS : o.style === "apartment" ? PAINT : STONE)[
      o.seed % 3
    ];
    const podKey = o.style === "apartment" ? "apartment" : "stoneHotel";
    B.aabb(
      podKey,
      o.x0,
      0,
      o.z0,
      o.x1,
      pod,
      o.z1,
      o.style === "apartment" ? tint : STONE[o.seed % 4],
    );
    if (o.h > pod) {
      const ix = Math.min(3, (o.x1 - o.x0) * 0.12);
      const iz = Math.min(3, (o.z1 - o.z0) * 0.12);
      B.aabb(o.style, o.x0 + ix, pod, o.z0 + iz, o.x1 - ix, o.h, o.z1 - iz, tint);
      roofCap(B, o.x0 + ix, o.z0 + iz, o.x1 - ix, o.z1 - iz, o.h);
      rooftop(B, { x0: o.x0 + ix, z0: o.z0 + iz, x1: o.x1 - ix, z1: o.z1 - iz }, o.h, r);
    } else {
      roofCap(B, o.x0, o.z0, o.x1, o.z1, o.h);
      rooftop(B, o, o.h, r);
    }
    if (o.h > 70 && r() < 0.5) crown(B, o, o.h + 0.5);
    if (o.solid) K().solid(c.colliders, o.x0, o.z0, o.x1, o.z1, "tower");
  }

  /** Limestone forecourt around a block (a walkable pad, so the blocks do not stand straight in sand). */
  function pad(B, o) {
    B.aabb("limestone", o.x0 - 3, 0, o.z0 - 3, o.x1 + 3, 0.12, o.z1 + 3, 0xe4d8bd);
  }

  /** Style from height: tall blocks are glass or stone hotels, mid-rise stone, low-rise apartments. */
  function styleFor(h, r) {
    if (h >= 50) return r() < 0.55 ? "hotel" : "stoneHotel";
    if (h >= 25) return r() < 0.5 ? "stoneHotel" : "apartment";
    return "apartment";
  }

  /** Height for a lot at distance `d` from the mosque: taller close in, lower further out. */
  function heightAt(d, r, cfg) {
    const base = cfg.hBase - d * cfg.hFall;
    return Math.min(cfg.hMax, Math.max(10.8, floors(base * (0.55 + r() * 0.9))));
  }

  /** Try to place a block in cell (cx, cz); returns true when it fits (free lot, clear of the rest). */
  function tryCell(c, cfg, free, r, cx, cz) {
    const w = cfg.cell[0] * (0.45 + r() * 0.3);
    const d = cfg.cell[1] * (0.45 + r() * 0.3);
    const x0 = cx + (cfg.cell[0] - w) * (0.15 + r() * 0.7);
    const z0 = cz + (cfg.cell[1] - d) * (0.15 + r() * 0.7);
    const box = { x0, z0, x1: x0 + w, z1: z0 + d };
    if (!free(box.x0, box.z0, box.x1, box.z1, 3)) return false;
    const dist = Math.hypot(cfg.origin[0] - (x0 + w / 2), cfg.origin[1] - (z0 + d / 2));
    box.h = heightAt(dist, r, cfg);
    box.style = styleFor(box.h, r);
    box.seed = Math.floor(r() * 1e6);
    box.solid = cfg.solid;
    block(c, box);
    if (cfg.pads) pad(c.B, box);
    free.addBuilt(x0 - 3, z0 - 3, x0 + w + 3, z0 + d + 3);
    return true;
  }

  /**
   * Fill the rectangle `area` ({x0, z0, x1, z1}) with blocks on a jittered grid. `keepIf(x, z)`
   * may veto a cell (the backdrop ring stays inside the hills). Returns how many blocks were placed.
   */
  function fill(c, cfg, free, area, keepIf) {
    const r = P.rng(cfg.seed);
    let n = 0;
    for (let x = area.x0; x < area.x1; x += cfg.cell[0]) {
      for (let z = area.z0; z < area.z1; z += cfg.cell[1]) {
        const ok =
          r() < cfg.density && (!keepIf || keepIf(x + cfg.cell[0] / 2, z + cfg.cell[1] / 2));
        if (ok && tryCell(c, cfg, free, r, x, z)) n += 1;
      }
    }
    return n;
  }

  P.HolyCity = { block, fill, pad, floors, FLOOR_H };
})((window.KQ = window.KQ || {}));
