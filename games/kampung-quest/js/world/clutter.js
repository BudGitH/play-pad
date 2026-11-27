/* Kampung Quest — street clutter (KQ.WorldParts.Clutter): potted plants, bollards, clipped hedges, and hawker
   steam sprites. (The parked bicycles, scooters and cars are drivable vehicles now: game/vehicle-spots.js.) */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const col = (c, x, z, hx, hz, kind) =>
    c.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, kind });

  const POTS = [
    [-27, 21.5],
    [-53, 21.5],
    [-45, 50.5],
    [-27, 50.5],
    [37, 50.5],
    [61, 50.5],
    [13.5, -11],
    [38.8, -11],
    [-26.8, -20.5],
    [-26.8, -44],
    [45, -12.9],
    [67.2, -12.9],
    [45.5, -39],
    [65.5, -39],
    [-14, -12],
    [-14, -55],
  ];

  /** Glazed pots with leafy plants (pots batched, foliage as blobs). */
  function pots(B, colliders, out) {
    POTS.forEach(([x, z], i) => {
      const c = [0x8a4a2a, 0x2f5f7a, 0xd9cbb0, 0x3a3a3a][i % 4];
      B.geo(
        "plastic",
        P.cached("pot", () => new THREE.CylinderGeometry(0.34, 0.24, 0.6, 16)),
        P.compose(x, 0.42, z, 0, 1, 1, 1),
        c,
      );
      out.push({ x, z });
      col(colliders, x, z, 0.35, 0.35, "pot");
    });
  }

  /** Bollards along the hawker / shops forecourt edge and the carpark. */
  function bollards(B, colliders) {
    const spots = [];
    for (let x = 13; x <= 68; x += 3)
      if (
        Math.abs(x - 19) > 1.5 &&
        Math.abs(x - 26) > 1.5 &&
        Math.abs(x - 46.5) > 1.5 &&
        Math.abs(x - 55) > 1.5 &&
        Math.abs(x - 66.5) > 1.5 &&
        Math.abs(x - 41.7) > 1.5
      )
        spots.push([x, -6.35]);
    for (let z = 29; z <= 43; z += 2.5) spots.push([-7.6, z]);
    spots.forEach(([x, z]) => {
      B.cyl("paint", x, 0.55, z, 0.09, 0.9, 12, 0x3d4247);
      B.cyl("paint", x, 0.82, z, 0.095, 0.08, 12, 0xe8b818);
      col(colliders, x, z, 0.12, 0.12, "bollard");
    });
  }

  /** Clipped hedges (leaf material boxes) along the carpark and park paths. */
  function hedges(B, colliders) {
    const runs = [
      [-20.6, 28, -20.2, 44],
      [-7.4, 44, -7.0, 47],
      [28, 17.4, 43, 17.8],
      [28, 20.2, 46.6, 20.6],
      [-56, 13.4, -42, 13.9],
      [-33, 13.4, -24, 13.9],
    ];
    runs.forEach(([x0, z0, x1, z1]) => {
      B.aabb("hedge", x0, 0, z0, x1, 0.66, z1, 0xc8d4b8);
      B.aabb("hedge", x0 + 0.06, 0.66, z0 + 0.06, x1 - 0.06, 0.8, z1 - 0.06, 0xe4ecd8);
      P.collide(colliders, x0, x1, z0, z1, "hedge");
    });
  }

  /** Steam sprites over the soup pots, kettles and satay grill (animated by the runtime). */
  function steam(group, spots) {
    const mat = new THREE.SpriteMaterial({
      map: P.Patterns2.puff(),
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    });
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
  /**
   * Drift each steam sprite upward in a looping rise, growing as it goes (cheap, no per-frame
   * allocation).
   */
  function animateSteam(list, t) {
    list.forEach((s) => {
      const u = (t * 0.35 + s.userData.phase) % 1;
      const b = s.userData.base;
      s.position.set(b.x + Math.sin(u * 6 + b.x) * 0.12, b.y + u * 1.3, b.z);
      s.scale.setScalar(0.35 + u * 0.8);
      s.material.opacity = 0.45;
    });
  }

  P.Clutter = { pots, bollards, hedges, steam, animateSteam, POTS };
})((window.KQ = window.KQ || {}));
