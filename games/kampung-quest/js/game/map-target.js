/* ============================================================================
 * FILE: map-target.js
 * PURPOSE: The "go here" target a child picks on the full map: one place at a time, shown as a blue
 *          arrow on the radar rim and a blue beacon on the ground (markers.js), cleared on arrival
 *          (about 4 m, more for a big place) or when it is tapped again. It never replaces the
 *          mission objective: that stays pink, this is blue, and both show at once.
 * BUSINESS CONTEXT: playability round AC-P4. Also gives the full map the walking route to the
 *   target (the shortest path on the pedestrian graph) so a child can see how to get there.
 * DEPENDENCIES: map-places.js, pathing.js (the NPCs' path graph), ui-core.js (toasts), KQ.Sim.MapView.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const T = { place: null };
  const COLOR = "#38bdf8";

  /** The current target place, or null. */
  const active = () => T.place;

  /** Is this place the current target? */
  const is = (place) =>
    Boolean(T.place && place && T.place.id === place.id && T.place.city === place.city);

  /** Make a place the go-here target (replacing the last one) and say so. */
  function set(place) {
    T.place = Object.assign({}, place);
    G.S.hudDirty = true;
    G.UI.toast("Going to " + place.label + ". Follow the blue arrow!", "hint", 4200, "gohere");
  }

  /** Forget the target. */
  function clear() {
    if (!T.place) return;
    T.place = null;
    G.S.hudDirty = true;
    G.UI.dismissToast("gohere");
  }

  /** Tap the same place again to stop going there; any other place becomes the target. */
  function toggle(place) {
    if (is(place)) clear();
    else set(place);
  }

  /** Where to point at (x, z) while the hero is in the target's city, else null. */
  function pos(s) {
    const p = T.place;
    return p && p.city === G.MapPlaces.cityNow(s) ? { x: p.x, z: p.z } : null;
  }

  /** Per-tick: clear the target when the hero has arrived (or left the city); a little cheer on arrival. */
  function check(s) {
    const p = T.place;
    if (!p) return;
    if (p.city !== G.MapPlaces.cityNow(s)) return clear();
    const h = s.player.pos;
    if (!KQ.Sim.MapView.arrived(h.x, h.z, p.x, p.z, p.reach)) return;
    T.place = null;
    s.hudDirty = true;
    G.UI.dismissToast("gohere");
    G.UI.toast("You are here: " + p.label + "!", "good", 3600);
  }

  /** The walking route from the hero to the target on the full map: points [{x, z}], straight if no path is known. */
  function route(s) {
    const p = T.place;
    const h = s.player.pos;
    if (!p || p.city !== G.MapPlaces.cityNow(s)) return null;
    const pts =
      p.node != null && s.npcs && s.npcs.pathP
        ? G.Path.toNode(s.npcs.pathP, h.x, h.z, p.node)
        : null;
    const start = { x: h.x, z: h.z };
    return [start].concat(pts || [], [{ x: p.x, z: p.z }]);
  }

  G.MapTarget = { COLOR, active, is, set, clear, toggle, pos, check, route };
})((window.KQ = window.KQ || {}));
