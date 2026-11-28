/* ============================================================================
 * FILE: event-actors.js
 * PURPOSE: The few full toy figures that a world event borrows for a minute (a ball-kicking kid,
 *          a wedding drummer, a volunteer with dates): built once from a cast spec in
 *          js/figures/life-cast.js, kept hidden between events, shown, walked and posed, then
 *          hidden again. Nothing is created or destroyed during play after the first use.
 * BUSINESS CONTEXT: AC-P18 "cheap: reuse cast rigs / simple meshes, dispose after". At most about
 *   six actors are on stage at once and none exists outside an event, so the draw-call budget of
 *   the idle town is untouched.
 * DEPENDENCIES: THREE, KQ.Figures (build, Animator), util.js, collide.js, greetings.js (bubbles).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const RADIUS = 0.31;
  const POOL = {};
  /** Metres from the ground to the top of a head, for the bubble a figure speaks through. */
  const HEAD = 1.07; // measured on the built figures (a cast adult), like greetings.js
  const KID_HEAD = 0.9;

  /**
   * Take the actor for a cast key (built on first use). Returns the actor, hidden at the origin.
   * @param {string} key an id from KQ.Figures.CAST (see life-cast.js)
   */
  function get(key) {
    if (POOL[key]) return POOL[key];
    const group = KQ.Figures.build(key);
    group.visible = false;
    S().scene.add(group);
    KQ.Figures.mergeRig(group); // one draw call per actor, not 14 (AC-14 budget)
    const rig = group.userData.rig;
    const kid = Boolean(KQ.Figures.CAST[key] && KQ.Figures.CAST[key].kid);
    POOL[key] = {
      id: key,
      group,
      rig,
      kid,
      anim: KQ.Figures.Animator(rig),
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      pose: "idle",
      show: 0,
      want: 0,
      goal: null,
      speed: 0,
      waveT: 0,
      busy: false,
    };
    return POOL[key];
  }

  /** Put an actor on the ground at (x, z) facing `heading`, ready to appear (it grows in). */
  function place(a, x, z, heading) {
    a.x = x;
    a.z = z;
    a.heading = heading || 0;
    a.y = S().world.heightAt(x, z);
    a.goal = null;
    a.speed = 0;
    a.show = 0.01;
    a.want = 1;
    a.busy = true;
    a.group.visible = true;
    a.group.position.set(x, a.y, z);
    G.Greetings.setActor(a.id, () => whereIs(a));
  }

  /** Where an actor's head is, for a speech bubble (null once it is hidden). */
  function whereIs(a) {
    if (!a.busy || !a.group.visible) return null;
    return { x: a.x, y: a.y, z: a.z, head: a.kid ? KID_HEAD : HEAD };
  }

  /** Send an actor to walk to (x, z) at `speed` m/s, or null to stand still. */
  function walkTo(a, x, z, speed) {
    a.goal = x === null ? null : { x, z, speed: speed || 1.4 };
  }

  /** Has the actor reached its goal (or have none)? */
  function arrived(a) {
    return !a.goal;
  }

  /** The pose an actor holds when it is standing still (idle, wave, talk ...). */
  function stand(a, pose) {
    a.restPose = pose || "idle";
  }

  /** Move toward the goal; true on arrival. Stops at colliders instead of walking through them. */
  function advance(a, dt) {
    const g = a.goal;
    const dx = g.x - a.x;
    const dz = g.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) return true;
    const step = Math.min(d, g.speed * dt);
    const px = a.x;
    const pz = a.z;
    a.x += (dx / d) * step;
    a.z += (dz / d) * step;
    const pos = { x: a.x, z: a.z };
    G.Collide.settle(S().world.colliders, pos, RADIUS);
    a.x = pos.x;
    a.z = pos.z;
    a.speed = Math.hypot(a.x - px, a.z - pz) / Math.max(dt, 1e-4);
    a.heading = U.dampAngle(a.heading, Math.atan2(dx, dz), 9, dt);
    return false;
  }

  /** Per-frame step for one actor: walk, pose, animate, grow in or out. */
  function step(a, dt) {
    if (!a.busy) return;
    a.speed = 0;
    if (a.goal && advance(a, dt)) a.goal = null;
    const moving = a.speed > 0.1;
    a.pose = moving ? (a.goal && a.goal.speed > 2.2 ? "run" : "walk") : a.restPose || "idle";
    if (a.waveT > 0) {
      a.waveT -= dt;
      if (!moving) a.pose = "wave";
    }
    a.anim.play(a.pose, 0.25);
    a.anim.setRate(moving ? U.clamp(a.speed / 2.2, 0.5, 1.4) : 1);
    a.anim.update(dt);
    a.y = U.damp(a.y, S().world.heightAt(a.x, a.z), 14, dt);
    a.show = U.damp(a.show, a.want, 7, dt);
    a.group.position.set(a.x, a.y, a.z);
    a.group.rotation.y = a.heading;
    a.group.scale.setScalar(Math.max(0.01, a.show));
    if (a.want === 0 && a.show < 0.03) release(a);
  }

  /** Make an actor shrink away and hide (it frees itself when it is gone). */
  function leave(a) {
    a.want = 0;
    a.goal = null;
  }

  /** Hide an actor at once and forget its bubble getter. */
  function release(a) {
    a.busy = false;
    a.group.visible = false;
    a.waveT = 0;
    a.restPose = "idle";
    G.Greetings.setActor(a.id, null);
  }

  /** Face a point (the hero) without moving. */
  function face(a, x, z, dt) {
    a.heading = U.dampAngle(a.heading, Math.atan2(x - a.x, z - a.z), 8, dt);
  }

  /** How many actors are on stage (for tests). */
  function count() {
    return Object.keys(POOL).filter((k) => POOL[k].busy).length;
  }

  /** How many have ever been built (for tests: the pool never grows without bound). */
  function built() {
    return Object.keys(POOL).length;
  }

  G.Actors = { get, place, walkTo, arrived, stand, step, leave, release, face, count, built };
})((window.KQ = window.KQ || {}));
