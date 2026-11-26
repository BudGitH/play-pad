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
  function hallWalls(B, m, ctx) {
    const h = m.hall;
    const y = PLINTH;
    const run = (o) => M().wallRun(B, ctx, Object.assign({ y, h: h.h, color: WALL }, o));
    run({ x0: h.x0, z0: h.z0, x1: h.x1, z1: h.z0, types: ["win", "win", "win", "win", "win"] });
    run({ x0: h.x1, z0: h.z1, x1: h.x0, z1: h.z1, types: ["win", "door", "win", "win", "win"] });
    run({ x0: h.x1, z0: h.z0, x1: h.x1, z1: h.z1, types: ["win", "win", "door", "door", "win", "win"] });
    run({ x0: h.x0, z0: h.z0, x1: h.x0, z1: -34.3, types: ["solid", "solid", "solid"] });
    run({ x0: h.x0, z0: -34.3, x1: h.x0, z1: -31.7, types: ["door"] });
    run({ x0: h.x0, z0: -31.7, x1: h.x0, z1: h.z1, types: ["solid", "solid", "solid"] });
    [[h.x0, h.z0], [h.x1, h.z0], [h.x0, h.z1], [h.x1, h.z1]].forEach(([x, z]) => {
      B.box("plaster", x, y + h.h / 2 + 0.3, z, 0.8, h.h + 0.6, 0.8, WALL);
      B.box("plaster", x, y + 0.6, z, 0.86, 1.2, 0.86, TEAL);
    });
    const men = ctx.atlas.sign({ w: 3, h: 0.6, text: "LELAKI · MEN", bg: "#1f7a74", bg2: "#17615c" });
    B.plane("sign", h.x1 + 0.2, 3.9, -33, 2.6, 0.52, Math.PI / 2, men);
    const women = ctx.atlas.sign({ w: 3, h: 0.6, text: "WANITA · WOMEN", bg: "#7a3f74", bg2: "#62325d" });
    B.plane("sign", (m.womenDoor.x0 + m.womenDoor.x1) / 2, 3.9, h.z1 + 0.2, 2.6, 0.52, 0, women);
  }

  /** Flat roof, cornice, crenellations, the dome and four corner kiosks. */
  function hallRoof(B, m) {
    const h = m.hall;
    const top = PLINTH + h.h;
    B.aabb("plaster", h.x0 - 0.3, top - 0.1, h.z0 - 0.3, h.x1 + 0.3, top + 0.35, h.z1 + 0.3, 0xefe9dc);
    B.aabb("paint", h.x0 - 0.42, top - 0.35, h.z0 - 0.42, h.x1 + 0.42, top - 0.1, h.z1 + 0.42, TEAL);
    const merlon = (x, z) => B.box("plaster", x, top + 0.6, z, 0.45, 0.5, 0.45, WALL);
    for (let x = h.x0; x <= h.x1 + 0.01; x += 1) merlon(x, h.z0 - 0.2), merlon(x, h.z1 + 0.2);
    for (let z = h.z0 + 1; z < h.z1; z += 1) merlon(h.x0 - 0.2, z), merlon(h.x1 + 0.2, z);
    M().dome(B, (h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2, top + 0.35, 5);
    [[h.x0, h.z0], [h.x1, h.z0], [h.x0, h.z1], [h.x1, h.z1]].forEach(([x, z]) => kiosk(B, x, z, top + 0.35));
  }
  function kiosk(B, x, z, y) {
    [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(([dx, dz]) => B.box("plaster", x + dx, y + 0.7, z + dz, 0.16, 1.4, 0.16, WALL));
    B.box("plaster", x, y + 1.45, z, 1.3, 0.14, 1.3, WALL);
    M().dome(B, x, z, y + 1.5, 0.75);
  }

  /** East verandah: arcade, roof, men's shoe racks. */
  function verandah(B, m, ctx) {
    const h = m.hall;
    const v = m.verandah;
    M().wallRun(B, ctx, { x0: v.x1, z0: h.z0, x1: v.x1, z1: h.z1, y: PLINTH, h: 4.4, color: WALL, types: Array(6).fill("arcade") });
    B.aabb("plaster", v.x0, PLINTH + 4.4, h.z0 - 0.2, v.x1 + 0.3, PLINTH + 4.75, h.z1 + 0.2, 0xefe9dc);
    B.aabb("paint", v.x1 - 0.05, PLINTH + 4.2, h.z0 - 0.2, v.x1 + 0.35, PLINTH + 4.4, h.z1 + 0.2, TEAL);
    [-39.4, -26.6].forEach((z) => {
      B.aabb("wood", v.x0 + 0.3, PLINTH, z - 0.9, v.x0 + 0.75, PLINTH + 1.0, z + 0.9, 0x7a5232);
      for (let i = 0; i < 6; i++) B.box("paint", v.x0 + 0.52, PLINTH + 0.3 + (i % 3) * 0.33, z - 0.6 + Math.floor(i / 3) * 0.7, 0.3, 0.08, 0.22, [0x2a2a2a, 0x6b4a2a, 0x3f6fb0][i % 3]);
      ctx.colliders.push({ minX: v.x0 + 0.2, maxX: v.x0 + 0.85, minZ: z - 1, maxZ: z + 1, kind: "rack" });
    });
  }

  P.MosqueShell = { grounds, hallWalls, hallRoof, verandah, PLINTH, WALL, TEAL };
})((window.KQ = window.KQ || {}));
