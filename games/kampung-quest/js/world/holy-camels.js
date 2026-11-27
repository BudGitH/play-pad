/* ============================================================================
 * FILE: holy-camels.js
 * PURPOSE: The camels of Makkah's outskirts (KQ.WorldParts.HolyCamels): a fenced camel yard with a
 *          kneeling, a standing and a grazing camel, a handler, hay, a trough and a shade shelter;
 *          a caravan of three camels led by a handler round a track on the desert; and a few
 *          camels resting and grazing at a palm oasis. Camels are rigid parts instanced across the
 *          herd (body, neck + head, tail, saddle, four legs): the whole herd is about 6 draw calls.
 *          Each pose is simple maths (idle breathing and head sway, a pacing walk, kneeling, grazing).
 *          Colliders keep the hero from walking through them; walkers update theirs every frame.
 * BUSINESS CONTEXT: owner feedback "show camels in the Makkah region".
 * DEPENDENCIES: holy-camel-mesh.js, holy-kit.js (solid), geo.js (Batch, instanced, rng).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const K = () => P.HolyKit;
  const YARD = { x0: -247, z0: -154, x1: -203, z1: -126 };
  const CARAVAN = { cx: -250, cz: -72, rx: 17, rz: 10 };
  const OASIS = { x: -172, z: 106 };
  /** Open areas the city fill must leave alone: [x0, z0, x1, z1]. */
  const AREAS = [
    [YARD.x0 - 6, YARD.z0 - 6, YARD.x1 + 6, YARD.z1 + 6],
    [CARAVAN.cx - 24, CARAVAN.cz - 18, CARAVAN.cx + 24, CARAVAN.cz + 18],
    [OASIS.x - 26, OASIS.z - 22, OASIS.x + 26, OASIS.z + 22],
  ];
  const COATS = [0xffffff, 0xf0dcb8, 0xd8b890, 0xb89870, 0x9a7a58];

  /** The herd: mode "stand" | "rest" | "graze" | "walk"; saddle = a blanket tint or 0; `lap` = offset on the caravan track. */
  const HERD = [
    { x: -236, z: -146, yaw: 1.3, mode: "rest", coat: 1, saddle: 0xffffff },
    { x: -222, z: -136, yaw: -0.5, mode: "stand", coat: 2 },
    { x: -213, z: -147, yaw: 2.6, mode: "graze", coat: 3 },
    { mode: "walk", coat: 2, lap: 0, saddle: 0xffffff },
    { mode: "walk", coat: 1, lap: -0.62, saddle: 0xffe1b0 },
    { mode: "walk", coat: 4, lap: -1.24 },
    { x: OASIS.x + 8, z: OASIS.z - 6, yaw: -1.2, mode: "rest", coat: 0 },
    { x: OASIS.x - 9, z: OASIS.z + 8, yaw: 0.7, mode: "rest", coat: 3 },
    { x: OASIS.x + 1, z: OASIS.z + 15, yaw: 2.2, mode: "graze", coat: 2 },
  ];
  /** Handlers: standing ones are placed by x, z, yaw; the walking one leads the caravan. */
  const HANDLERS = [
    { x: -219, z: -133, yaw: 2.4, mode: "stand" },
    { mode: "walk", lap: 0.2 },
    { x: OASIS.x + 4, z: OASIS.z - 12, yaw: 0.4, mode: "stand" },
  ];

  /** Fence, hay, trough, shelter and the oasis pond (static: merged into the world batch). */
  function yard(c) {
    const B = c.B;
    const post = (x, z) => {
      B.aabb("wood", x - 0.12, 0, z - 0.12, x + 0.12, 1.5, z + 0.12, 0x9a7a52);
    };
    const run = (x0, z0, x1, z1) => {
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3);
      for (let i = 0; i <= n; i += 1) post(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
      [0.55, 1.1].forEach((y) =>
        B.aabb(
          "wood",
          Math.min(x0, x1) - 0.06,
          y,
          Math.min(z0, z1) - 0.06,
          Math.max(x0, x1) + 0.06,
          y + 0.12,
          Math.max(z0, z1) + 0.06,
          0xa88a60,
        ),
      );
      K().solid(
        c.colliders,
        Math.min(x0, x1) - 0.2,
        Math.min(z0, z1) - 0.2,
        Math.max(x0, x1) + 0.2,
        Math.max(z0, z1) + 0.2,
        "fence",
      );
    };
    run(YARD.x0, YARD.z0, YARD.x1, YARD.z0);
    run(YARD.x0, YARD.z1, YARD.x1, YARD.z1);
    run(YARD.x0, YARD.z0, YARD.x0, YARD.z1);
    run(YARD.x1, YARD.z0, YARD.x1, YARD.z1);
    B.aabb("dirt", YARD.x0, 0, YARD.z0, YARD.x1, 0.03, YARD.z1, 0xffffff);
    furniture(c);
  }

  /** Hay bales, a trough, the shade shelter and the oasis pond. */
  function furniture(c) {
    const B = c.B;
    [
      [-241, -150],
      [-239.2, -150],
      [-240, -148.4],
    ].forEach(([x, z], i) =>
      B.box("paint", x, 0.35 + (i === 2 ? 0.7 : 0), z, 1.6, 0.7, 0.8, 0xd9b95a),
    );
    K().solid(c.colliders, -242.2, -151, -238.2, -147.9, "hay");
    B.aabb("wood", -209, 0, -139, -205, 0.7, -137.4, 0x8a6a44);
    B.aabb("glass", -208.8, 0.55, -138.8, -205.2, 0.58, -137.6, 0xffffff);
    K().solid(c.colliders, -209, -139, -205, -137.4, "trough");
    shelter(c);
    B.cyl("dark", OASIS.x, 0.02, OASIS.z, 7, 0.04, 20, 0x2a4a58);
    B.cyl("glass", OASIS.x, 0.07, OASIS.z, 6.6, 0.02, 20, 0xffffff);
  }

  /** A shade shelter: four posts and a woven palm-mat roof (west side of the yard). */
  function shelter(c) {
    const B = c.B;
    const s = { x0: -245, z0: -138, x1: -233, z1: -130 };
    [
      [s.x0, s.z0],
      [s.x1, s.z0],
      [s.x0, s.z1],
      [s.x1, s.z1],
    ].forEach(([x, z]) => {
      B.aabb("wood", x - 0.15, 0, z - 0.15, x + 0.15, 3.4, z + 0.15, 0x8a6a44);
      K().solid(c.colliders, x - 0.2, z - 0.2, x + 0.2, z + 0.2, "post");
    });
    B.aabb("wood", s.x0 - 0.8, 3.4, s.z0 - 0.8, s.x1 + 0.8, 3.7, s.z1 + 0.8, 0xc9aa6a);
    B.aabb("paint", s.x0 - 0.8, 3.7, s.z0 - 0.8, s.x1 + 0.8, 3.85, s.z1 + 0.8, 0xb89a5a);
  }

  /** Make the shared fur material (a faint noise map so the coat is not one flat colour). */
  function furMaterial() {
    const c = P.Canvas.canvas(64, 64);
    const g = c.getContext("2d");
    const r = P.rng(12);
    g.fillStyle = "#ececec";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 400; i += 1) {
      g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.12)";
      g.fillRect(r() * 64, r() * 64, 1 + r() * 3, 1 + r() * 3);
    }
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: P.Canvas.tex(c, true, true),
      roughness: 0.95,
      envMapIntensity: 0.3,
    });
  }

  P.HolyCamels = { AREAS, HERD, HANDLERS, YARD, CARAVAN, OASIS, COATS, yard, furMaterial };
})((window.KQ = window.KQ || {}));
