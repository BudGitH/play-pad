/* Kampung Quest — town fill (KQ.WorldParts.Town): paved plazas joining buildings to the
   sidewalks, the park (paths, benches, gazebo), the carpark and parked cars, and the
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
    [-57, 25.5, -23, 27], [-57, 44.5, -23, 46], // block A/B aprons
    [-23, 15, -20, 56], // lane past the blocks to the carpark
    [-20, 44, -6, 47], // carpark footpath to the N–S road
    [33, 44.5, 65, 46], // block C apron
    [10, 6, 30, 14], // playground / bus stop forecourt
    [28, 18, 47.4, 20], // park path east–west
    [6, 30, 34, 32], // path from the N–S road into the park
  ];

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

  /** Parked cars: [x, z, rotY, colour]. Static props, never driven. */
  const CARS = [
    [-17.5, 29.25, Math.PI / 2, 0xc8ccd0], [-17.5, 31.75, Math.PI / 2, 0x2a3c5c], [-17.5, 36.75, Math.PI / 2, 0xb02a2a],
    [-10.5, 29.25, -Math.PI / 2, 0xf2f2f0], [-10.5, 34.25, -Math.PI / 2, 0x1d1d1f], [-10.5, 41.75, -Math.PI / 2, 0x5a7d9a],
    [60, 2, Math.PI / 2, 0x2f6fb0], [-62, -2, -Math.PI / 2, 0xe8b818],
  ];

  /** Car parts as three instanced meshes (body, glasshouse, wheels). */
  function cars(group, mats, colliders) {
    const body = [];
    const cabin = [];
    const wheels = [];
    CARS.forEach(([x, z, ry, c]) => {
      const fx = Math.sin(ry);
      const fz = Math.cos(ry);
      body.push({ x, y: 0.52, z, ry, color: c });
      cabin.push({ x: x - fx * 0.15, y: 0.98, z: z - fz * 0.15, ry, color: c });
      [[-0.85, -0.58], [0.85, -0.58], [-0.85, 0.58], [0.85, 0.58]].forEach(([a, b]) => {
        wheels.push({ x: x + fx * a + fz * b, y: 0.3, z: z + fz * a - fx * b, rot: [0, ry + Math.PI / 2, Math.PI / 2] });
      });
      const hx = Math.abs(fx) * 1.45 + Math.abs(fz) * 0.7;
      const hz = Math.abs(fz) * 1.45 + Math.abs(fx) * 0.7;
      colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, kind: "car" });
    });
    const paint = new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 });
    const gBody = new THREE.BoxGeometry(1.22, 0.52, 2.75);
    const gCab = new THREE.BoxGeometry(1.08, 0.46, 1.5);
    const gWheel = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const glass = new THREE.MeshStandardMaterial({ color: 0x1c252e, roughness: 0.08, metalness: 0.6 });
    const ims = [P.instanced(gBody, paint, body), P.instanced(gCab, glass, cabin), P.instanced(gWheel, mats.dark, wheels)];
    ims[1].instanceColor = null;
    ims.forEach((m, i) => (m.name = ["carBodies", "carGlass", "carWheels"][i]));
    group.add(...ims);
  }

  /** Park: benches along the paths, a gazebo, grassy mounds left to the default ground. */
  function park(B, pk, ctx) {
    [[36, 21], [42, 21], [36, 17], [56, 33], [20, 33.6]].forEach(([x, z]) => {
      B.aabb("wood", x - 0.9, 0.42, z - 0.25, x + 0.9, 0.5, z + 0.25, 0xa0714a);
      B.aabb("concrete", x - 0.8, 0, z - 0.2, x - 0.6, 0.42, z + 0.2, 0xbab6ae);
      B.aabb("concrete", x + 0.6, 0, z - 0.2, x + 0.8, 0.42, z + 0.2, 0xbab6ae);
      ctx.colliders.push({ minX: x - 0.95, maxX: x + 0.95, minZ: z - 0.3, maxZ: z + 0.3, kind: "bench" });
    });
    const gx = 60;
    const gz = 22;
    B.aabb("tiles", gx - 3, 0, gz - 3, gx + 3, 0.15, gz + 3, 0xe9dcc8);
    [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].forEach(([dx, dz]) => {
      B.box("wood", gx + dx, 1.4, gz + dz, 0.2, 2.8, 0.2, 0x7a4a26);
      ctx.colliders.push({ minX: gx + dx - 0.2, maxX: gx + dx + 0.2, minZ: gz + dz - 0.2, maxZ: gz + dz + 0.2, kind: "gazebo" });
    });
    B.geo("roof", P.cached("gazebo", () => new THREE.ConeGeometry(4.4, 1.8, 4)), P.compose(gx, 3.7, gz, Math.PI / 4, 1, 1, 1), 0xffffff);
    B.aabb("wood", gx - 1.2, 0.15, gz - 0.5, gx + 1.2, 0.75, gz + 0.5, 0x8a5a32);
    ctx.colliders.push({ minX: gx - 1.3, maxX: gx + 1.3, minZ: gz - 0.6, maxZ: gz + 0.6, kind: "gazebo-table" });
    B.aabb("paving", 50.6, 0, 18, gx - 3, 0.12, 20, 0xf2eee8);
  }

  /** Trees: [x, z, scale, kind]. */
  const TREES = [
    [40, 26, 1.1, "rain"], [53, 14, 1.0, "rain"], [66, 30, 1.15, "rain"], [42, 35, 0.95, "rain"], [58, 36, 1.0, "rain"], [66, 14, 0.9, "rain"],
    [-64, -24, 1.1, "rain"], [-64, -44, 1.0, "rain"], [-55, -14, 0.8, "rain"], [-22, -40, 0.75, "street"], [-15, -21, 0.75, "street"],
    [-64, 10, 1.0, "rain"], [-64, 34, 1.05, "rain"], [-64, 64, 0.95, "rain"], [-12, 60, 1.0, "rain"], [-30, 36, 0.8, "street"], [-48, 36, 0.8, "street"],
    [10, 64, 1.0, "rain"], [24, 52, 0.95, "rain"], [8, 40, 0.8, "street"], [30, 40, 0.8, "street"],
    [10, -50, 1.0, "rain"], [10, -64, 0.9, "rain"], [30, -50, 1.0, "rain"], [-66, -64, 0.9, "rain"],
  ];
  const streetVerge = () => {
    const out = [];
    for (let t = -64; t <= 64; t += 16) {
      if (Math.abs(t) < 12) continue;
      out.push([t, 8.0, 0.7, "street"], [-8.0, t, 0.7, "street"]);
    }
    const skip = ([x, z]) => (x > 12 && x < 32 && z < 10) || (x < -6 && z > 26 && z < 47) || (x === 48 && z === 8) || (x === -8 && z === -32);
    return out.filter((t) => !skip(t));
  };
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

  P.Town = { plazas, carpark, cars, park, treeList, shrubSpots, PLAZAS };
})((window.KQ = window.KQ || {}));
