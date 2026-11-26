/* Kampung Quest — the mosque, part 2 (KQ.WorldParts.MosqueShell): plinth, prayer-hall walls
   with arched windows and separate men's (east) and women's (south) doors, roof with
   crenellations, dome and corner kiosks, the east verandah arcade with shoe racks, the
   compound wall with gates and the minaret. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const M = () => P.Mosque;
  const PLINTH = 0.22;
  const WALL = 0xf7f3ea;
  const TEAL = 0x1f7a74;

  /** Courtyard, paths and the raised hall + verandah plinth. */
  function grounds(B, m) {
    const h = m.hall;
    B.aabb("marble", -28, 0, m.z0 + 0.4, m.x1 - 0.4, 0.12, m.z1 - 0.4, 0xffffff);
    B.aabb("paving", m.x0 + 0.4, 0, h.z0 - 4, -28, 0.1, h.z1 + 4, 0xeeeeee);
    B.aabb("paving", m.womenDoor.x0, 0, h.z1, m.womenDoor.x1, 0.1, m.z1 - 0.2, 0xeeeeee);
    B.aabb("marble", h.x0 - 0.6, 0, h.z0 - 0.6, m.verandah.x1 + 0.4, PLINTH, h.z1 + 0.6, 0xf2efe8);
  }

  /** The four hall walls, corner pilasters and door signs. */
  const corners = (h) => [h.x0, h.z0, h.x1, h.z0, h.x0, h.z1, h.x1, h.z1];
  /**
   * Build the prayer hall's four wall runs (windows, doors, solid sections) with their colliders.
   */
  function hallWalls(B, m, ctx) {
    const h = m.hall;
    const y = PLINTH;
    const run = (x0, z0, x1, z1, types) => {
      M().wallRun(B, ctx, { x0, z0, x1, z1, types, y, h: h.h, color: WALL });
    };
    const W = "win";
    const SO = "solid";
    run(h.x0, h.z0, h.x1, h.z0, [W, W, W, W, W]);
    run(h.x1, h.z1, h.x0, h.z1, [W, "door", W, W, W]);
    run(h.x1, h.z0, h.x1, h.z1, [W, W, "door", "door", W, W]);
    run(h.x0, h.z0, h.x0, -34.3, [SO, SO, SO]);
    run(h.x0, -34.3, h.x0, -31.7, ["door"]);
    run(h.x0, -31.7, h.x0, h.z1, [SO, SO, SO]);
    const c = corners(h);
    for (let i = 0; i < 8; i += 2) {
      B.box("plaster", c[i], y + h.h / 2 + 0.3, c[i + 1], 0.8, h.h + 0.6, 0.8, WALL);
      B.box("plaster", c[i], y + 0.6, c[i + 1], 0.86, 1.2, 0.86, TEAL);
    }
    doorSigns(B, m, ctx);
  }
  /** Separate, clearly signed entrances: men (east), women (south). */
  function doorSigns(B, m, ctx) {
    const h = m.hall;
    const A = ctx.atlas;
    const men = A.sign({ w: 3, h: 0.6, text: "LELAKI · MEN", bg: "#1f7a74", bg2: "#17615c" });
    B.plane("sign", h.x1 + 0.2, 3.9, -33, 2.6, 0.52, Math.PI / 2, men);
    const women = A.sign({ w: 3, h: 0.6, text: "WANITA · WOMEN", bg: "#7a3f74", bg2: "#62325d" });
    const wx = (m.womenDoor.x0 + m.womenDoor.x1) / 2;
    B.plane("sign", wx, 3.9, h.z1 + 0.2, 2.6, 0.52, 0, women);
  }

  /** Flat roof, cornice, crenellations, the dome and four corner kiosks. */
  function hallRoof(B, m) {
    const h = m.hall;
    const top = PLINTH + h.h;
    const [x0, x1, z0, z1] = [h.x0, h.x1, h.z0, h.z1];
    B.aabb("plaster", x0 - 0.3, top - 0.1, z0 - 0.3, x1 + 0.3, top + 0.35, z1 + 0.3, 0xefe9dc);
    const lo = top - 0.35;
    const hi = top - 0.1;
    B.aabb("paint", x0 - 0.42, lo, z0 - 0.42, x1 + 0.42, hi, z0 + 0.2, TEAL);
    B.aabb("paint", x0 - 0.42, lo, z1 - 0.2, x1 + 0.42, hi, z1 + 0.42, TEAL);
    B.aabb("paint", x0 - 0.42, lo, z0, x0 + 0.2, hi, z1, TEAL);
    B.aabb("paint", x1 - 0.2, lo, z0, x1 + 0.42, hi, z1, TEAL);
    B.aabb("paint", x0 + 0.2, top - 0.14, z0 + 0.2, x1 - 0.2, hi, z1 - 0.2, 0xfbf7ee);
    const rosette = P.cached("rosette", () =>
      new THREE.CircleGeometry(3.2, 40).rotateX(Math.PI / 2),
    );
    B.geo("tilework", rosette, P.compose((x0 + x1) / 2, top - 0.145, (z0 + z1) / 2, 0, 1, 1, 1));
    const merlon = (x, z) => B.box("plaster", x, top + 0.6, z, 0.45, 0.5, 0.45, WALL);
    for (let x = x0; x <= x1 + 0.01; x += 1) merlon(x, z0 - 0.2), merlon(x, z1 + 0.2);
    for (let z = z0 + 1; z < z1; z += 1) merlon(x0 - 0.2, z), merlon(x1 + 0.2, z);
    M().dome(B, (x0 + x1) / 2, (z0 + z1) / 2, top + 0.35, 5);
    const c = corners(h);
    for (let i = 0; i < 8; i += 2) kiosk(B, c[i], c[i + 1], top + 0.35);
  }

  /** A small open pavilion with four posts, a flat roof and a dome. */
  function kiosk(B, x, z, y) {
    [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ].forEach(([dx, dz]) => B.box("plaster", x + dx, y + 0.7, z + dz, 0.16, 1.4, 0.16, WALL));
    B.box("plaster", x, y + 1.45, z, 1.3, 0.14, 1.3, WALL);
    M().dome(B, x, z, y + 1.5, 0.75);
  }

  /** East verandah: arcade, roof, men's shoe racks. */
  function verandah(B, m, ctx) {
    const h = m.hall;
    const v = m.verandah;
    const arcade = { x0: v.x1, z0: h.z0, x1: v.x1, z1: h.z1, y: PLINTH, h: 4.4, color: WALL };
    M().wallRun(B, ctx, Object.assign(arcade, { types: Array(6).fill("arcade") }));
    const y = PLINTH + 4.4;
    B.aabb("plaster", v.x0, y, h.z0 - 0.2, v.x1 + 0.3, y + 0.35, h.z1 + 0.2, 0xefe9dc);
    B.aabb("paint", v.x1 - 0.05, y - 0.2, h.z0 - 0.2, v.x1 + 0.35, y, h.z1 + 0.2, TEAL);
    const xm = (v.x0 + v.x1) / 2;
    for (let z = h.z0 + 3; z < h.z1; z += 5) {
      B.box("lamp", xm, y - 0.04, z, 0.5, 0.06, 0.5, 0xffffff);
      ctx.pools.push({ x: xm, z, s: 0.6, y: y - 0.3 });
    }
    [-39.4, -26.6].forEach((z) => shoeRack(B, v.x0, z, ctx));
  }
  const SHOES = [0x2a2a2a, 0x6b4a2a, 0x3f6fb0];
  /** A shoe rack with a few pairs of shoes on it. */
  function shoeRack(B, x, z, ctx) {
    B.aabb("wood", x + 0.3, PLINTH, z - 0.9, x + 0.75, PLINTH + 1.0, z + 0.9, 0x7a5232);
    for (let i = 0; i < 6; i++) {
      const y = PLINTH + 0.3 + (i % 3) * 0.33;
      B.box("paint", x + 0.52, y, z - 0.6 + Math.floor(i / 3) * 0.7, 0.3, 0.08, 0.22, SHOES[i % 3]);
    }
    P.collide(ctx.colliders, x + 0.2, x + 0.85, z - 1, z + 1, "rack");
  }

  P.MosqueShell = { grounds, hallWalls, hallRoof, verandah, PLINTH, WALL, TEAL };
})((window.KQ = window.KQ || {}));
