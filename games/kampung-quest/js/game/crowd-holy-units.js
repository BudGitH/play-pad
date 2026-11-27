/* ============================================================================
 * FILE: crowd-holy-units.js
 * PURPOSE: The people who walk the tawaf ring and the sa'i lane, as "units": a single pilgrim,
 *          a parent holding a small child's hand, a carer with a baby, an elder with a stick, a
 *          wheelchair pushed by family, teenagers, and a tour group following a guide with a
 *          flag or umbrella. Each unit becomes one or more slots on a lane.
 * BUSINESS CONTEXT: AC-H2 and the owner's variety follow-up: elderly (stooped, stick, wheelchair),
 *   children by the hand, carried babies and tour groups, all moving with the flow.
 * DEPENDENCIES: KQ.Sim.Crowd (hash01) and KQ.Sim.Crowd.Pilgrim (tawafAt, saiAt, RING, SAI).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const SC = () => KQ.Sim.Crowd;
  const PL = () => KQ.Sim.Crowd.Pilgrim;
  const TAU = Math.PI * 2;
  /** Metres between people on a lane, the tour spacing and how far a child walks beside a parent. */
  const GAP = 2.1;
  /** Tawaf lanes around the Kaaba (more, and closer, than the first crowd: the mataf is packed). */
  const LANES = 8;
  const TOUR_GAP = 1.5;
  const SIDE = 0.62;
  let tourSerial = 0;

  /** The kind of unit at a lane position: a stable draw, with the outer lanes taking the slower units. */
  function unitKind(id, outer) {
    const r = SC().hash01(id + ":unit");
    if (r < 0.06) return "tour";
    if (r < 0.14) return "family";
    if (r < 0.19) return "baby";
    if (r < 0.24) return "stick";
    if (r < (outer ? 0.31 : 0.26)) return "wheel";
    if (r < 0.33) return "teens";
    return "single";
  }

  /** A person on a lane: `look` carries the role, pose and prop the crowd should give them. */
  function person(base, look, extra) {
    return Object.assign({ look }, base, extra || {});
  }

  /** The one-person look of each unit kind. */
  const LOOKS = {
    single: { pose: "walk" },
    teens: { pose: "walk", role: "teen" },
    baby: { pose: "carry", prop: "baby", role: "adult" },
    stick: { pose: "walk_stoop", prop: "stick", role: "elder", slow: 0.72 },
    wheel: { pose: "push", prop: "wheelchair", role: "adult", slow: 0.78 },
    parent: { pose: "walk_hold", role: "adult" },
    child: { pose: "walk_hold_kid", role: "kid" },
    guide: { pose: "guide", role: "adult" },
    follower: { pose: "walk" },
  };

  /** The people of one unit as [{ look, along (metres behind the unit's front), across (metres to the right) }]. */
  function members(kind, id) {
    if (kind === "family") {
      const kids = SC().hash01(id + ":kids") < 0.3 ? 2 : 1;
      const out = [
        { look: LOOKS.parent, along: 0, across: 0 },
        { look: LOOKS.child, along: 0, across: SIDE },
      ];
      return kids === 2 ? out.concat([{ look: LOOKS.child, along: 1.1, across: SIDE * 0.3 }]) : out;
    }
    if (kind === "teens") {
      return [0, 1, 2]
        .slice(0, 2 + (SC().hash01(id + ":n") < 0.4 ? 1 : 0))
        .map((k) => ({ look: LOOKS.teens, along: k * 1.1, across: 0 }));
    }
    if (kind === "tour") {
      const n = 4 + Math.floor(SC().hash01(id + ":tn") * 4);
      const flag = SC().hash01(id + ":flag") < 0.6 ? "flag" : "umbrella";
      const list = [{ look: Object.assign({}, LOOKS.guide, { prop: flag }), along: 0, across: 0 }];
      for (let k = 1; k <= n; k += 1)
        list.push({ look: LOOKS.follower, along: k * TOUR_GAP, across: ((k % 2) - 0.5) * 0.7 });
      return list;
    }
    return [{ look: LOOKS[kind], along: 0, across: 0 }];
  }

  /** The metres of lane one unit takes up, so the next unit starts clear of it. */
  function lengthOf(kind, count) {
    return kind === "tour"
      ? (count - 1) * TOUR_GAP + GAP
      : kind === "single"
        ? GAP
        : GAP + (count - 1) * 1.1;
  }

  /** Slots for the people of a unit on a tawaf lane at arc position `s` metres (ring radius r, speed v). */
  function ringUnit(kind, id, r, s, v0, laneNo) {
    const tourId = kind === "tour" ? ++tourSerial : 0;
    return members(kind, id).map(function (m, k) {
      const v = v0 * (m.look.slow || 1);
      const rr = r + m.across;
      const slotId = kind === "tour" ? "tawaf:tour" + tourId + ":" + k : id + ":" + k;
      const th0 = (s - m.along) / r;
      return person(
        { id: slotId, kind: "tawaf", holy: "orbit", ring: { r: rr, th0, v: (v * rr) / r } },
        m.look,
        { lane: laneNo },
      );
    });
  }

  /** The tawaf ring: eight lanes filled with units; the outer lanes take wheelchairs and elders. */
  function ringSlots() {
    const R = PL().RING;
    const out = [];
    for (let lane = 0; lane < LANES; lane += 1) {
      const r = R.rMin + ((R.rMax - R.rMin) * lane) / (LANES - 1);
      const circ = TAU * r;
      const v0 = R.vMin + (R.vMax - R.vMin) * SC().hash01("lane" + lane);
      let s = 0;
      let i = 0;
      while (s < circ - GAP) {
        const id = "tawaf:" + lane + ":" + i;
        const kind = unitKind(id, lane >= LANES - 2);
        const list = ringUnit(kind, id, r, s, v0, lane);
        out.push(...list);
        s += lengthOf(kind, list.length);
        i += 1;
      }
    }
    return out;
  }

  /** Slots for a sa'i unit: lane x, speed, phase 0..1 along the out-and-back (children keep to the parent's right). */
  function saiUnit(kind, id, x, v0, phase) {
    const tourId = kind === "tour" ? ++tourSerial : 0;
    const span = PL().SAI.zMax - PL().SAI.zMin;
    return members(kind, id).map(function (m, k) {
      const v = v0 * (m.look.slow || 1);
      const lane = { x, v, phase: (phase - m.along / (2 * span) + 1) % 1, dx: m.across };
      const slotId = kind === "tour" ? "sai:tour" + tourId + ":" + k : id + ":" + k;
      return person({ id: slotId, kind: "sai", holy: "lane", lane }, m.look);
    });
  }

  /** The sa'i lanes: walkers in both directions; the outermost lane is the wheelchair lane. */
  function saiSlots() {
    const S = PL().SAI;
    const out = [];
    S.xs.forEach(function (x, l) {
      const count = 13;
      for (let i = 0; i < count; i += 1) {
        const id = "sai:" + l + ":" + i;
        const phase = (i + SC().hash01(id + "p") * 0.7) / count;
        const kind = unitKind(id, l === S.xs.length - 1);
        const v = S.vMin + (S.vMax - S.vMin) * SC().hash01(id);
        out.push(...saiUnit(kind, id, x, v, phase));
      }
    });
    return out;
  }

  /** Restart the tour numbering (a world is built once, but a test may build twice). */
  function reset() {
    tourSerial = 0;
  }

  G.CrowdHolyUnits = { ringSlots, saiSlots, LOOKS, unitKind, members, reset, LANES };
})((window.KQ = window.KQ || {}));
