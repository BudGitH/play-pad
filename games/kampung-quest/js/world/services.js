/* Kampung Quest — barber, clinic, library and bus stop (KQ.WorldParts.Services), plus `build`
   that assembles the whole neighbourhood centre and returns interaction spots. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});

  /** Barber: two chairs facing a mirror wall, a spinning pole (returned for animation). */
  function barber(B, u, S, ctx, group) {
    const z = S.z0 + 0.3;
    B.aabb("chrome", u.x0 + 0.4, 1.0, z + 0.01, u.x1 - 0.4, 2.3, z + 0.03, 0xffffff);
    B.aabb("wood", u.x0 + 0.3, 0.14, z, u.x1 - 0.3, 0.95, z + 0.5, 0xf1f1ee);
    const chairs = [u.x0 + 1.8, u.x1 - 1.8].map((x) => {
      B.cyl("chrome", x, 0.3, z + 1.6, 0.25, 0.32, 16, 0xffffff);
      B.aabb("plastic", x - 0.35, 0.46, z + 1.3, x + 0.35, 0.72, z + 1.95, 0xb3242b);
      B.aabb("plastic", x - 0.35, 0.72, z + 1.85, x + 0.35, 1.45, z + 2.0, 0xb3242b);
      P.collide(ctx.colliders, x - 0.4, x + 0.4, z + 1.2, z + 2.1, "barber-chair");
      return x;
    });
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.9, 20, 1, true),
      barberMat(),
    );
    pole.position.set(u.x0 + 0.5, 2.1, S.z1 - 0.2);
    pole.name = "barberPole";
    group.add(pole);
    B.geo(
      "glass",
      P.cached("polecap", () => new THREE.SphereGeometry(0.14, 12, 8)),
      P.compose(pole.position.x, 2.62, pole.position.z, 0, 1, 1, 1),
    );
    B.cyl("chrome", pole.position.x, 1.6, pole.position.z, 0.15, 0.1, 12, 0xffffff);
    B.cyl("chrome", pole.position.x, 2.58, pole.position.z, 0.15, 0.06, 12, 0xffffff);
    return { pole, chair: { x: chairs[0], z: z + 2.6, facing: Math.PI } };
  }
  function barberMat() {
    const t = P.Patterns.barber();
    t.repeat.set(1, 2);
    return new THREE.MeshStandardMaterial({
      map: t,
      roughness: 0.25,
      emissiveMap: t,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
    });
  }

  /** Clinic: glass front, reception desk, waiting chairs, plant. */
  function clinic(B, u, S, ctx) {
    const zf = S.z1 - S.arcade;
    B.plane("glass", (u.x0 + u.x1) / 2 - 1.2, 1.6, zf, u.x1 - u.x0 - 2.8, 2.9, 0);
    P.collide(ctx.colliders, u.x0, u.x1 - 2.6, zf - 0.1, zf + 0.1, "clinic-glass");
    const dz = S.z0 + 3.2;
    B.aabb("paint", u.x0 + 2, 0.14, dz - 0.4, u.x1 - 2, 1.05, dz + 0.4, 0xf7f7f7);
    B.aabb("paint", u.x0 + 2, 1.05, dz - 0.45, u.x1 - 2, 1.1, dz + 0.45, 0x1a8c7a);
    B.aabb("dark", u.x0 + 3.5, 1.1, dz - 0.3, u.x0 + 4.1, 1.5, dz - 0.25, 0x2a2e33);
    P.collide(ctx.colliders, u.x0 + 1.9, u.x1 - 1.9, dz - 0.5, dz + 0.5, "desk");
    const x = u.x0 + 0.6;
    for (let i = 0; i < 4; i++) {
      const z = dz + 1.6 + i * 0.6;
      B.aabb("plastic", x - 0.25, 0.42, z, x + 0.25, 0.48, z + 0.5, 0x3a86c8);
      B.aabb("plastic", x - 0.27, 0.48, z, x - 0.22, 0.95, z + 0.5, 0x3a86c8);
    }
    B.cyl("plastic", u.x1 - 0.6, 0.35, S.z0 + 0.8, 0.25, 0.45, 12, 0xd9d2c4);
    const bush = P.cached("bush", () => new THREE.IcosahedronGeometry(0.5, 1));
    B.geo("leaf", bush, P.compose(u.x1 - 0.6, 1.0, S.z0 + 0.8, 0, 1, 1.2, 1));
    return { desk: { x: (u.x0 + u.x1) / 2, z: dz + 1.0, facing: Math.PI } };
  }

  /** Library: concrete frame, glass front (south), shelves, front desk, sign. */
  function library(B, Lb, ctx) {
    const [x0, x1, z0, z1, h] = [Lb.x0, Lb.x1, Lb.z0, Lb.z1, Lb.h];
    B.aabb("tiles", x0, 0, z0, x1, 0.14, z1, 0xe8e0d2);
    B.aabb("concrete", x0, 0.14, z0, x1, h, z0 + 0.3, 0xd8d4cc);
    B.aabb("concrete", x0, 0.14, z0, x0 + 0.3, h, z1, 0xd8d4cc);
    B.aabb("concrete", x1 - 0.3, 0.14, z0, x1, h, z1, 0xd8d4cc);
    B.aabb("concrete", x0 - 1, h, z0 - 1, x1 + 1, h + 0.6, z1 + 2.5, 0xe8e4dc);
    for (let x = x0; x <= x1; x += 4) B.box("concrete", x, h / 2, z1 + 2.3, 0.4, h, 0.4, 0xd8d4cc);
    const door = (x0 + x1) / 2;
    libFront(B, Lb, door, ctx);
    const sub = "Kampung Library · Read & Play";
    const uv = ctx.atlas.sign({
      w: 8,
      h: 1.0,
      text: "PERPUSTAKAAN",
      sub,
      bg: "#3b4a8a",
      bg2: "#2f3b70",
    });
    B.plane("sign", door, h + 0.3, z1 + 2.52, 7, 0.9, 0, uv);
    libShelves(B, Lb, ctx);
    B.aabb("wood", door - 1.8, 0.14, z1 - 4.4, door + 1.8, 1.05, z1 - 3.6, 0x9a6a3e);
    P.collide(ctx.colliders, door - 1.9, door + 1.9, z1 - 4.5, z1 - 3.5, "lib-desk");
    return { desk: { x: door, z: z1 - 2.8, facing: Math.PI } };
  }
  /** Glass shopfront with a framed door opening, and the shell colliders. */
  function libFront(B, Lb, door, ctx) {
    const [x0, x1, z0, z1, h] = [Lb.x0, Lb.x1, Lb.z0, Lb.z1, Lb.h];
    const gw = door - 1.6 - x0;
    B.plane("glass", x0 + gw / 2, h / 2, z1, gw, h, 0);
    B.plane("glass", x1 - gw / 2, h / 2, z1, gw, h, 0);
    B.plane("glass", door, h / 2 + 1.6, z1, 3.2, h - 3.2, 0);
    B.aabb("metal", door - 1.7, 3.1, z1 - 0.1, door + 1.7, 3.25, z1 + 0.05, 0x3a3f44);
    [-1.6, 1.6].forEach((o) =>
      B.aabb("metal", door + o - 0.06, 0.14, z1 - 0.1, door + o + 0.06, 3.1, z1 + 0.05, 0x3a3f44),
    );
    const c = ctx.colliders;
    P.collide(c, x0 - 0.2, x1 + 0.2, z0 - 0.2, z0 + 0.5, "lib");
    P.collide(c, x0 - 0.2, x0 + 0.5, z0, z1, "lib");
    P.collide(c, x1 - 0.5, x1 + 0.2, z0, z1, "lib");
    P.collide(c, x0, door - 1.6, z1 - 0.15, z1 + 0.15, "lib-glass");
    P.collide(c, door + 1.6, x1, z1 - 0.15, z1 + 0.15, "lib-glass");
  }

  function libShelves(B, Lb, ctx) {
    for (let z = Lb.z0 + 2; z < Lb.z1 - 7; z += 3) {
      [
        [Lb.x0 + 1.5, Lb.x0 + 8],
        [Lb.x1 - 8, Lb.x1 - 1.5],
      ].forEach(([a, b]) => {
        B.aabb("wood", a, 0.14, z - 0.3, b, 2.1, z + 0.3, 0x6b4a2e);
        B.aabb("books", a + 0.05, 0.2, z + 0.3, b - 0.05, 2.05, z + 0.32, 0xffffff);
        B.aabb("books", a + 0.05, 0.2, z - 0.32, b - 0.05, 2.05, z - 0.3, 0xffffff);
        P.collide(ctx.colliders, a - 0.1, b + 0.1, z - 0.4, z + 0.4, "lib-shelf");
      });
    }
  }

  P.Services = { barber, clinic, library };
})((window.KQ = window.KQ || {}));
