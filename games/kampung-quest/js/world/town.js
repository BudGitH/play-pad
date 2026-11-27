/* Kampung Quest — town fill (KQ.WorldParts.Town): paved plazas joining buildings to the
   sidewalks, the park (paths, benches, gazebo), the carpark (its cars are drivable vehicles now), and the
   placement lists for trees and shrubs. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});

  /** Paved plazas and footpaths (sidewalk height). */
  const PLAZAS = [
    [12.5, -11.6, 69, -6], // hawker + shop forecourt
    [39.4, -40.5, 44, -11.6], // lane between hawker and shops
    [39.4, -40.5, 68, -24.3], // library forecourt
    [-41, -10, -35, -6], // mosque south gate
    [-12, -34.5, -6, -27.5], // mosque east gate
    [-57, 25.5, -23, 27],
    [-57, 44.5, -23, 46], // block A/B aprons
    [-23, 15, -20, 56], // lane past the blocks to the carpark
    [-20, 44, -6, 47], // carpark footpath to the N–S road
    [33, 44.5, 65, 46], // block C apron
    [10, 6, 30, 14], // playground / bus stop forecourt
    [28, 18, 47.4, 20], // park path east–west
    [6, 30, 34, 32], // path from the N–S road into the park
  ];

  /** Lay the paved plazas. */
  function plazas(B) {
    PLAZAS.forEach(([x0, z0, x1, z1]) => B.aabb("paving", x0, 0, z0, x1, 0.12, z1, 0xf2eee8));
  }

  /** Carpark: asphalt, white bay lines, kerb stops, a driveway to the N–S road. */
  function carpark(B, cp) {
    B.aabb("asphalt", cp.x0, 0, cp.z0, cp.x1, 0.03, cp.z1, 0xd8d8d8);
    B.aabb("asphalt", cp.x1, 0, 36, -3.5, 0.14, 40, 0xd8d8d8);
    for (let z = cp.z0; z <= cp.z0 + 15; z += 2.5) {
      B.box("marking", cp.x0 + 2.5, 0.04, z, 5, 0.01, 0.1, 0xffffff);
      B.box("marking", cp.x1 - 2.5, 0.04, z, 5, 0.01, 0.1, 0xffffff);
    }
  }

  /** Park: benches along the paths, a gazebo, grassy mounds left to the default ground. */
  const BENCHES = [36, 21, 42, 21, 36, 17, 56, 33, 20, 33.6];
  /** Build the park: benches (with colliders) and the gazebo. */
  function park(B, pk, ctx) {
    for (let i = 0; i < BENCHES.length; i += 2) {
      const x = BENCHES[i];
      const z = BENCHES[i + 1];
      B.aabb("wood", x - 0.9, 0.42, z - 0.25, x + 0.9, 0.5, z + 0.25, 0xa0714a);
      B.aabb("concrete", x - 0.8, 0, z - 0.2, x - 0.6, 0.42, z + 0.2, 0xbab6ae);
      B.aabb("concrete", x + 0.6, 0, z - 0.2, x + 0.8, 0.42, z + 0.2, 0xbab6ae);
      P.collide(ctx.colliders, x - 0.95, x + 0.95, z - 0.3, z + 0.3, "bench");
    }
    gazebo(B, 60, 22, ctx);
  }
  /** Timber gazebo with a tiled pyramid roof and a table. */
  function gazebo(B, gx, gz, ctx) {
    B.aabb("tiles", gx - 3, 0, gz - 3, gx + 3, 0.15, gz + 3, 0xe9dcc8);
    [-2.6, 2.6].forEach((dx) => {
      [-2.6, 2.6].forEach((dz) => {
        B.box("wood", gx + dx, 1.4, gz + dz, 0.2, 2.8, 0.2, 0x7a4a26);
        P.collide(
          ctx.colliders,
          gx + dx - 0.2,
          gx + dx + 0.2,
          gz + dz - 0.2,
          gz + dz + 0.2,
          "gazebo",
        );
      });
    });
    const roof = P.cached("gazebo", () => new THREE.ConeGeometry(4.4, 1.8, 4));
    B.geo("roof", roof, P.compose(gx, 3.7, gz, Math.PI / 4, 1, 1, 1));
    B.aabb("wood", gx - 1.2, 0.15, gz - 0.5, gx + 1.2, 0.75, gz + 0.5, 0x8a5a32);
    P.collide(ctx.colliders, gx - 1.3, gx + 1.3, gz - 0.6, gz + 0.6, "gazebo-table");
    B.aabb("paving", 50.6, 0, 18, gx - 3, 0.12, 20, 0xf2eee8);
  }

  /** Trees: [x, z, scale, kind]. */
  const TREES = [
    [40, 26, 1.1, "rain"],
    [53, 14, 1.0, "rain"],
    [66, 30, 1.15, "rain"],
    [42, 35, 0.95, "rain"],
    [58, 36, 1.0, "rain"],
    [66, 14, 0.9, "rain"],
    [-64, -24, 1.1, "rain"],
    [-64, -44, 1.0, "rain"],
    [-55, -14, 0.8, "rain"],
    [-22, -40, 0.75, "street"],
    [-15, -21, 0.75, "street"],
    [-64, 10, 1.0, "rain"],
    [-64, 34, 1.05, "rain"],
    [-64, 64, 0.95, "rain"],
    [-12, 60, 1.0, "rain"],
    [-30, 36, 0.8, "street"],
    [-48, 36, 0.8, "street"],
    [10, 64, 1.0, "rain"],
    [24, 52, 0.95, "rain"],
    [8, 40, 0.8, "street"],
    [30, 40, 0.8, "street"],
    [10, -50, 1.0, "rain"],
    [10, -64, 0.9, "rain"],
    [30, -50, 1.0, "rain"],
    [-66, -64, 0.9, "rain"],
  ];
  const streetVerge = () => {
    const out = [];
    for (let t = -64; t <= 64; t += 16) {
      if (Math.abs(t) < 12) continue;
      out.push([t, 8.0, 0.7, "street"], [-8.0, t, 0.7, "street"]);
    }
    const skip = ([x, z]) =>
      (x > 12 && x < 32 && z < 10) ||
      (x < -6 && z > 26 && z < 47) ||
      (x === 48 && z === 8) ||
      (x === -8 && z === -32);
    return out.filter((t) => !skip(t));
  };
  /** Every tree to plant (park trees and the street verge) as {x, z, s, kind}. */
  function treeList() {
    return TREES.concat(streetVerge()).map(([x, z, s, kind]) => ({ x, z, s, kind }));
  }

  /** Shrub spots along building aprons and plazas. */
  function shrubSpots() {
    const out = [];
    for (let x = -56; x <= -24; x += 1.6) out.push({ x, z: 14.2 }, { x, z: 56.6 });
    for (let x = 34; x <= 64; x += 1.6) out.push({ x, z: 56.6 });
    for (let z = -56; z <= -42; z += 1.6) out.push({ x: 68.6, z });
    for (let x = 12.6; x <= 28; x += 1.6) out.push({ x, z: 29.2 });
    return out;
  }

  P.Town = { plazas, carpark, park, treeList, shrubSpots, PLAZAS };
})((window.KQ = window.KQ || {}));
