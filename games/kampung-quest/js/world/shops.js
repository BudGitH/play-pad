/* Kampung Quest — neighbourhood centre (KQ.WorldParts.Shops): a two-storey shop row with a
   five-foot-way arcade housing the mini-mart (till), barber (spinning pole, chairs, mirror)
   and family clinic (reception desk); the public library; and the bus stop shelter. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const WALL = 0xf2ece0;

  /** Shell: floor, walls, arcade columns, upper floors with windows, roof parapet. */
  function row(B, S, ctx) {
    const zf = S.z1 - S.arcade;
    B.aabb("tiles", S.x0 - 0.5, 0, S.z0, S.x1 + 0.5, 0.14, S.z1 + 0.4, 0xf4ede0);
    B.aabb("plaster", S.x0, 0.14, S.z0, S.x1, S.h, S.z0 + 0.3, WALL);
    ctx.colliders.push({ minX: S.x0, maxX: S.x1, minZ: S.z0 - 0.2, maxZ: S.z0 + 0.4, kind: "shop-back" });
    [S.x0, ...ctx.L.shopUnits.map((u) => u.x1)].forEach((x) => {
      B.aabb("plaster", x - 0.15, 0.14, S.z0, x + 0.15, S.h, zf, WALL);
      ctx.colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: S.z0, maxZ: zf + 0.1, kind: "shop-wall" });
    });
    for (let x = S.x0; x <= S.x1 + 0.01; x += 6) {
      B.box("plaster", x, S.h / 2, S.z1 - 0.25, 0.5, S.h, 0.5, WALL);
      B.box("plaster", x, 0.45, S.z1 - 0.25, 0.54, 0.9, 0.54, 0x8a5a3a);
      ctx.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: S.z1 - 0.55, maxZ: S.z1 + 0.05, kind: "arcade-col" });
    }
    B.aabb("paint", S.x0, S.h - 0.12, S.z0, S.x1, S.h, S.z1, 0xf6f3ec);
    B.aabb("plaster", S.x0 - 0.3, S.h, S.z0 - 0.3, S.x1 + 0.3, S.h + 6.2, S.z1 + 0.1, 0xe7d3b8);
    B.aabb("plaster", S.x0 - 0.4, S.h + 6.2, S.z0 - 0.4, S.x1 + 0.4, S.h + 6.9, S.z1 + 0.2, 0x8a5a3a);
    upperWindows(B, S, ctx);
  }
  function upperWindows(B, S, ctx) {
    const rnd = P.rng(4242);
    for (let f = 0; f < 2; f++) {
      for (let x = S.x0 + 1.5; x < S.x1 - 1; x += 3) {
        const key = rnd() < 0.45 ? "windowLit" : "window";
        B.plane(key, x, S.h + 1.6 + f * 3, S.z1 + 0.12, 1.5, 1.3, 0, ctx.win.uv(Math.floor(rnd() * 8)));
        B.box("concrete", x, S.h + 0.85 + f * 3, S.z1 + 0.2, 1.7, 0.08, 0.2, 0xe0dbd2);
      }
    }
  }

  /** Each unit's signboard on the arcade fascia + roller-shutter box over the shopfront. */
  function fronts(B, S, ctx) {
    const zf = S.z1 - S.arcade;
    ctx.L.shopUnits.forEach((u) => {
      const xc = (u.x0 + u.x1) / 2;
      const uv = ctx.atlas.sign({ w: (u.x1 - u.x0) * 0.6, h: 0.8, text: u.text, sub: u.sub, bg: u.bg });
      B.plane("sign", xc, S.h - 0.5, S.z1 + 0.02, u.x1 - u.x0 - 0.8, 0.72, 0, uv);
      B.aabb("paint", u.x0 + 0.15, S.h - 0.55, S.z1 - 0.02, u.x1 - 0.15, S.h - 0.12, S.z1 + 0.01, 0xf6f3ec);
      B.aabb("metal", u.x0 + 0.15, S.h - 0.5, zf - 0.2, u.x1 - 0.15, S.h - 0.12, zf + 0.1, 0xa8adb2);
      B.box("lamp", xc, S.h - 0.16, (S.z0 + zf) / 2, 2.2, 0.05, 0.14, 0xffffff);
      B.box("lamp", xc, S.h - 0.16, S.z1 - 1.2, 1.4, 0.05, 0.12, 0xffffff);
      ctx.pools.push({ x: xc, z: S.z1 - 1.2, s: 0.6, y: S.h - 0.4 }, { x: xc, z: (S.z0 + zf) / 2, s: 0.8, y: S.h - 0.4 });
    });
  }

  /** Mini-mart: product shelves, fridge, till counter, fruit crates outside. */
  function minimart(B, u, S, ctx) {
    const zf = S.z1 - S.arcade;
    [S.z0 + 0.6, S.z0 + 3.4].forEach((z, i) => {
      B.aabb("metal", u.x0 + 3, 0.14, z - 0.35, u.x1 - 0.6, 1.8, z + 0.35, 0xdfe3e6);
      B.aabb("books", u.x0 + 3.05, 0.25, z + (i ? 0.36 : 0.36), u.x1 - 0.65, 1.75, z + 0.37, 0xffffff);
      ctx.colliders.push({ minX: u.x0 + 2.9, maxX: u.x1 - 0.5, minZ: z - 0.45, maxZ: z + 0.45, kind: "shelf" });
    });
    B.aabb("paint", u.x0 + 0.3, 0.14, S.z0 + 0.4, u.x0 + 1.2, 2.1, S.z0 + 3.5, 0xeef2f5);
    B.aabb("lamp", u.x0 + 1.21, 0.4, S.z0 + 0.6, u.x0 + 1.23, 1.9, S.z0 + 3.3, 0xdff0ff);
    B.aabb("wood", u.x0 + 0.4, 0.14, zf - 1.8, u.x0 + 2.4, 1.0, zf - 1.0, 0x8a5a3a);
    B.aabb("dark", u.x0 + 1.2, 1.0, zf - 1.7, u.x0 + 1.7, 1.3, zf - 1.3, 0x22262a);
    ctx.colliders.push({ minX: u.x0 + 0.2, maxX: u.x0 + 2.5, minZ: zf - 1.9, maxZ: zf - 0.9, kind: "till" });
    ctx.colliders.push({ minX: u.x0 + 0.2, maxX: u.x0 + 1.3, minZ: S.z0 + 0.3, maxZ: S.z0 + 3.6, kind: "fridge" });
    const fruit = [0xf2a33a, 0xd9392b, 0x7fbf3f, 0xf5d547];
    for (let i = 0; i < 4; i++) {
      const x = u.x0 + 4.4 + i * 0.95;
      B.aabb("wood", x - 0.42, 0.14, zf + 0.3, x + 0.42, 0.6, zf + 0.9, 0xb98a55);
      for (let k = 0; k < 6; k++) B.geo("paint", sph(), P.compose(x - 0.25 + (k % 3) * 0.25, 0.68, zf + 0.45 + Math.floor(k / 3) * 0.28, 0, 1, 1, 1), fruit[i]);
    }
    ctx.colliders.push({ minX: u.x0 + 3.9, maxX: u.x0 + 7.8, minZ: zf + 0.2, maxZ: zf + 1.0, kind: "fruit" });
    return { till: { x: u.x0 + 1.4, z: zf - 0.3, facing: Math.PI } };
  }
  const sph = () => P.cached("fruit", () => new THREE.SphereGeometry(0.12, 10, 8));

  P.Shops = { row, fronts, minimart, WALL };
})((window.KQ = window.KQ || {}));
