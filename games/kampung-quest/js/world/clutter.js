/* Kampung Quest — street clutter (KQ.WorldParts.Clutter): parked bicycles and motorbikes
   (instanced, static), potted plants, bollards, clipped hedges, and hawker steam sprites. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const col = (c, x, z, hx, hz, kind) => c.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, kind });

  /** Bicycle frame + wheel geometries (built once, merged). */
  function bikeGeos() {
    return P.cached("bike", () => {
      const B = new P.Batch();
      const bar = (x0, y0, x1, y1) => {
        const len = Math.hypot(x1 - x0, y1 - y0);
        B.box("f", (x0 + x1) / 2, (y0 + y1) / 2, 0, len, 0.04, 0.04, 0xffffff, [0, 0, Math.atan2(y1 - y0, x1 - x0)]);
      };
      bar(-0.48, 0.32, 0, 0.32);
      bar(0, 0.32, 0.38, 0.66);
      bar(-0.48, 0.32, -0.2, 0.66);
      bar(-0.2, 0.66, 0.38, 0.66);
      bar(0.48, 0.32, 0.38, 0.8);
      bar(-0.2, 0.66, -0.24, 0.78);
      B.box("f", -0.24, 0.8, 0, 0.22, 0.05, 0.1, 0xffffff);
      B.box("f", 0.38, 0.82, 0, 0.05, 0.04, 0.5, 0xffffff);
      const frame = B.build({ f: new THREE.MeshBasicMaterial() })[0].geometry;
      const W = new P.Batch();
      const tor = new THREE.TorusGeometry(0.3, 0.03, 6, 20);
      [-0.48, 0.48].forEach((x) => W.geo("w", tor, P.compose(x, 0.32, 0, 0, 1, 1, 1)));
      const wheels = W.build({ w: new THREE.MeshBasicMaterial() })[0].geometry;
      return { frame, wheels };
    });
  }

  /** Motorbike body/seat + wheel geometries (built once). */
  function motoGeos() {
    return P.cached("moto", () => {
      const B = new P.Batch();
      B.box("b", 0, 0.5, 0, 1.0, 0.36, 0.34, 0xffffff);
      B.box("b", -0.15, 0.74, 0, 0.6, 0.1, 0.3, 0x222222);
      B.box("b", 0.52, 0.72, 0, 0.12, 0.46, 0.12, 0xffffff, [0, 0, -0.3]);
      B.box("b", 0.6, 0.98, 0, 0.06, 0.06, 0.62, 0x333333);
      const body = B.build({ b: new THREE.MeshBasicMaterial() })[0].geometry;
      const W = new P.Batch();
      const cylG = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 16).rotateX(Math.PI / 2);
      [-0.55, 0.62].forEach((x) => W.geo("w", cylG, P.compose(x, 0.26, 0, 0, 1, 1, 1)));
      const wheels = W.build({ w: new THREE.MeshBasicMaterial() })[0].geometry;
      return { body, wheels };
    });
  }

  const BIKES = [[-30.5, 17.6, 0], [-29.7, 17.6, 0], [-28.9, 17.6, 0], [13.2, -8.4, 1.57], [13.2, -7.6, 1.57], [36.5, 47.4, 0], [37.3, 47.4, 0], [25.4, 7.6, 0]];
  const MOTOS = [[-19.2, 41.2, 1.57], [-19.2, 42.2, 1.57], [-19.2, 43.2, 1.57], [61, -7.3, 0], [63, -7.3, 0], [-25.4, 48.2, 0]];
  const BIKE_COLS = [0x2f6fb0, 0xd94f4f, 0x2b2b2b, 0xf2c230, 0x3f9a5a, 0xe8e8e8, 0x8a4fbf, 0xd9773a];

  /** Bicycles + motorbikes as four instanced meshes. */
  function vehicles(group, mats, colliders) {
    const bg = bikeGeos();
    const mg = motoGeos();
    const one = (list, extra) => list.map(([x, z, ry], i) => Object.assign({ x, y: 0.13, z, ry, color: BIKE_COLS[i % BIKE_COLS.length] }, extra));
    const paint = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.3, clearcoat: 0.8 });
    const ims = [
      P.instanced(bg.frame, paint, one(BIKES)), P.instanced(bg.wheels, mats.dark, one(BIKES, { color: 0x1c1c1c })),
      P.instanced(mg.body, paint, one(MOTOS)), P.instanced(mg.wheels, mats.dark, one(MOTOS, { color: 0x1c1c1c })),
    ];
    ims.forEach((m, i) => (m.name = ["bikes", "bikeWheels", "motos", "motoWheels"][i]));
    group.add(...ims);
    BIKES.forEach(([x, z, ry]) => col(colliders, x, z, ry ? 0.2 : 0.55, ry ? 0.55 : 0.2, "bike"));
    MOTOS.forEach(([x, z, ry]) => col(colliders, x, z, ry ? 0.25 : 0.7, ry ? 0.7 : 0.25, "moto"));
  }

  const POTS = [
    [-27, 21.5], [-53, 21.5], [-45, 50.5], [-27, 50.5], [37, 50.5], [61, 50.5], [13.5, -11], [38.8, -11], [-26.8, -20.5], [-26.8, -44],
    [45, -12.9], [67.2, -12.9], [45.5, -39], [65.5, -39], [-14, -12], [-14, -55],
  ];

  /** Glazed pots with leafy plants (pots batched, foliage as blobs). */
  function pots(B, colliders, out) {
    POTS.forEach(([x, z], i) => {
      const c = [0x8a4a2a, 0x2f5f7a, 0xd9cbb0, 0x3a3a3a][i % 4];
      B.geo("plastic", P.cached("pot", () => new THREE.CylinderGeometry(0.34, 0.24, 0.6, 16)), P.compose(x, 0.42, z, 0, 1, 1, 1), c);
      out.push({ x, z });
      col(colliders, x, z, 0.35, 0.35, "pot");
    });
  }

  /** Bollards along the hawker / shops forecourt edge and the carpark. */
  function bollards(B, colliders) {
    const spots = [];
    for (let x = 13; x <= 68; x += 3) if (Math.abs(x - 19) > 1.5 && Math.abs(x - 26) > 1.5 && Math.abs(x - 46.5) > 1.5 && Math.abs(x - 55) > 1.5 && Math.abs(x - 66.5) > 1.5 && Math.abs(x - 41.7) > 1.5) spots.push([x, -6.35]);
    for (let z = 29; z <= 43; z += 2.5) spots.push([-7.6, z]);
    spots.forEach(([x, z]) => {
      B.cyl("paint", x, 0.55, z, 0.09, 0.9, 12, 0x3d4247);
      B.cyl("paint", x, 0.82, z, 0.095, 0.08, 12, 0xe8b818);
      col(colliders, x, z, 0.12, 0.12, "bollard");
    });
  }

  /** Clipped hedges (leaf material boxes) along the carpark and park paths. */
  function hedges(B, colliders) {
    const runs = [[-20.6, 28, -20.2, 44], [-7.4, 44, -7.0, 47], [28, 17.4, 43, 17.8], [28, 20.2, 46.6, 20.6], [-56, 13.4, -42, 13.9], [-33, 13.4, -24, 13.9]];
    runs.forEach(([x0, z0, x1, z1]) => {
      B.aabb("leaf", x0, 0, z0, x1, 0.75, z1, 0xd8e8c0);
      colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, kind: "hedge" });
    });
  }

  /** Steam sprites over the soup pots, kettles and satay grill (animated by the runtime). */
  function steam(group, spots) {
    const mat = new THREE.SpriteMaterial({ map: P.Patterns2.puff(), transparent: true, depthWrite: false, opacity: 0.5 });
    const list = [];
    spots.forEach((p, i) => {
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Sprite(mat);
        s.userData = { base: p, phase: (k / 3 + i * 0.17) % 1 };
        s.name = "steam";
        group.add(s);
        list.push(s);
      }
    });
    return list;
  }
  function animateSteam(list, t) {
    list.forEach((s) => {
      const u = (t * 0.35 + s.userData.phase) % 1;
      const b = s.userData.base;
      s.position.set(b.x + Math.sin(u * 6 + b.x) * 0.12, b.y + u * 1.3, b.z);
      s.scale.setScalar(0.35 + u * 0.8);
      s.material.opacity = 0.45;
    });
  }

  P.Clutter = { vehicles, pots, bollards, hedges, steam, animateSteam, POTS };
})((window.KQ = window.KQ || {}));
