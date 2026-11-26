/* Kampung Quest — barber, clinic, library and bus stop (KQ.WorldParts.Services), plus `build`
   that assembles the whole neighbourhood centre and returns interaction spots. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const SH = () => P.Shops;

  /** Barber: two chairs facing a mirror wall, a spinning pole (returned for animation). */
  function barber(B, u, S, ctx, group) {
    const z = S.z0 + 0.3;
    B.aabb("chrome", u.x0 + 0.4, 1.0, z + 0.01, u.x1 - 0.4, 2.3, z + 0.03, 0xffffff);
    B.aabb("wood", u.x0 + 0.3, 0.14, z, u.x1 - 0.3, 0.95, z + 0.5, 0xf1f1ee);
    const chairs = [u.x0 + 1.8, u.x1 - 1.8].map((x) => {
      B.cyl("chrome", x, 0.3, z + 1.6, 0.25, 0.32, 16, 0xffffff);
      B.aabb("plastic", x - 0.35, 0.46, z + 1.3, x + 0.35, 0.72, z + 1.95, 0xb3242b);
      B.aabb("plastic", x - 0.35, 0.72, z + 1.85, x + 0.35, 1.45, z + 2.0, 0xb3242b);
      ctx.colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z + 1.2, maxZ: z + 2.1, kind: "barber-chair" });
      return x;
    });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 20, 1, true), barberMat());
    pole.position.set(u.x0 + 0.5, 2.1, S.z1 - 0.2);
    pole.name = "barberPole";
    group.add(pole);
    B.geo("glass", P.cached("polecap", () => new THREE.SphereGeometry(0.14, 12, 8)), P.compose(pole.position.x, 2.62, pole.position.z, 0, 1, 1, 1));
    B.cyl("chrome", pole.position.x, 1.6, pole.position.z, 0.15, 0.1, 12, 0xffffff);
    B.cyl("chrome", pole.position.x, 2.58, pole.position.z, 0.15, 0.06, 12, 0xffffff);
    return { pole, chair: { x: chairs[0], z: z + 2.6, facing: Math.PI } };
  }
  function barberMat() {
    const t = P.Patterns.barber();
    t.repeat.set(1, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25 });
  }

  /** Clinic: glass front, reception desk, waiting chairs, plant. */
  function clinic(B, u, S, ctx) {
    const zf = S.z1 - S.arcade;
    B.plane("glass", (u.x0 + u.x1) / 2 - 1.2, 1.6, zf, u.x1 - u.x0 - 2.8, 2.9, 0);
    ctx.colliders.push({ minX: u.x0, maxX: u.x1 - 2.6, minZ: zf - 0.1, maxZ: zf + 0.1, kind: "clinic-glass" });
    const dz = S.z0 + 3.2;
    B.aabb("paint", u.x0 + 2, 0.14, dz - 0.4, u.x1 - 2, 1.05, dz + 0.4, 0xf7f7f7);
    B.aabb("paint", u.x0 + 2, 1.05, dz - 0.45, u.x1 - 2, 1.1, dz + 0.45, 0x1a8c7a);
    B.aabb("dark", u.x0 + 3.5, 1.1, dz - 0.3, u.x0 + 4.1, 1.5, dz - 0.25, 0x2a2e33);
    ctx.colliders.push({ minX: u.x0 + 1.9, maxX: u.x1 - 1.9, minZ: dz - 0.5, maxZ: dz + 0.5, kind: "desk" });
    for (let i = 0; i < 4; i++) {
      const x = u.x0 + 0.6;
      B.aabb("plastic", x - 0.25, 0.42, dz + 1.6 + i * 0.6, x + 0.25, 0.48, dz + 2.1 + i * 0.6, 0x3a86c8);
      B.aabb("plastic", x - 0.27, 0.48, dz + 1.6 + i * 0.6, x - 0.22, 0.95, dz + 2.1 + i * 0.6, 0x3a86c8);
    }
    B.cyl("plastic", u.x1 - 0.6, 0.35, S.z0 + 0.8, 0.25, 0.45, 12, 0xd9d2c4);
    B.geo("leaf", P.cached("bush", () => new THREE.IcosahedronGeometry(0.5, 1)), P.compose(u.x1 - 0.6, 1.0, S.z0 + 0.8, 0, 1, 1.2, 1), 0xffffff);
    return { desk: { x: (u.x0 + u.x1) / 2, z: dz + 1.0, facing: Math.PI } };
  }

  /** Library: concrete frame, glass front (south), shelves, front desk, sign. */
  function library(B, Lb, ctx) {
    B.aabb("tiles", Lb.x0, 0, Lb.z0, Lb.x1, 0.14, Lb.z1, 0xe8e0d2);
    B.aabb("concrete", Lb.x0, 0.14, Lb.z0, Lb.x1, Lb.h, Lb.z0 + 0.3, 0xd8d4cc);
    B.aabb("concrete", Lb.x0, 0.14, Lb.z0, Lb.x0 + 0.3, Lb.h, Lb.z1, 0xd8d4cc);
    B.aabb("concrete", Lb.x1 - 0.3, 0.14, Lb.z0, Lb.x1, Lb.h, Lb.z1, 0xd8d4cc);
    B.aabb("concrete", Lb.x0 - 1, Lb.h, Lb.z0 - 1, Lb.x1 + 1, Lb.h + 0.6, Lb.z1 + 2.5, 0xe8e4dc);
    for (let x = Lb.x0; x <= Lb.x1; x += 4) B.box("concrete", x, Lb.h / 2, Lb.z1 + 2.3, 0.4, Lb.h, 0.4, 0xd8d4cc);
    const door = (Lb.x0 + Lb.x1) / 2;
    const gw = door - 1.6 - Lb.x0;
    B.plane("glass", Lb.x0 + gw / 2, Lb.h / 2, Lb.z1, gw, Lb.h, 0);
    B.plane("glass", Lb.x1 - gw / 2, Lb.h / 2, Lb.z1, gw, Lb.h, 0);
    B.plane("glass", door, Lb.h / 2 + 1.6, Lb.z1, 3.2, Lb.h - 3.2, 0);
    B.aabb("metal", door - 1.7, 3.1, Lb.z1 - 0.1, door + 1.7, 3.25, Lb.z1 + 0.05, 0x3a3f44);
    [-1, 1].forEach((s) => B.aabb("metal", door + s * 1.6 - 0.06, 0.14, Lb.z1 - 0.1, door + s * 1.6 + 0.06, 3.1, Lb.z1 + 0.05, 0x3a3f44));
    ctx.colliders.push(
      { minX: Lb.x0 - 0.2, maxX: Lb.x1 + 0.2, minZ: Lb.z0 - 0.2, maxZ: Lb.z0 + 0.5, kind: "lib" },
      { minX: Lb.x0 - 0.2, maxX: Lb.x0 + 0.5, minZ: Lb.z0, maxZ: Lb.z1, kind: "lib" },
      { minX: Lb.x1 - 0.5, maxX: Lb.x1 + 0.2, minZ: Lb.z0, maxZ: Lb.z1, kind: "lib" },
      { minX: Lb.x0, maxX: door - 1.6, minZ: Lb.z1 - 0.15, maxZ: Lb.z1 + 0.15, kind: "lib-glass" },
      { minX: door + 1.6, maxX: Lb.x1, minZ: Lb.z1 - 0.15, maxZ: Lb.z1 + 0.15, kind: "lib-glass" },
    );
    const uv = ctx.atlas.sign({ w: 8, h: 1.0, text: "PERPUSTAKAAN", sub: "Kampung Library · Read & Play", bg: "#3b4a8a", bg2: "#2f3b70" });
    B.plane("sign", door, Lb.h + 0.3, Lb.z1 + 2.52, 7, 0.9, 0, uv);
    libShelves(B, Lb, ctx);
    B.aabb("wood", door - 1.8, 0.14, Lb.z1 - 4.4, door + 1.8, 1.05, Lb.z1 - 3.6, 0x9a6a3e);
    ctx.colliders.push({ minX: door - 1.9, maxX: door + 1.9, minZ: Lb.z1 - 4.5, maxZ: Lb.z1 - 3.5, kind: "lib-desk" });
    return { desk: { x: door, z: Lb.z1 - 2.8, facing: Math.PI } };
  }
  function libShelves(B, Lb, ctx) {
    for (let z = Lb.z0 + 2; z < Lb.z1 - 7; z += 3) {
      [[Lb.x0 + 1.5, Lb.x0 + 8], [Lb.x1 - 8, Lb.x1 - 1.5]].forEach(([a, b]) => {
        B.aabb("wood", a, 0.14, z - 0.3, b, 2.1, z + 0.3, 0x6b4a2e);
        B.aabb("books", a + 0.05, 0.2, z + 0.3, b - 0.05, 2.05, z + 0.32, 0xffffff);
        B.aabb("books", a + 0.05, 0.2, z - 0.32, b - 0.05, 2.05, z - 0.3, 0xffffff);
        ctx.colliders.push({ minX: a - 0.1, maxX: b + 0.1, minZ: z - 0.4, maxZ: z + 0.4, kind: "lib-shelf" });
      });
    }
  }

  P.Services = { barber, clinic, library };
})((window.KQ = window.KQ || {}));
