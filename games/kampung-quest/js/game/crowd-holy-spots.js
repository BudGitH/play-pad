/* ============================================================================
 * FILE: crowd-holy-spots.js
 * PURPOSE: The fixed activity spots of the Haramain crowd, besides prayer rows and readers: dua
 *          with raised hands, groups resting on the marble, family photo groups (with a
 *          photographer), vendors (dates, water, snacks) and their customers, security guards,
 *          cleaners pushing carts along a line, chat circles and the Zamzam queue where people
 *          drink from cups. Each spot is checked against the world colliders.
 * BUSINESS CONTEXT: AC-H2 and the owner's "much more activity" follow-up.
 * DEPENDENCIES: crowd-zones.js (clear), KQ.Sim.Crowd (+ .Pilgrim), KQ.HOLY.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const SC = () => KQ.Sim.Crowd;
  const PL = () => KQ.Sim.Crowd.Pilgrim;
  const TAU = Math.PI * 2;
  const H = (a, b) => SC().hash01(a + ":" + b);

  /** A slot with the fields every holy spot needs. */
  function slot(id, kind, x, z, heading, look, extra) {
    return Object.assign({ id, kind, holy: "hold", x, z, heading, look }, extra || {});
  }

  /** Dua: people standing with open hands facing the Kaaba, in a loose ring around (cx, cz). */
  function duaRing(world, name, cx, cz, n, r0, r1) {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU + H(name, i);
      const r = r0 + (r1 - r0) * H(name + "r", i);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (G.CrowdZones.clear(world, x, z, 0.5)) {
        out.push(
          slot(
            "dua:" + name + ":" + i,
            "dua",
            x,
            z,
            PL().qiblaHeading(x, z),
            { pose: "dua_stand" },
            { holy: "dua" },
          ),
        );
      }
    }
    return out;
  }

  /** Dua places: the Arafah plain, a courtyard corner of the Haram and the Nabawi courtyard. */
  function duaSlots(world) {
    const a = KQ.HOLY.hajj.arafah;
    return [].concat(
      duaRing(world, "arafah", a.x, a.z, 46, 11, 20),
      duaRing(world, "haram", 22, 31, 8, 1.5, 3.5),
      duaRing(world, "haramw", -34, -12, 7, 1.5, 3.2),
      duaRing(world, "nabawi", 600, -50, 9, 2, 4.5),
      duaRing(world, "mataf", 0, 0, 26, 27, 30.5),
    );
  }

  /** Centres of resting groups on the marble and under the Nabawi umbrellas: [x, z, size]. */
  const REST_SPOTS = [
    [-30, -47, 4],
    [14, -47, 3],
    [-30, 47, 4],
    [14, 47, 3],
    [-53, -20, 3],
    [-53, 20, 4],
    [54, -20, 3],
    [54, 22, 4],
    [-38, -24, 3],
    [32, -32, 3],
    [28, 34, 4],
    [-12, 38, 3],
    [572.2, -70, 3],
    [600.2, -56, 4],
    [614.2, -84, 3],
    [628.2, -42, 4],
    [586.2, -56, 3],
    [642.2, -70, 4],
    [558.2, -84, 3],
    [628.2, -70, 3],
    [563, 106, 3],
    [553, 117, 3],
  ];

  /** Groups sitting on the floor, facing each other: legs out, on heels, or with open hands. */
  function restSlots(world) {
    const out = [];
    REST_SPOTS.forEach(function (c, j) {
      if (!G.CrowdZones.clear(world, c[0], c[1], 1.3)) return;
      SC()
        .circleSlots(c[0], c[1], c[2], 0.85, H("rest", j) * TAU)
        .forEach(function (q, i) {
          const r = H("restpose" + j, i);
          const pose = r < 0.5 ? "sit_legs" : r < 0.8 ? "julus" : "doa";
          const role =
            H("restrole" + j, i) < 0.22 ? "elder" : H("restrole" + j, i) < 0.4 ? "kid" : "adult";
          out.push(slot("rest:" + j + ":" + i, "rest", q.x, q.z, q.heading, { pose, role }));
        });
    });
    return out;
  }

  /** Photo groups: [group x, z, group faces (yaw), people]. The photographer stands 3.2 m in front of them. */
  const PHOTO_SPOTS = [
    [-14, -93, 0, 5],
    [16, -91, 0, 4],
    [-6, -31, Math.PI, 5],
    [30, 12, Math.PI / 2, 4],
    [8, -66, Math.PI, 4],
    [577, -80, Math.PI, 5],
    [623, -62, Math.PI, 4],
    [600, -185, 0, 4],
    [-60, -142, 0, 3],
  ];

  /** One photo group: people in a row facing the photographer, some children in front. */
  function photoSlots(world) {
    const out = [];
    PHOTO_SPOTS.forEach(function (p, j) {
      const [gx, gz, face, n] = p;
      const fx = Math.sin(face);
      const fz = Math.cos(face);
      const px = gx + fx * 3.2;
      const pz = gz + fz * 3.2;
      if (!G.CrowdZones.clear(world, gx, gz, 1.5) || !G.CrowdZones.clear(world, px, pz, 0.4))
        return;
      for (let i = 0; i < n; i += 1) {
        const off = (i - (n - 1) / 2) * 0.8;
        const kid = i === 1 || i === n - 2 ? H("photokid", j + ":" + i) < 0.6 : false;
        const x = gx + Math.cos(face) * off + (kid ? fx * 0.7 : 0);
        const z = gz - Math.sin(face) * off + (kid ? fz * 0.7 : 0);
        const role = kid ? "kid" : i === 0 && H("photoelder", j) < 0.5 ? "elder" : "adult";
        out.push(
          slot("photo:" + j + ":" + i, "photo", x, z, face + Math.PI, {
            pose: kid ? "hop" : "wait",
            role,
          }),
        );
      }
      out.push(
        slot("photo:" + j + ":cam", "photo", px, pz, face + Math.PI, {
          pose: "photo",
          role: "adult",
        }),
      );
    });
    return out;
  }

  /** Vendors: [x, z, faces (yaw), goods colour, customers]. The cart stands in front of the vendor. */
  const VENDORS = [
    [-27, -91, 0, "#d9534f", 2],
    [27, -69, Math.PI, "#e6a33a", 2],
    [-31, -66, Math.PI, "#2f6db5", 1],
    [-62, -139, Math.PI / 2, "#e6a33a", 1],
    [553, -62, Math.PI / 2, "#8a5a2b", 2],
    [647, -62, -Math.PI / 2, "#8a5a2b", 2],
    [585, -98, 0, "#8a5a2b", 1],
    [616, -98, 0, "#d9534f", 1],
    [537, 30, Math.PI / 2, "#8a5a2b", 1],
  ];

  /** Vendors with a cart and a couple of customers waiting in front, facing them. */
  function vendorSlots(world) {
    const out = [];
    VENDORS.forEach(function (v, j) {
      const [x, z, face, goods, n] = v;
      const fx = Math.sin(face);
      const fz = Math.cos(face);
      if (
        !G.CrowdZones.clear(world, x, z, 0.5) ||
        !G.CrowdZones.clear(world, x + fx * 0.62, z + fz * 0.62, 0.35)
      )
        return;
      out.push(
        slot("vendor:" + j + ":s", "vendor", x, z, face, {
          pose: "order",
          role: "adult",
          prop: "cart",
          bag: goods,
        }),
      );
      for (let i = 0; i < n; i += 1) {
        const cx = x + fx * 2.1 + Math.cos(face) * (i - (n - 1) / 2) * 0.85;
        const cz = z + fz * 2.1 - Math.sin(face) * (i - (n - 1) / 2) * 0.85;
        if (G.CrowdZones.clear(world, cx, cz, 0.35))
          out.push(
            slot("vendor:" + j + ":" + i, "vendor", cx, cz, face + Math.PI, {
              pose: i ? "wait" : "order",
              role: "any",
            }),
          );
      }
    });
    return out;
  }

  /** Security guards: [x, z, faces]. */
  const GUARDS = [
    [-6.5, -54, 0],
    [6.5, -54, 0],
    [33, -4, -Math.PI / 2],
    [36, 5, Math.PI / 2],
    [27, -27, Math.PI * 0.75],
    [-27, 27, -Math.PI / 4],
    [592.5, -34, 0],
    [606, -34, 0],
    [620, -34, 0],
    [645, -2, -Math.PI / 2],
    [5, -100, 0],
    [-24, -60, Math.PI],
  ];

  /** Guards standing watch in dark uniforms. */
  function guardSlots(world) {
    return GUARDS.filter((g) => G.CrowdZones.clear(world, g[0], g[1], 0.5)).map((g, i) =>
      slot("guard:" + i, "guard", g[0], g[1], g[2], {
        pose: H("guardpose", i) < 0.25 ? "phone" : "wait",
        role: "adult",
      }),
    );
  }

  /** Cleaner lines [x0, z0, x1, z1, speed]: along the courtyard and halls, and across the Nabawi courtyard. */
  const PATROLS = [
    [-44, -39, 30, -39, 0.55],
    [-37, -30, -37, 28, 0.5],
    [-44, -46.5, 30, -46.5, 0.6],
    [-44, 41.5, 30, 41.5, 0.5],
    [552, -63, 648, -63, 0.6],
    [552, -91, 648, -91, 0.55],
    [601, -22, 601, 10, 0.45],
  ];

  /** Cleaners pushing a cart back and forth along a line (analytic path, like the tawaf). */
  function patrolSlots(world) {
    const out = [];
    PATROLS.forEach(function (l, j) {
      if (!G.CrowdZones.segmentClear(world, l[0], l[1], l[2], l[3], 0.6)) return;
      const line = { x0: l[0], z0: l[1], x1: l[2], z1: l[3], v: l[4], phase: H("patrol", j) };
      const p = PL().patrolAt(line, 0);
      out.push(
        slot(
          "clean:" + j,
          "clean",
          p.x,
          p.z,
          p.heading,
          { pose: "push", prop: "cart", role: "adult", bag: "#6b7280" },
          { holy: "patrol", line },
        ),
      );
    });
    return out;
  }

  /** The Zamzam queue: the first three people are drinking from cups, the rest wait their turn. */
  function queueSlots(world) {
    const z = KQ.HOLY.makkah.zamzam;
    return SC()
      .queueSlots(z.x - 2, z.z + 1.6, 10, 0.95, 1, Math.PI)
      .filter((q) => G.CrowdZones.clear(world, q.x, q.z))
      .map((q, i) =>
        slot(
          "queue:zamzam:" + i,
          "queue",
          q.x,
          q.z,
          q.heading,
          { pose: i < 3 ? "drink" : "wait", prop: i < 3 ? "cup" : null, role: "any" },
          { holy: "hold", index: i },
        ),
      );
  }

  /** Where small groups stand and talk (centres), and how many people each holds. */
  const CHAT_SPOTS = [
    [12, -66, 3],
    [-14, -72, 2],
    [26, -84, 3],
    [-28, -88, 4],
    [8, 38, 3],
    [20, 30, 2],
    [-8, 34, 2],
    [-62, -138, 3],
    [-72, -102, 2],
    [60, -102, 3],
    [-170, -30, 3],
    [-190, -48, 2],
    [-148, -86, 3],
    [592, -62, 3],
    [612, -72, 4],
    [574, -50, 2],
    [628, -48, 3],
    [598, -88, 3],
    [580, -36, 2],
    [620, -38, 3],
    [654, -92, 2],
    [560, -96, 3],
    [563, 104, 3],
    [600, -186, 3],
    [563, -77, 3],
    [591, -77, 3],
    [619, -63, 3],
    [633, -49, 3],
    [563, -49, 2],
    [605, -77, 2],
    [577, -63, 3],
    [647, -78, 3],
    [-40, -78, 3],
    [40, -84, 3],
    [-8, -88, 2],
    [14, -62, 2],
    [-26, -112, 3],
    [30, -113, 3],
    [-44, -100, 2],
    [44, -64, 3],
  ];

  /** More chat circles in the open cells of the Nabawi courtyard and the Makkah plaza (sizes 2 to 4). */
  function cellSpots() {
    const out = [];
    for (let k = 0; k < 6; k += 1)
      [-77, -63, -49].forEach((z) =>
        out.push([566.5 + 14 * k, z, 2 + Math.floor(H("cell", k + ":" + z) * 3)]),
      );
    [-27, -9, 9, 27].forEach((x) =>
      [-86, -76].forEach((z) => out.push([x, z, 2 + Math.floor(H("pcell", x + ":" + z) * 3)])),
    );
    return out;
  }

  /** Chat circles at the listed spots (the kampung's standing-talk poses). */
  function chatSlots(world) {
    const out = [];
    CHAT_SPOTS.concat(cellSpots()).forEach(function (c, j) {
      if (!G.CrowdZones.clear(world, c[0], c[1], 1.2)) return;
      const gid = "chat:holy:" + j;
      SC()
        .circleSlots(c[0], c[1], c[2], 0.5 + 0.08 * c[2], j)
        .forEach((q, i) =>
          out.push({
            id: gid + ":" + i,
            kind: "chat",
            x: q.x,
            z: q.z,
            heading: q.heading,
            group: gid,
            index: i,
            size: c[2],
          }),
        );
    });
    return out;
  }

  /** Every activity spot, in one list. */
  function build(world) {
    return [].concat(
      duaSlots(world),
      restSlots(world),
      photoSlots(world),
      vendorSlots(world),
      guardSlots(world),
      patrolSlots(world),
      queueSlots(world),
      chatSlots(world),
    );
  }

  G.CrowdHolySpots = { build, duaSlots };
})((window.KQ = window.KQ || {}));
