/* ============================================================================
 * FILE: tailor.js
 * PURPOSE: Kampung Quest — the tailor's stall (KQ.WorldParts.Tailor): a small three-sided kiosk with a striped
 *          canopy, a signboard, a counter and a rail of coloured clothes. One builder serves every region:
 *          the kampung park edge, the Makkah plaza street and the Madinah bus-stop street. The hero stands
 *          at the counter (`stand`) and the "Change clothes" prompt opens the wardrobe sheet.
 *          Layout: `x` is the stall's centre, `z` the front line, `face` +1 when the front looks towards +Z
 *          (south), -1 towards -Z. The stall reaches 3 m back from the front line; its canopy hangs 0.9 m in
 *          front of it, over the spot where the hero stands.
 * BUSINESS CONTEXT: AC-R5 (realism round, features/kampung-quest-realism/requirements.md): a place in each region where the hero
 *   can change clothes; it needs to be findable, reachable (stand spot outside the no-drive plaza) and child-friendly.
 * DEPENDENCIES: KQ.WorldParts (builder B, geo helpers), games/kampung-quest/js/game/wardrobe.js (the sheet the stall opens).
 * HOW TO TEST: npx playwright test tests/kampung-quest-wardrobe.spec.mjs (each region's stall opens the wardrobe).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const HALF = 3.1;
  const DEPTH = 3.0;
  const WALL_H = 3.2;
  /** Bright toy colours for the hanging clothes (all modest shapes: robes, tunics, tees). */
  const CLOTHES = [0x1d4fc6, 0xe8a21a, 0x2f8f5b, 0xd8403a, 0x7a4fc2, 0x14958a, 0xee7b2d];

  /** A box from local coordinates: u across, v from the front line backwards, y up. */
  function local(B, s, key, u0, u1, v0, v1, y0, y1, color) {
    const za = s.z - s.face * v0;
    const zb = s.z - s.face * v1;
    B.aabb(key, s.x + u0, y0, Math.min(za, zb), s.x + u1, y1, Math.max(za, zb), color);
  }

  /** Floor, back and side walls, canopy and its striped front band. */
  function shell(B, s) {
    local(B, s, "tiles", -HALF - 0.4, HALF + 0.4, -1.0, DEPTH + 0.2, 0, 0.1, 0xf4ede0);
    local(B, s, "plaster", -HALF, HALF, DEPTH - 0.2, DEPTH, 0.1, WALL_H, 0xf3e6c8);
    local(B, s, "plaster", -HALF, -HALF + 0.2, 0, DEPTH, 0.1, WALL_H, 0xf3e6c8);
    local(B, s, "plaster", HALF - 0.2, HALF, 0, DEPTH, 0.1, WALL_H, 0xf3e6c8);
    local(
      B,
      s,
      "paint",
      -HALF - 0.3,
      HALF + 0.3,
      -0.9,
      DEPTH + 0.2,
      WALL_H,
      WALL_H + 0.18,
      0x1f7a7a,
    );
    for (let i = 0; i < 6; i += 1) {
      const u0 = -HALF - 0.3 + i * ((2 * HALF + 0.6) / 6);
      const col = i % 2 ? 0xf6f3ec : 0xe2573b;
      local(B, s, "paint", u0, u0 + (2 * HALF + 0.6) / 6, -0.9, -0.7, WALL_H - 0.55, WALL_H, col);
    }
  }

  /** The signboard on the canopy front (a painted atlas sign when the world has an atlas). */
  function board(B, s, ctx, text) {
    if (!ctx.atlas) return;
    const uv = ctx.atlas.sign({
      w: 5.6 * 0.6,
      h: 0.7,
      text: text.title,
      sub: text.sub,
      bg: "#1f7a7a",
      bg2: "#16605f",
    });
    ctx.atlas.texture.needsUpdate = true; // the board was painted into the shared sign atlas
    const rot = s.face > 0 ? 0 : Math.PI;
    B.plane("sign", s.x, WALL_H + 0.62, s.z + s.face * 0.92, 5.6, 0.8, rot, uv);
  }

  /** The counter in front and a lamp strip under the canopy. */
  function counter(B, s) {
    local(B, s, "wood", -2.6, 2.6, 0.25, 0.95, 0.1, 1.0, 0x9a6a3e);
    local(B, s, "paint", -2.7, 2.7, 0.2, 1.0, 1.0, 1.06, 0xf3e6c8);
    B.box("lamp", s.x, WALL_H - 0.12, s.z - s.face * 1.2, 3.2, 0.05, 0.14, 0xffffff);
  }

  /** A clothes rail along the back wall with a row of hanging garments and a folded stack on the counter. */
  function rail(B, s) {
    [-2.5, 2.5].forEach((u) =>
      B.cyl("metal", s.x + u, 1.15, s.z - s.face * 2.3, 0.04, 2.3, 6, 0x8e959b),
    );
    local(B, s, "metal", -2.55, 2.55, 2.26, 2.34, 2.2, 2.26, 0x8e959b);
    for (let i = 0; i < 7; i += 1) {
      const u = -2.1 + i * 0.7;
      const robe = i % 3 === 2;
      local(B, s, "plastic", u - 0.26, u + 0.26, 2.2, 2.4, robe ? 0.7 : 1.1, 2.15, CLOTHES[i]);
    }
    [0xf4f1e8, 0xe8a21a, 0x2f8f5b].forEach((c, i) =>
      local(
        B,
        s,
        "plastic",
        -1.8 + i * 0.1,
        -1.0 + i * 0.1,
        0.45,
        0.8,
        1.06 + i * 0.1,
        1.16 + i * 0.1,
        c,
      ),
    );
  }

  /**
   * Build a tailor's stall.
   * @param B the Batch; @param ctx { colliders, atlas? }
   * @param {{x:number, z:number, face:number}} s centre, front line, which way the front looks
   * @param {{title:string, sub:string}} text the signboard words
   * @returns {{stand:{x:number,z:number}}} where the hero stands at the counter
   */
  function build(B, ctx, s, text) {
    shell(B, s);
    board(B, s, ctx, text);
    counter(B, s);
    rail(B, s);
    const za = s.z - s.face * (DEPTH + 0.2);
    const zb = s.z;
    P.collide(
      ctx.colliders,
      s.x - HALF - 0.1,
      s.x + HALF + 0.1,
      Math.min(za, zb),
      Math.max(za, zb),
      "tailor-shop",
    );
    return { stand: { x: s.x, z: s.z + s.face * 1.3 } };
  }

  P.Tailor = { build };
})((window.KQ = window.KQ || {}));
