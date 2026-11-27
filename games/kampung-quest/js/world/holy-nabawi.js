/* ============================================================================
 * FILE: holy-nabawi.js
 * PURPOSE: Masjid Nabawi in Madinah, outside (KQ.WorldParts.HolyNabawi): the cream stone
 *          walls with a north arcade portico, ten minarets, small silver domes, the sliding
 *          roof panels, the Green Dome, the marble courtyard with its umbrellas and lamps.
 *          The inside is in holy-nabawi-inside.js.
 * BUSINESS CONTEXT: AC-H1. Qibla is +z (south) here, so the prayer hall is the southern part.
 *   The Prophet's chamber is only ever a closed green-and-brass screen (inside file): no
 *   depiction of any person.
 * DEPENDENCIES: holy-kit.js, geo.js, KQ.HOLY.madinah anchors.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const K = () => P.HolyKit;
  const X0 = 565;
  const X1 = 635;
  const Z0 = -30;
  const Z1 = 30;
  const WALL_H = 12;
  const STONE = 0xefe6d0;

  /** A solid wall run with a gold band and rows of dark windows (outer faces). */
  function windowedWall(c, o) {
    K().wall(c.B, c, {
      x0: o.x0,
      z0: o.z0,
      x1: o.x1,
      z1: o.z1,
      y1: WALL_H,
      t: 1.2,
      color: STONE,
      key: "whitePlaster",
    });
    const alongX = o.z0 === o.z1;
    const len = alongX ? o.x1 - o.x0 : o.z1 - o.z0;
    const n = Math.floor(len / 5);
    for (let i = 0; i < n; i += 1) {
      const t = (i + 0.5) * (len / n);
      const x = alongX ? o.x0 + t : o.x0 + o.side * 0.65;
      const z = alongX ? o.z0 + o.side * 0.65 : o.z0 + t;
      c.B.box("glass", x, 7.2, z, alongX ? 1.6 : 0.12, 2.6, alongX ? 0.12 : 1.6, 0x3b4a52);
      c.B.box("gold", x, 5.8, z, alongX ? 2 : 0.16, 0.18, alongX ? 0.16 : 2, 0xd9b04a);
    }
    c.B.box(
      "gold",
      (o.x0 + o.x1) / 2,
      10.6,
      (o.z0 + o.z1) / 2,
      alongX ? len : 1.4,
      0.3,
      alongX ? 1.4 : len,
      0xd9b04a,
    );
  }

  /** The north portico: an arcade of pointed arches (the entrances), with piers as colliders. */
  function portico(c) {
    P.HolyHaram.arcade(c, { axis: "x", fixed: Z0, from: X0, to: X1, n: 10, t: 1.4 });
    c.B.aabb("whitePlaster", X0, 9, Z0 - 0.7, X1, WALL_H, Z0 + 0.7, STONE);
    c.B.aabb("gold", X0, 9, Z0 - 0.75, X1, 9.3, Z0 + 0.75, 0xd9b04a);
  }

  /** Outer walls: west, east and the qibla (south) wall; the north side is the portico. */
  function walls(c) {
    windowedWall(c, { x0: X0, z0: Z0, x1: X0, z1: Z1, side: -1 });
    windowedWall(c, { x0: X1, z0: Z0, x1: X1, z1: Z1, side: 1 });
    windowedWall(c, { x0: X0, z0: Z1, x1: X1, z1: Z1, side: 1 });
  }

  /** Roof: flat cream roof with sunken sliding-panel squares and small silver domes along the edge. */
  function roof(c) {
    const B = c.B;
    B.aabb("whitePlaster", X0, 9, Z0, X1, 9.7, Z1, 0xece4d0);
    for (let x = X0 + 9; x < X1 - 6; x += 12) {
      for (let z = Z0 + 9; z < Z1 - 6; z += 12) {
        B.aabb("metal", x - 3.4, 9.7, z - 3.4, x + 3.4, 9.85, z + 3.4, 0xcfd6dc);
        B.aabb("gold", x - 3.6, 9.7, z - 3.6, x + 3.6, 9.8, z + 3.6, 0xd9b04a);
        B.aabb("metal", x - 3.2, 9.85, z - 3.2, x + 3.2, 9.95, z + 3.2, 0xdfe5ea);
      }
    }
    for (let x = X0 + 4; x <= X1 - 3; x += 8) {
      [Z0 + 1.5, Z1 - 1.5].forEach((z) =>
        K().dome(B, {
          key: "metal",
          x,
          y: 9.7,
          z,
          r: 1.3,
          k: 1,
          color: 0xd5dce2,
          drumKey: "whitePlaster",
        }),
      );
    }
    B.aabb("whitePlaster", X0, 9.7, Z0, X1, 10.2, Z0 + 0.5, STONE);
  }

  /** The Green Dome over the Prophet's chamber (south-east of the hall) on a square cream base. */
  function greenDome(c) {
    const B = c.B;
    const d = { x: 613, z: 21 };
    B.aabb("whitePlaster", d.x - 6.2, 9.7, d.z - 6.2, d.x + 6.2, 12.4, d.z + 6.2, 0xf4eddc);
    B.aabb("gold", d.x - 6.4, 12.4, d.z - 6.4, d.x + 6.4, 12.8, d.z + 6.4, 0xd9b04a);
    K().dome(B, {
      key: "paint",
      x: d.x,
      y: 12.8,
      z: d.z,
      r: 5.6,
      k: 1.05,
      color: 0x2f8f5a,
      bulge: 1.12,
      drumKey: "paint",
    });
  }

  /** Ten minarets: four at the corners, two on each side, two on the north gates. */
  function towers(c) {
    const list = [
      [562, -33, 68],
      [638, -33, 68],
      [562, 33, 68],
      [638, 33, 68],
      [562, 0, 60],
      [638, 0, 60],
      [552, -94, 60],
      [648, -94, 60],
      [588, 33, 60],
      [612, 33, 60],
    ].map((m) => ({ x: m[0], z: m[1], h: m[2] }));
    K().minarets(c.B, list, c);
  }

  /** The umbrella courtyard: marble plaza, lamps, and the retractable umbrellas (instanced). */
  function courtyard(c, group, mats) {
    const B = c.B;
    B.aabb("marble", 548, 0, -95, 652, 0.1, Z0, 0xd8d0bb);
    B.aabb("marble", 548, 0, Z0, X0 - 1, 0.1, 50, 0xe9e3d2);
    B.aabb("marble", X1 + 1, 0, Z0, 642, 0.1, 50, 0xe9e3d2);
    B.aabb("tiles", 548, 0.1, -95, 652, 0.12, -94.4, 0xb8aa84);
    const list = [];
    for (let x = 556; x <= 644; x += 14) {
      [-84, -70, -56, -42].forEach((z) => list.push({ x, z }));
    }
    umbrellas(group, mats, list, c.colliders);
    for (let x = 556; x <= 644; x += 22) K().lamp(B, c, x, -90, 7);
  }

  /** Umbrellas: a pole and a pyramid canopy each, two instanced meshes with pole colliders. */
  function umbrellas(group, mats, spots, colliders) {
    const pole = K().tint(
      new THREE.CylinderGeometry(0.22, 0.28, 8.6, 8).translate(0, 4.3, 0),
      0xf4f1ea,
    );
    const top = K().tint(
      new THREE.ConeGeometry(5, 1.8, 4).rotateY(Math.PI / 4).translate(0, 9.4, 0),
      0xf6f1e2,
    );
    const rim = K().tint(
      new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8).translate(0, 8.5, 0),
      0xd9b04a,
    );
    const list = spots.map((s) => ({ x: s.x, y: 0.1, z: s.z }));
    const a = P.instanced(pole, mats.paint, list);
    const b = P.instanced(top, mats.paint, list);
    const d = P.instanced(rim, mats.gold, list, { cast: false });
    a.name = "holyUmbrellaPole";
    b.name = "holyUmbrellaTop";
    group.add(a, b, d);
    spots.forEach((s) => K().solid(colliders, s.x - 0.3, s.z - 0.3, s.x + 0.3, s.z + 0.3, "post"));
  }

  /** Build the outside of the Prophet's Mosque. */
  function build(c, group, mats) {
    walls(c);
    portico(c);
    roof(c);
    greenDome(c);
    towers(c);
    courtyard(c, group, mats);
  }

  P.HolyNabawi = { build, X0, X1, Z0, Z1 };
})((window.KQ = window.KQ || {}));
