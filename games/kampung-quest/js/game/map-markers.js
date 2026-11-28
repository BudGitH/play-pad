/* ============================================================================
 * FILE: map-markers.js
 * PURPOSE: Decides which blips the radar and the full map show: the objective (pink, with a rim
 *          arrow), the mosque (green; big + arrow while a prayer is due), the hawker centre
 *          (orange; big while the first-meal nudge is on; the mosque, food and the holy sites also
 *          ride the rim of the radar when they are out of range), neighbours with a mission to give
 *          (gold star), home, and in the Haramain region the Kaaba and the Prophet's Mosque.
 * BUSINESS CONTEXT: AC-11 (a radar arrow for the active mission; the hawker beacon while nudged).
 *   Marker shape: { x, z, color, big, kind, icon, arrow, rim, label } (minimap.js draws it).
 * DEPENDENCIES: mission-flow.js (targetPos), nudge.js (markerPos), KQ.HOLY. No DOM.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const COLORS = {
    objective: "#ff6b85",
    mosque: "#30d158",
    food: "#ff9f0a",
    giver: "#f4c26b",
    home: "#f4a8b8",
    kaaba: "#1c1c22",
    nabawi: "#2f9e6e",
    event: "#b66bff",
  };

  /** Make one marker of a kind at a position; `extra` overrides (big, arrow, label, ink). */
  function mark(kind, icon, pos, extra) {
    return Object.assign(
      { x: pos.x, z: pos.z, color: COLORS[kind], big: false, kind, icon, arrow: false, rim: false },
      extra || {},
    );
  }

  /** A world point of a POI by id, or null when this region's world has no such place. */
  function poiPos(s, id) {
    const p = s.world.pois && s.world.pois[id];
    return p ? p.pos : null;
  }

  /** The neighbours who have a mission to give (only while no mission is under way and they are in view). */
  function givers(s) {
    const m = s.sim.missions;
    if (m.active() || m.isPausedNow()) return [];
    const want = m.available().map((x) => x.giver);
    return s.npcs.agents
      .filter((A) => !A.hidden && want.indexOf(A.id) !== -1)
      .filter((A) => !(A.goal && A.goal.kind === "pray"))
      .map((A) => mark("giver", "star", A, { ink: "#5a4300", label: "Mission" }));
  }

  /** The mosque blip: always there, big with a rim arrow while a prayer is due or being prayed. */
  function mosque(s, out) {
    const pos = poiPos(s, "mosque_gate");
    if (!pos) return;
    const ps = s.sim.prayer.state();
    const urgent = Boolean(ps.due || ps.flow);
    out.push(
      mark("mosque", "mosque", pos, { big: urgent, arrow: urgent, rim: true, label: "Mosque" }),
    );
  }

  /** Kampung places: mosque, hawker centre (big during the first-meal nudge) and home. */
  function kampung(s, out) {
    mosque(s, out);
    const hawker = poiPos(s, "hawker");
    const home = poiPos(s, "home");
    if (hawker) {
      const nudge = Boolean(G.Nudge.markerPos());
      out.push(mark("food", "bowl", hawker, { big: nudge, rim: true, label: "Hawker centre" }));
    }
    if (home) out.push(mark("home", "home", home, { label: "Home" }));
  }

  /** Haramain places: the Kaaba and the Prophet's Mosque (green dome), from KQ.HOLY. */
  function haramain(s, out) {
    const k = KQ.HOLY.makkah.kaaba;
    const n = KQ.HOLY.madinah.nabawi;
    out.push(mark("kaaba", "star", k, { rim: true, label: "Kaaba" }));
    out.push(mark("nabawi", "mosque", n, { rim: true, label: "Prophet's Mosque" }));
    mosque(s, out);
  }

  /** Every blip for the current region, objective first (so it is drawn under, and found first). */
  function build(s) {
    const out = [];
    const t = G.MissionFlow.targetPos();
    if (t) out.push(mark("objective", "pin", t, { big: true, arrow: true, label: "Mission" }));
    if (KQ.region === "haramain" && KQ.HOLY) haramain(s, out);
    else kampung(s, out);
    const ev = G.WorldEvents.blip();
    if (ev) out.push(mark("event", "star", ev, { label: ev.label, ink: "#ffffff" }));
    return out.concat(givers(s));
  }

  G.MapMarkers = { build, COLORS };
})((window.KQ = window.KQ || {}));
