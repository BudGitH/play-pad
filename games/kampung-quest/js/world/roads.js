/* Kampung Quest — ground, roads, kerbs, sidewalks, markings, zebra crossings with Belisha
   beacons, and street lamps (KQ.WorldParts.Roads). Everything is pushed into the shared Batch. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const FAR = 220; // roads run on past the town edge into the fog

  /** Grass ground + asphalt carriageways (both roads, extended to the horizon). */
  function carriageways(B, L) {
    const r = L.road.half;
    B.aabb("grass", -FAR * 1.4, -0.2, -FAR * 1.4, FAR * 1.4, 0, FAR * 1.4);
    B.aabb("asphalt", -FAR, -0.2, -r, FAR, 0.01, r, 0x707070);
    B.aabb("asphalt", -r, -0.2, -FAR, r, 0.012, -r, 0x707070);
    B.aabb("asphalt", -r, -0.2, r, r, 0.012, FAR, 0x707070);
  }

  /** Sidewalk slabs and kerbs along both sides of both roads (corners shared). */
  function sidewalks(B, L) {
    const r = L.road.half;
    const w = L.road.walk;
    const k = L.road.kerb;
    [-1, 1].forEach((s) => {
      const a = s < 0 ? -w : r;
      const b = s < 0 ? -r : w;
      B.aabb("paving", -FAR, 0, a, -r, k, b);
      B.aabb("paving", r, 0, a, FAR, k, b);
      B.aabb("paving", a, 0, -FAR, b, k, -w);
      B.aabb("paving", a, 0, w, b, k, FAR);
      kerbLine(B, s, r, k);
    });
  }
  function kerbLine(B, s, r, k) {
    const e0 = s < 0 ? -r - 0.2 : r;
    const e1 = e0 + 0.2;
    B.aabb("concrete", -FAR, 0, e0, -r, k + 0.015, e1);
    B.aabb("concrete", r, 0, e0, FAR, k + 0.015, e1);
    B.aabb("concrete", e0, 0, -FAR, e1, k + 0.015, -r);
    B.aabb("concrete", e0, 0, r, e1, k + 0.015, FAR);
  }

  /** Dashed white centre lines and solid yellow kerb lines. */
  function laneLines(B, L) {
    const r = L.road.half;
    const y = 0.02;
    for (let t = -FAR; t < FAR; t += 6) {
      if (Math.abs(t) < r + 4 || nearCrossing(L, t)) continue;
      B.box("marking", t + 1.5, y, 0, 3, 0.01, 0.12, 0xf2f2ee);
      B.box("marking", 0, y, t + 1.5, 0.12, 0.01, 3, 0xf2f2ee);
    }
    [-1, 1].forEach((s) => {
      const e = s * (r - 0.25);
      B.aabb("marking", -FAR, y - 0.005, e - 0.05, -r, y + 0.005, e + 0.05, 0xe8b818);
      B.aabb("marking", r, y - 0.005, e - 0.05, FAR, y + 0.005, e + 0.05, 0xe8b818);
      B.aabb("marking", e - 0.05, y - 0.005, -FAR, e + 0.05, y + 0.005, -r, 0xe8b818);
      B.aabb("marking", e - 0.05, y - 0.005, r, e + 0.05, y + 0.005, FAR, 0xe8b818);
    });
  }
  function nearCrossing(L, t) {
    return L.crossings.some((c) => Math.abs(c.at - t) < 9);
  }

  /** Zebra stripes, zig-zag approach lines and a Belisha beacon each side. */
  function crossing(B, L, c) {
    const r = L.road.half;
    const along = (a, b) => (c.axis === "x" ? [c.at + a, b] : [b, c.at + a]);
    for (let s = -r + 0.35; s < r - 0.3; s += 1.0) {
      const p = along(0, s + 0.25);
      if (c.axis === "x") B.box("marking", p[0], 0.022, p[1], 3.2, 0.01, 0.5, 0xf6f6f2);
      else B.box("marking", p[0], 0.022, p[1], 0.5, 0.01, 3.2, 0xf6f6f2);
    }
    zigzags(B, c, r);
    [-1, 1].forEach((side) => {
      const p = along(-2.2, side * (r + 0.9));
      beacon(B, p[0], p[1]);
    });
  }
  function zigzags(B, c, r) {
    [-1, 1].forEach((dir) => {
      for (let i = 0; i < 6; i++) {
        const a = dir * (2.4 + i * 1.0);
        const rot = (i % 2 ? 0.5 : -0.5) + (c.axis === "x" ? 0 : Math.PI / 2);
        [-1, 1].forEach((side) => {
          const b = side * (r - 0.45);
          const x = c.axis === "x" ? c.at + a : b;
          const z = c.axis === "x" ? b : c.at + a;
          B.box("marking", x, 0.021, z, 1.1, 0.01, 0.1, 0xf2f2ee, rot);
        });
      }
    });
  }
  /** Singapore-style Belisha beacon: black/white striped pole, amber globe. */
  function beacon(B, x, z) {
    for (let i = 0; i < 6; i++)
      B.cyl("paint", x, 0.3 + i * 0.4, z, 0.06, 0.4, 10, i % 2 ? 0x1b1b1b : 0xf4f4f0);
    B.geo(
      "beacon",
      P.cached("sph", () => new THREE.SphereGeometry(0.22, 16, 10)),
      P.compose(x, 2.75, z, 0, 1, 1, 1),
    );
  }

  /** A street lamp: pole + arm + head; returns the head position. */
  function lamp(B, x, z, ry) {
    B.cyl("paint", x, 2.6, z, 0.07, 5.2, 10, 0x6f7479);
    B.cyl("paint", x, 0.25, z, 0.13, 0.5, 10, 0x6f7479);
    const dx = Math.sin(ry);
    const dz = Math.cos(ry);
    B.box("paint", x + dx * 0.55, 5.15, z + dz * 0.55, 0.08, 0.08, 1.1, 0x6f7479, ry);
    B.box("paint", x + dx * 1.05, 5.12, z + dz * 1.05, 0.34, 0.12, 0.62, 0x5b6065, ry);
    B.box("lamp", x + dx * 1.05, 5.05, z + dz * 1.05, 0.26, 0.03, 0.5, 0xffffff, ry);
    return new THREE.Vector3(x + dx * 1.05, 5.0, z + dz * 1.05);
  }

  /** Lamps every ~16 m along the outer edge of every sidewalk inside the town. */
  function lamps(B, L, out, colliders) {
    const e = L.road.walk - 0.35;
    const add = (x, z, ry) => {
      out.push(lamp(B, x, z, ry));
      P.collide(colliders, x - 0.2, x + 0.2, z - 0.2, z + 0.2, "lamp");
    };
    for (let t = -L.half + 6; t <= L.half - 4; t += 16) {
      if (Math.abs(t) < 9) continue;
      [-1, 1].forEach((s) => {
        add(t, s * e, s < 0 ? 0 : Math.PI);
        add(s * e, t + 8, s < 0 ? Math.PI / 2 : -Math.PI / 2);
      });
    }
  }

  /** Build the whole street network. `ctx.lamps` collects lamp-head positions. */
  function build(B, ctx) {
    const L = ctx.L;
    carriageways(B, L);
    sidewalks(B, L);
    laneLines(B, L);
    L.crossings.forEach((c) => crossing(B, L, c));
    lamps(B, L, ctx.lamps, ctx.colliders);
  }

  P.Roads = { build, lamp, beacon };
})((window.KQ = window.KQ || {}));
