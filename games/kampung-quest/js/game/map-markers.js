/* ============================================================================
 * FILE: map-markers.js
 * PURPOSE: Decides which blips the radar shows: the objective (pink, with a rim arrow), every
 *          establishment of the hero's city from the registry (map-places.js: icon, colour and
 *          priority per kind; the mosque is big + arrow while a prayer is due, the hawker centre big
 *          while the first-meal nudge is on; mosque, food and the holy sites also ride the rim when out
 *          of range), neighbours with a mission to give (gold star), and the go-here target (blue,
 *          with a rim arrow; map-target.js). The full map draws the places itself (bigmap.js).
 * BUSINESS CONTEXT: AC-11 (a radar arrow for the active mission; the hawker beacon while nudged),
 *   playability AC-P1 (establishments on the radar in range) and AC-P4 (go-here arrow).
 *   Marker shape: { x, z, color, big, kind, icon, arrow, rim, label, prio, small, force } (minimap.js draws it).
 * DEPENDENCIES: map-places.js, map-target.js, mission-flow.js (targetPos), nudge.js (markerPos). No DOM.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const COLORS = Object.assign(
    { objective: "#ff6b85", giver: "#f4c26b", goto: "#38bdf8", event: "#b66bff" },
    Object.keys(KQ.PLACES.KINDS).reduce(function (o, k) {
      o[k] = KQ.PLACES.KINDS[k].color;
      return o;
    }, {}),
  );

  /** Make one marker of a kind at a position; `extra` overrides (big, arrow, label, ink, prio, small). */
  function mark(kind, icon, pos, extra) {
    return Object.assign(
      { x: pos.x, z: pos.z, color: COLORS[kind], big: false, kind, icon, arrow: false, rim: false },
      extra || {},
    );
  }

  /** The neighbours who have a mission to give (only while no mission is under way and they are in view). */
  function givers(s) {
    const m = s.sim.missions;
    if (m.active() || m.isPausedNow()) return [];
    const want = m.available().map((x) => x.giver);
    return s.npcs.agents
      .filter((A) => !A.hidden && want.indexOf(A.id) !== -1)
      .filter((A) => !(A.goal && A.goal.kind === "pray"))
      .map((A) => mark("giver", "star", A, { ink: "#5a4300", label: "Mission", prio: 1 }));
  }

  /** Is this place calling the hero right now: the mosque while a prayer is due, the hawker centre while nudged? */
  function urgent(s, p) {
    if (p.id === "mosque") {
      const ps = s.sim.prayer.state();
      return Boolean(ps.due || ps.flow);
    }
    return p.kind === "food" && Boolean(G.Nudge.markerPos());
  }

  /** The marker of one place: its kind's icon, colour and priority; big (and pointing, for the mosque) when urgent. */
  function placeMark(s, p) {
    const k = KQ.PLACES.KINDS[p.kind];
    const hot = urgent(s, p);
    return mark(p.kind, k.icon, p, {
      big: hot,
      arrow: hot && p.id === "mosque",
      rim: Boolean(k.rim),
      label: p.label,
      ink: k.ink,
      prio: hot ? 0 : k.prio,
      small: k.prio >= 4,
    });
  }

  /** Every establishment of the hero's city that belongs on the radar. */
  function places(s) {
    return G.MapPlaces.list(s, G.MapPlaces.cityNow(s))
      .filter((p) => KQ.PLACES.KINDS[p.kind].radar)
      .map((p) => placeMark(s, p));
  }

  /** The go-here target as a marker (blue, always pointing), or nothing. */
  function target(s) {
    const t = G.MapTarget.pos(s);
    if (!t) return [];
    const label = G.MapTarget.active().label;
    return [mark("goto", "pin", t, { big: true, arrow: true, force: true, prio: 0, label })];
  }

  /** Every blip for the radar: the mission objective first (so it is drawn under, and found first). */
  function build(s) {
    const out = [];
    const t = G.MissionFlow.targetPos();
    if (t)
      out.push(mark("objective", "pin", t, { big: true, arrow: true, prio: 0, label: "Mission" }));
    const ev = G.WorldEvents && G.WorldEvents.blip();
    if (ev) out.push(mark("event", "star", ev, { prio: 1, label: ev.label, ink: "#ffffff" }));
    return out.concat(places(s), givers(s), target(s));
  }

  G.MapMarkers = { build, COLORS };
})((window.KQ = window.KQ || {}));
