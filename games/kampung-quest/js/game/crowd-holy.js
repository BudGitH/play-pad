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

  /** Prayer rows: arcs in the Haram courtyard, the Nabawi hall and Quba (skipping the readers, aisle and chamber). */
  function prayerRows(world, taken) {
    const nab = KQ.WorldParts.HolyNabawiInside.CHAMBER;
    const near = (x, z) => taken.some((r) => Math.abs(r.x - x) < 0.9 && Math.abs(r.z - z) < 0.9);
    const aisle = (x) => x > 599.3 && x < 601.7;
    const chamber = (x, z) => x > nab.x0 - 2 && x < nab.x1 + 2 && z > nab.z0 - 2 && z < nab.z1 + 4;
    const nabawi = {
      name: "nabawi",
      x0: 569.5,
      x1: 632,
      dx: 1.25,
      z0: -25.5,
      z1: 27,
      dz: 1.7,
      skip: (x, z) => aisle(x) || near(x, z) || chamber(x, z),
    };
    const quba = { name: "quba", x0: 549.5, x1: 570.5, dx: 1.25, z0: 113.5, z1: 126.5, dz: 1.7 };
    return [].concat(
      haramRows(world).filter((r) => !near(r.x, r.z)),
      rowSlots(world, nabawi),
      rowSlots(world, Object.assign(quba, { skip: near })),
    );
  }

  /** Every fixed or analytic spot of the Haramain crowd. */
  function build(world, pathP) {
    G.CrowdHolyUnits.reset();
    const readers = readerSlots(world);
    const spots = G.CrowdHolySpots.build(world);
    const all = [].concat(
      G.CrowdHolyUnits.ringSlots(),
      G.CrowdHolyUnits.saiSlots(),
      prayerRows(world, readers.concat(spots)),
      readers,
      spots,
      G.CrowdHolyMore.build(world, pathP),
    );
    all.forEach((s) => (s.y = s.y === undefined ? world.heightAt(s.x, s.z) : s.y));
    return all;
  }

  /** The outfit of a holy-slot person: age from the slot's role, dressed by the pilgrim profiles. */
  function outfitFor(slot, seed) {
    const look = slot.look || {};
    const o = SC().outfit(seed, look.role || "any");
    if (look.bag) o.bag = look.bag;
    return o;
  }

  /** Where a slot's person is now when the slot moves (tawaf, sa'i, cleaner patrol), else null. */
  function pathAt(s, clock) {
    if (s.holy === "orbit") return PL().tawafAt(s.ring, clock);
    if (s.holy === "lane") return PL().saiAt(s.lane, clock);
    if (s.holy === "patrol") return PL().patrolAt(s.line, clock);
    return null;
  }

  /** Move the analytic slots to where their people are now, so the nearest-spot logic stays true. */
  function tick(slots, clock) {
    slots.forEach(function (s) {
      const p = pathAt(s, clock);
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

  /** One step of a moving person (tawaf, sa'i, patrol): follow the analytic path with the slot's walking pose and prop. */
  function walk(m, dt, C, p, speed) {
    const look = m.slot.look || {};
    m.bx = p.x;
    m.bz = p.z;
    m.heading = U.dampAngle(m.heading, p.heading, 8, dt);
    m.pose = look.pose || "walk";
    m.prop = look.prop || null;
    m.rate = 0.78 * speed;
    easeAside(m, dt, C.others);
  }

  /** The pose of a person at a spot: prayer, reading and the drink-and-wait cycle are special, the rest use `look`. */
  function holdPose(m, C) {
    const s = m.slot;
    const look = s.look || {};
    if (s.holy === "prayer") return [PL().prayerPose(C.clock, s.offset), null];
    if (s.holy === "read") return ["quran", "quran"];
    if (look.pose === "drink") {
      const drinking = (C.clock + (s.index || 0) * 3.7) % 9 < 5.5;
      return drinking ? ["drink", "cup"] : ["wait", null];
    }
    return [look.pose || "wait", look.prop || null];
  }

  /** The pose and fixed spot of a person who stands, prays, reads, drinks, rests or poses. */
  function hold(m, C) {
    const pp = holdPose(m, C);
    m.heading = m.slot.heading;
    m.pose = pp[0];
    m.prop = pp[1];
    m.rate = m.slot.holy === "prayer" ? 0.1 : 0.14;
  }

  /** Step one holy-slot person by dt (the common ease-in / ease-out lives in CrowdMembers.update). */
  function step(m, dt, C) {
    const s = m.slot;
    const p = pathAt(s, C.clock);
    if (!p) return hold(m, C);
    const v = s.ring ? s.ring.v : s.lane ? s.lane.v : s.line.v;
    walk(m, dt, C, p, v);
  }

  G.CrowdHoly = { build, tick, step, outfitFor };
})((window.KQ = window.KQ || {}));
