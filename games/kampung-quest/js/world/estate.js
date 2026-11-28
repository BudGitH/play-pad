/* ============================================================================
 * FILE: estate.js
 * PURPOSE: Estate furniture (KQ.WorldParts.Estate): a fitness corner on rubber flooring by block C, a railed monsoon
 *          drain along the west edge of the town (broken by the road culvert) and the bicycle rack in front of
 *          block A (the parked bicycles are vehicles; the rack is decor without a collider so it never moves
 *          them). Batched with existing materials.
 * BUSINESS CONTEXT: the playability round's Singapore realism pass (features/kampung-quest-playability/requirements.md, AC-P20 and the cross-cutting Singapore dressing in test-plan.md; reference sheet
 *   features/kampung-quest-playability/sg-reference.md).
 * DEPENDENCIES: KQ.WorldParts (the shared batch and materials).
 * HOW TO TEST: npx playwright test tests/kampung-quest-ac.spec.mjs.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const FIT = { x0: 38.6, x1: 45.4, z0: 38.4, z1: 42.6 };
  const DRAIN = {
    x0: -70.4,
    x1: -67.8,
    runs: [
      [-66, -7.5],
      [7.5, 66],
    ],
  };

  /** Fitness corner: rubber pad, pull-up bars, a sit-up bench and a twister, each a collider. */
  function fitness(B, ctx) {
    const F = FIT;
    B.aabb("rubber", F.x0, 0, F.z0, F.x1, 0.16, F.z1, 0x3f9ad0);
    B.aabb("rubber", F.x0 + 0.3, 0, F.z0 + 0.3, F.x0 + 2.6, 0.165, F.z1 - 0.3, 0x5fbf6a);
    pullUp(B, F.x0 + 1.4, (F.z0 + F.z1) / 2, ctx);
    situp(B, F.x0 + 3.8, (F.z0 + F.z1) / 2, ctx);
    twister(B, F.x1 - 1.2, (F.z0 + F.z1) / 2, ctx);
  }
  /** Two-height pull-up bars (yellow posts, steel bars). */
  function pullUp(B, x, z, ctx) {
    [-1, 0, 1].forEach((k) => B.cyl("paint", x, 1.1, z + k * 1.1, 0.06, 2.2, 10, 0xf2c230));
    B.box("metal", x, 2.1, z - 0.55, 0.05, 0.05, 1.1, 0xc9ced3);
    B.box("metal", x, 1.7, z + 0.55, 0.05, 0.05, 1.1, 0xc9ced3);
    P.collide(ctx.colliders, x - 0.15, x + 0.15, z - 1.2, z + 1.2, "fitness");
  }
  /** Inclined sit-up bench with a foot bar. */
  function situp(B, x, z, ctx) {
    B.box("plastic", x, 0.45, z, 1.6, 0.08, 0.45, 0x2f9e6a, [0, 0, 0.28]);
    B.cyl("paint", x + 0.6, 0.35, z, 0.06, 0.55, 10, 0xf2c230);
    B.cyl("paint", x - 0.6, 0.15, z, 0.06, 0.3, 10, 0xf2c230);
    B.box("metal", x - 0.75, 0.32, z, 0.05, 0.05, 0.5, 0xc9ced3);
    P.collide(ctx.colliders, x - 0.85, x + 0.85, z - 0.3, z + 0.3, "fitness");
  }
  /** Waist twister: a post with a turning disc to stand on and handles. */
  function twister(B, x, z, ctx) {
    B.cyl("paint", x, 0.65, z, 0.07, 1.3, 10, 0xe8742c);
    B.cyl("plastic", x, 0.22, z + 0.45, 0.28, 0.06, 18, 0x2a63b0);
    B.box("metal", x, 1.25, z, 0.6, 0.05, 0.05, 0xc9ced3);
    P.collide(ctx.colliders, x - 0.35, x + 0.35, z - 0.2, z + 0.8, "fitness");
  }

  /** Open concrete monsoon drain with low walls, water and a railing each side. */
  function drain(B, ctx) {
    const D = DRAIN;
    DRAIN.runs.forEach(([z0, z1]) => {
      const zm = (z0 + z1) / 2;
      const len = z1 - z0;
      B.aabb("paving", D.x0, 0, z0, D.x0 + 0.25, 0.3, z1, 0xd9d6cf);
      B.aabb("paving", D.x1 - 0.25, 0, z0, D.x1, 0.3, z1, 0xd9d6cf);
      B.decal("dark", (D.x0 + D.x1) / 2, 0.04, zm, D.x1 - D.x0 - 0.5, len, 0, 0x5d8f9a);
      [D.x0 + 0.12, D.x1 - 0.12].forEach((x) =>
        B.plane("railing", x, 0.85, zm, len, 1.1, Math.PI / 2, null, 0x8d949a),
      );
      P.collide(ctx.colliders, D.x0 - 0.1, D.x1 + 0.1, z0, z1, "drain");
    });
  }

  /** Inverted-U loops beside the parked bicycles in front of block A (no collider). */
  function bikeRack(B) {
    [-31.6, -30.4, -29.2, -28.0].forEach((x) => {
      [11.0, 11.7].forEach((z) => B.box("metal", x, 0.45, z, 0.05, 0.8, 0.05, 0xb8bec4));
      B.box("metal", x, 0.85, 11.35, 0.05, 0.05, 0.75, 0xb8bec4);
    });
  }

  /** Build the estate furniture into the batch. */
  function build(B, ctx) {
    fitness(B, ctx);
    drain(B, ctx);
    bikeRack(B);
  }

  P.Estate = { build, FIT, DRAIN };
})((window.KQ = window.KQ || {}));
