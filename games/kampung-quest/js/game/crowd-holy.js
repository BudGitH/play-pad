/* ============================================================================
 * FILE: crowd-holy.js
 * PURPOSE: The pilgrim crowd of the Haramain region: finds every fixed spot (the tawaf ring
 *          around the Kaaba, the sa'i lane, prayer rows in the Haram, Nabawi and Quba, Quran
 *          readers at the columns, dua at Arafah, chat circles, the Zamzam queue) and steps
 *          the people who move (tawaf walkers circle anticlockwise, sa'i walkers go Safa to
 *          Marwa and back) or hold a prayer posture together.
 * BUSINESS CONTEXT: AC-H2. Same instanced crowd as the kampung (one kit, ~25 draw calls, caps
 *   per tier in KQ.Sim.Crowd.TIER_CAPS); nothing here adds a mesh. Rules are pure in
 *   KQ.Sim.Crowd.Pilgrim (js/sim/crowd-pilgrim.js).
 * DEPENDENCIES: crowd-zones.js (clear), crowd-members.js, KQ.Sim.Crowd, util.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const SC = () => KQ.Sim.Crowd;
  const PL = () => KQ.Sim.Crowd.Pilgrim;
  const TAU = Math.PI * 2;
  /** People make way for the hero and each other inside this distance. */
  const WAY = 0.85;

  /** The tawaf ring: six lanes, people every ~4 m, each on its own speed. */
  function ringSlots() {
    const R = PL().RING;
    const out = [];
    for (let lane = 0; lane < 6; lane += 1) {
      const r = R.rMin + ((R.rMax - R.rMin) * lane) / 5;
      const n = Math.floor((TAU * r) / 4.2);
      for (let i = 0; i < n; i += 1) {
        const id = "tawaf:" + lane + ":" + i;
        const ring = {
          r,
          th0: (i / n) * TAU + lane * 0.37,
          v: R.vMin + (R.vMax - R.vMin) * SC().hash01(id),
        };
        const p = PL().tawafAt(ring, 0);
        out.push({ id, kind: "tawaf", holy: "orbit", ring, x: p.x, z: p.z, heading: p.heading });
      }
    }
    return out;
  }

  /** The sa'i lane: five lanes of walkers going between Safa and Marwa. */
  function saiSlots() {
    const S = PL().SAI;
    const out = [];
    S.xs.forEach(function (x, l) {
      for (let i = 0; i < 5; i += 1) {
        const id = "sai:" + l + ":" + i;
        const lane = {
          x,
          v: S.vMin + (S.vMax - S.vMin) * SC().hash01(id),
          phase: (i + SC().hash01(id + "p") * 0.6) / 5,
        };
        const p = PL().saiAt(lane, 0);
        out.push({ id, kind: "sai", holy: "lane", lane, x: p.x, z: p.z, heading: p.heading });
      }
    });
    return out;
  }

  /** Candidate rows in a rectangle: x every `dx`, z every `dz`, kept where a person fits. */
  function rowSlots(world, o) {
    const out = [];
    let row = 0;
    for (let z = o.z0; z <= o.z1; z += o.dz) {
      row += 1;
      for (let x = o.x0; x <= o.x1; x += o.dx) {
        if (o.skip && o.skip(x, z)) continue;
        if (!G.CrowdZones.clear(world, x, z, 0.38)) continue;
        out.push({
          id: "pray:" + o.name + ":" + row + ":" + Math.round(x * 10),
          kind: "prayer",
          holy: "prayer",
          x,
          z,
          heading: 0,
          offset: row * 0.18,
        });
      }
    }
    return out;
  }

  /** Arcs of rows around the Kaaba in the courtyard, everyone facing the Kaaba. */
  function haramRows(world) {
    const out = [];
    for (let r = 33; r <= 42; r += 1.4) {
      const n = Math.floor((TAU * r) / 1.15);
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * TAU;
        const x = r * Math.cos(a);
        const z = -r * Math.sin(a);
        if (x < -45 || x > 36 || z < -42 || z > 42 || !G.CrowdZones.clear(world, x, z, 0.4))
          continue;
        out.push({
          id: "pray:haram:" + Math.round(r * 10) + ":" + i,
          kind: "prayer",
          holy: "prayer",
          x,
          z,
          heading: PL().qiblaHeading(x, z),
          offset: (r - 33) * 0.12,
        });
      }
    }
    return out;
  }

  /** Quran readers: sitting at the foot of the Nabawi columns and the Haram hall columns, back to the column. */
  function readerSlots(world) {
    const out = [];
    const add = (name, x, z, heading, i) => {
      if (!G.CrowdZones.clear(world, x, z, 0.3)) return;
      out.push({ id: "read:" + name + ":" + i, kind: "read", holy: "read", x, z, heading });
    };
    const GR = KQ.WorldParts.HolyNabawiInside.GRID;
    for (let k = 0; k < GR.nz; k += 1) {
      for (let i = 0; i < GR.nx; i += 1)
        add("nabawi", GR.x0 + i * GR.step, GR.z0 + k * GR.step + 0.95, 0, k * 20 + i);
    }
    for (let i = 0; i < 19; i += 1) {
      add("haramN", -57 + i * 6, -49.9, 0, i);
      add("haramS", -57 + i * 6, 49.9, Math.PI, i);
    }
    return out;
  }

  /** Dua at Arafah: people standing in a loose ring around Jabal Rahmah, hands open, facing the Kaaba. */
  function duaSlots(world) {
    const a = KQ.HOLY.hajj.arafah;
    const out = [];
    for (let i = 0; i < 40; i += 1) {
      const ang = (i / 40) * TAU + SC().hash01("dua" + i);
      const r = 11 + 8 * SC().hash01("duar" + i);
      const x = a.x + Math.cos(ang) * r;
      const z = a.z + Math.sin(ang) * r;
      if (G.CrowdZones.clear(world, x, z, 0.4))
        out.push({
          id: "dua:arafah:" + i,
          kind: "dua",
          holy: "dua",
          x,
          z,
          heading: PL().qiblaHeading(x, z),
        });
    }
    return out;
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
  ];

  /** Chat circles at the listed spots (kind "chat", the existing standing-talk poses). */
  function chatSlots(world) {
    const out = [];
    CHAT_SPOTS.forEach(function (c, j) {
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

  /** A short queue at the Zamzam taps. */
  function queueSlots(world) {
    const z = KQ.HOLY.makkah.zamzam;
    return SC()
      .queueSlots(z.x - 2, z.z + 1.6, 5, 1.0, 1, Math.PI)
      .filter((q) => G.CrowdZones.clear(world, q.x, q.z))
      .map((q, i) => ({
        id: "queue:zamzam:" + i,
        kind: "queue",
        x: q.x,
        z: q.z,
        heading: q.heading,
        index: i,
        group: "queue:zamzam",
      }));
  }

  /** Every fixed or analytic spot of the Haramain crowd. */
  function build(world) {
    const nab = KQ.WorldParts.HolyNabawiInside.CHAMBER;
    const readers = readerSlots(world);
    const near = (x, z) => readers.some((r) => Math.abs(r.x - x) < 0.9 && Math.abs(r.z - z) < 0.9);
    const aisle = (x) => x > 599.3 && x < 601.7;
    const chamber = (x, z) => x > nab.x0 - 2 && x < nab.x1 + 2 && z > nab.z0 - 2 && z < nab.z1 + 4;
    const all = [].concat(
      ringSlots(),
      saiSlots(),
      haramRows(world),
      rowSlots(world, {
        name: "nabawi",
        x0: 569.5,
        x1: 632,
        dx: 1.25,
        z0: -25.5,
        z1: 27,
        dz: 1.7,
        skip: (x, z) => aisle(x) || near(x, z) || chamber(x, z),
      }),
      rowSlots(world, {
        name: "quba",
        x0: 549.5,
        x1: 570.5,
        dx: 1.25,
        z0: 113.5,
        z1: 126.5,
        dz: 1.7,
      }),
      readers,
      duaSlots(world),
      chatSlots(world),
      queueSlots(world),
    );
    all.forEach((s) => (s.y = s.y === undefined ? world.heightAt(s.x, s.z) : s.y));
    return all;
  }

  /** Move the analytic slots (tawaf, sa'i) to where their people are now, so the nearest-spot logic stays true. */
  function tick(slots, clock) {
    slots.forEach(function (s) {
      const p =
        s.holy === "orbit"
          ? PL().tawafAt(s.ring, clock)
          : s.holy === "lane"
            ? PL().saiAt(s.lane, clock)
            : null;
      if (!p) return;
      s.x = p.x;
      s.z = p.z;
      s.heading = p.heading;
    });
  }

  /** Ease a moving person aside from the hero and the cast, around their path point (bx, bz). */
  function easeAside(m, dt, others) {
    let px = 0;
    let pz = 0;
    others.forEach(function (o) {
      const d = U.dist(m.bx, m.bz, o.x, o.z);
      if (d > WAY || d < 1e-3) return;
      px += ((m.bx - o.x) / d) * (WAY - d);
      pz += ((m.bz - o.z) / d) * (WAY - d);
    });
    m.ox = U.damp(m.ox, U.clamp(px, -0.7, 0.7), px || pz ? 6 : 2.5, dt);
    m.oz = U.damp(m.oz, U.clamp(pz, -0.7, 0.7), px || pz ? 6 : 2.5, dt);
    m.x = m.bx + m.ox;
    m.z = m.bz + m.oz;
  }

  /** One step of a moving pilgrim (tawaf or sa'i): follow the analytic path, walking. */
  function walk(m, dt, C, p, speed) {
    m.bx = p.x;
    m.bz = p.z;
    m.heading = U.dampAngle(m.heading, p.heading, 8, dt);
    m.pose = "walk";
    m.rate = 0.78 * speed;
    easeAside(m, dt, C.others);
  }

  /** The pose and fixed spot of a person who stands, prays, reads or makes dua. */
  function hold(m, C) {
    const s = m.slot;
    m.heading = s.heading;
    if (s.holy === "prayer") m.pose = PL().prayerPose(C.clock, s.offset);
    else if (s.holy === "read") m.pose = "quran";
    else if (s.holy === "dua") m.pose = "dua_stand";
    m.prop = s.holy === "read" ? "quran" : null;
    m.rate = s.holy === "prayer" ? 0.1 : 0.12;
  }

  /** Step one holy-slot person by dt (the common ease-in / ease-out lives in CrowdMembers.update). */
  function step(m, dt, C) {
    const s = m.slot;
    if (s.holy === "orbit") walk(m, dt, C, PL().tawafAt(s.ring, C.clock), s.ring.v);
    else if (s.holy === "lane") walk(m, dt, C, PL().saiAt(s.lane, C.clock), s.lane.v);
    else hold(m, C);
  }

  G.CrowdHoly = { build, tick, step };
})((window.KQ = window.KQ || {}));
