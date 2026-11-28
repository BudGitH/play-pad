/* ============================================================================
 * FILE: hdb-deck.js
 * PURPOSE: Dressing for an HDB void deck (KQ.WorldParts.HdbDeck): a white ceiling with downstand beams, grey tiles and a
 *          chess board under the stone table sets (two stools with the steel back rail), drain gratings along the
 *          open edges, a bicycle rack, wall fans and a friendly "gentle play" sign on the lift core, downpipes at the
 *          corners, and a community unit at one end of block B (RC centre) and block C (kindergarten). Everything
 *          goes into the shared batch with existing materials, so it adds no draw calls. Called from HDB.block.
 * BUSINESS CONTEXT: the playability round's Singapore realism pass (features/kampung-quest-playability/requirements.md, AC-P20 and the cross-cutting Singapore dressing in test-plan.md; reference photos
 *   in features/kampung-quest-playability/sg-reference.md); the draw-call budget of AC-14 stays under 400.
 * DEPENDENCIES: KQ.WorldParts.HDB (block geometry, VOID_H), the shared batch and materials.
 * HOW TO TEST: npx playwright test tests/kampung-quest-ac.spec.mjs (draw calls at the void deck are asserted).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const VOID_H = () => P.HDB.VOID_H;

  /** The community unit closing one end of a void deck, by block id. */
  const CENTRES = {
    block_b: {
      end: "x0",
      text: "RC CENTRE",
      sub: "Residents' Committee · Zone 3",
      bg: "#d8603a",
      wall: 0xfff1e2,
    },
    block_c: {
      end: "x1",
      text: "TADIKA CERIA",
      sub: "Kindergarten · Taska",
      bg: "#2e6cc6",
      wall: 0xfff8d8,
    },
  };
  const UNIT_W = 4.4;

  /** Downstand beams under the slab: one across each pillar line, two along the block. */
  function beams(B, f) {
    const b = f.b;
    const y = VOID_H() - 0.55;
    const step = P.HDB.BAY;
    for (let x = b.x0 + 0.5; x <= b.x1 - 0.4; x += step)
      B.box("paint", x, y, (b.z0 + b.z1) / 2, 0.36, 0.4, b.z1 - b.z0, 0xfffdf6);
    [b.z0 + 0.5, b.z1 - 0.5].forEach((z) =>
      B.box("paint", f.xc, y, z, b.x1 - b.x0, 0.4, 0.36, 0xfffdf6),
    );
  }

  /** Grey tiled square, inlaid chess board and two railed stools for each stone table set. */
  function tableSets(B, stones, ctx) {
    const chess = (ctx.chessUV = ctx.chessUV || ctx.atlas.chessTop());
    const tiles = (ctx.tileUV = ctx.tileUV || ctx.atlas.floorTiles());
    stones.forEach((t) => {
      B.plane("decal", t.x, 0.141, t.z, 3.4, 3.4, [-Math.PI / 2, 0, 0], tiles);
      B.plane("decal", t.x, 0.9, t.z, 0.82, 0.82, [-Math.PI / 2, 0, 0], chess);
      [0, 2].forEach((k) => backRail(B, t, (k / 4) * Math.PI * 2 + Math.PI / 4));
    });
  }
  /** The bent steel back rail behind one stool (angle a around the table). */
  function backRail(B, t, a) {
    const r = 1.2;
    const x = t.x + Math.cos(a) * r;
    const z = t.z + Math.sin(a) * r;
    const ry = -a - Math.PI / 2;
    [0.62, 0.88].forEach((y) => B.box("metal", x, y, z, 0.5, 0.04, 0.04, 0xc9ced3, ry));
    [-0.22, 0.22].forEach((d) => {
      const px = x - Math.sin(a) * d;
      const pz = z + Math.cos(a) * d;
      B.box("metal", px, 0.6, pz, 0.04, 0.6, 0.04, 0xc9ced3, ry);
    });
  }

  /** Drain gratings along both open long edges of the deck. */
  function drains(B, f, ctx) {
    const b = f.b;
    const uv = (ctx.gratingUV = ctx.gratingUV || ctx.atlas.grating());
    const flat = [-Math.PI / 2, 0, 0];
    [b.z0 - 0.7, b.z1 + 0.7].forEach((z) => {
      for (let x = b.x0 - 0.5; x < b.x1 + 0.5; x += 1.0)
        B.plane("decal", x + 0.5, 0.146, z, 1.0, 0.22, flat, uv);
    });
  }

  /** Inverted-U bicycle rack at the open end of the deck (blocks A and B). */
  function bikeRack(B, f, ctx) {
    const b = f.b;
    const x = b.x1 - 1.0;
    for (let z = b.z0 + 2; z <= b.z1 - 2; z += 1.1) {
      [-0.3, 0.3].forEach((dx) => B.box("metal", x + dx, 0.55, z, 0.05, 0.8, 0.05, 0xb8bec4));
      B.box("metal", x, 0.95, z, 0.65, 0.05, 0.05, 0xb8bec4);
    }
    P.collide(ctx.colliders, x - 0.4, x + 0.4, b.z0 + 1.8, b.z1 - 1.8, "bike-rack");
  }

  /** Wall fans on both side faces of the lift core, and the gentle-play sign. */
  function coreFittings(B, f, ctx) {
    const b = f.b;
    const zc = (Math.min(f.zw, f.zb) + Math.max(f.zw, f.zb)) / 2;
    [-1, 1].forEach((side) => wallFan(B, f.xc + side * 2.72, 2.7, zc + 1.2, side));
    const uv = ctx.atlas.picto({
      icon: "play",
      text: "Play gently, please!",
      sub: "Main baik-baik · Thank you",
      bg: "#fff8e8",
      edge: b.band,
    });
    B.plane("decal", f.xc + 2.668, 2.05, zc - 1.2, 1.3, 0.45, Math.PI / 2, uv);
  }
  /** A wall-mounted fan facing +x (side 1) or -x (side -1). */
  function wallFan(B, x, y, z, side) {
    const g = P.cached("fanDisc", () => new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16));
    const turn = [0, 0, Math.PI / 2];
    B.box("paint", x, y, z, 0.12, 0.14, 0.14, 0x6f7880);
    B.geo("metal", g, P.compose(x + side * 0.2, y - 0.08, z, turn, 1, 1, 1), 0xd9dde0);
    B.geo("paint", g, P.compose(x + side * 0.27, y - 0.08, z, turn, 0.25, 0.4, 0.25), 0x3f4850);
  }

  /** Downpipes at the two corridor-side corners, ground to roof. */
  function downpipes(B, f) {
    const b = f.b;
    const z = f.zc - f.s * 0.12;
    [b.x0 + 0.1, b.x1 - 0.1].forEach((x) =>
      B.cyl("paint", x, (f.top + 1) / 2, z, 0.075, f.top + 1, 8, 0xf2efe8),
    );
  }

  /** A community unit (RC centre / kindergarten) closing one end of the deck. */
  function centre(B, f, ctx, c) {
    const b = f.b;
    const atX0 = c.end === "x0";
    const xa = atX0 ? b.x0 + 0.1 : b.x1 - UNIT_W;
    const xb = atX0 ? b.x0 + UNIT_W : b.x1 - 0.1;
    const za = b.z0 + 0.15;
    const zb = b.z1 - 0.15;
    const h = VOID_H() - 0.35;
    B.aabb("plaster", xa, 0.14, za, xb, h, zb, c.wall);
    P.collide(ctx.colliders, xa - 0.05, xb + 0.05, za - 0.05, zb + 0.05, "centre");
    const fx = atX0 ? xb + 0.01 : xa - 0.01;
    const rot = atX0 ? Math.PI / 2 : -Math.PI / 2;
    const board = ctx.atlas.centreBoard(c);
    centreFront(B, fx, (za + zb) / 2, rot, atX0 ? 1 : -1, board);
    [za - 0.01, zb + 0.01].forEach((z, i) =>
      B.plane("decal", (xa + xb) / 2, 2.2, z, UNIT_W - 0.6, 0.6, i ? 0 : Math.PI, board),
    );
  }
  /** Glass front with mullions, a door and the name board, facing into the deck. */
  function centreFront(B, x, z, rot, dir, board) {
    B.plane("paint", x, 1.25, z, 6.6, 1.8, rot, null, 0xbfe3f2);
    for (let k = -3; k <= 3; k++)
      B.box("paint", x + dir * 0.02, 1.25, z + k * 1.1, 0.06, 1.8, 0.07, 0xffffff);
    B.box("paint", x + dir * 0.03, 1.2, z + 1.6, 0.05, 2.1, 1.0, 0x8fc6e0);
    B.box("paint", x + dir * 0.03, 2.25, z, 0.06, 0.08, 6.7, 0xffffff);
    B.plane("decal", x + dir * 0.06, 2.65, z, 3.6, 0.7, rot, board);
  }

  /** Dress one block's void deck (f = HDB frame, stones = its stone table spots). */
  function dress(B, f, ctx, stones) {
    beams(B, f);
    tableSets(B, stones, ctx);
    drains(B, f, ctx);
    coreFittings(B, f, ctx);
    downpipes(B, f);
    if (f.b.id !== "block_c") bikeRack(B, f, ctx);
    const c = CENTRES[f.b.id];
    if (c) centre(B, f, ctx, c);
  }

  P.HdbDeck = { dress, CENTRES };
})((window.KQ = window.KQ || {}));
