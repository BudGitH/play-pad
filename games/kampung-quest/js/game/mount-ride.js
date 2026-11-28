/* ============================================================================
 * FILE: mount-ride.js
 * PURPOSE: Riding an animal (KQ.Game.MountRide): getting on (the hero is seated in the ride pose,
 *          the camera eases back), steering with the stick like walking (the animal turns toward
 *          where it is pushed, faster than a run), slowing and stopping for anyone on foot,
 *          stopping gently at walls and at the places animals do not go (the Haram plazas, the
 *          mosques: the vehicles' no-drive zones) with a friendly line, hoof clops, and getting
 *          down onto free ground beside it.
 * BUSINESS CONTEXT: AC-P5 (ride a camel: seated on the hump, faster than running, obeys colliders
 *   and no-ride zones, Exit sets the hero down on free ground), AC-P6 (horses ride the same way),
 *   AC-P7 (never hurts anyone, stays on the ground, animated gait).
 * HOW IT FITS: Mounts.update calls update(); Mounts.press / the menu call mount() and leave().
 *   The pure numbers are KQ.Sim.Mount (and KQ.Sim.Vehicle's people-braking and zone tests).
 * RULES: every move ends in Collide.settle on the body's two circles, in legs <= MAX_LEG; the
 *   ridden animal is not a collider; the hero is never settled against his own animal.
 * DEPENDENCIES: mounts.js, mount-rigs.js, mount-sound.js, collide.js, player.js, camera.js,
 *   vehicle-spots.js (zones), ui-core.js (toast), hud.js (Jump label).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const SM = () => KQ.Sim.Mount;
  const SV = () => KQ.Sim.Vehicle;
  const MAX_LEG = 0.2;
  const NOTE_GAP = 4;
  const IDLE = { x: 0, y: 0, mag: 0, run: false };
  /** The line for a place animals do not go; the vehicles' masjid line is kept, others get this. */
  const NOT_HERE = "Animals wait outside here. Let's get down and walk.";
  const R = { cur: null, exiting: false, posed: false, cam: null, seat: null, t: 0 };
  Object.assign(R, {
    zones: [],
    zonesT: -99,
    noteAt: -99,
    blocked: 0,
    braked: 0,
    rides: 0,
    exits: 0,
  });

  /* ------------------------------ surroundings ------------------------------ */

  /** Everyone on foot near a point: visible cast neighbours and crowd extras, as {x, z}. */
  function peopleNear(x, z) {
    const s = S();
    const out = [];
    const near = (p) => U.dist2(p.x, p.z, x, z) < 18 * 18;
    s.npcs.agents.forEach((A) => !A.hidden && A.group.visible && near(A) && out.push(A));
    if (s.crowd) s.crowd.members.forEach((m) => m.show > 0.3 && near(m) && out.push(m));
    G.Actors.positions().forEach((p) => near(p) && out.push(p));
    return out;
  }

  /** The places animals may not go (the vehicles' no-drive zones), refreshed once a second. */
  function zonesNow() {
    if (R.t - R.zonesT > 1) {
      R.zones = G.VehicleSpots.zones();
      R.zonesT = R.t;
    }
    return R.zones;
  }

  /** A friendly line, at most once every few seconds. */
  function note(say) {
    if (R.t - R.noteAt < NOTE_GAP) return;
    R.noteAt = R.t;
    const masjid = say && /masjid/i.test(say);
    R.note = masjid ? say + ". Animals wait outside." : NOT_HERE;
    G.UI.toast(R.note, "hint", 3000);
  }

  /* ------------------------------ moving ------------------------------ */

  /** Would the body end up in a zone it was not in before? Returns the zone or null. */
  function zoneBlock(a, from, to) {
    const zones = zonesNow();
    const r = a.sim.spec.ring.r * a.rig.scale;
    for (let i = 0; i < 2; i += 1) {
      const z = SV().blockedMove(zones, from[i].x, from[i].z, to[i].x, to[i].z, r);
      if (z) return z;
    }
    return null;
  }

  /** Push the body out of walls with its two circles; returns how far it had to move (m). */
  function settleBody(a) {
    const r = a.sim.spec.ring.r * a.rig.scale;
    const cols = S().world.colliders;
    let pushed = 0;
    G.Mounts.rings(a).forEach(function (c) {
      const before = { x: c.x, z: c.z };
      G.Collide.settle(cols, c, r);
      a.sim.x += c.x - before.x;
      a.sim.z += c.z - before.z;
      pushed += U.dist(before.x, before.z, c.x, c.z);
    });
    return pushed;
  }

  /** One short leg: walk on, stop gently at a zone, slide along walls (losing a little speed). */
  function leg(a, dt) {
    const m = a.sim;
    const from = G.Mounts.rings(a);
    const was = { x: m.x, z: m.z };
    SM().advance(m, dt);
    const hit = zoneBlock(a, from, G.Mounts.rings(a));
    if (hit) {
      m.x = was.x;
      m.z = was.z;
      m.speed = 0;
      R.blocked += 1;
      note(hit.say);
      return;
    }
    if (settleBody(a) > 0.01) m.speed *= 0.85;
  }

  /** Move for dt in legs short enough not to skip a thin wall. */
  function moveLegs(a, dt) {
    const n = Math.max(1, Math.ceil((a.sim.speed * dt) / MAX_LEG));
    for (let i = 0; i < n; i += 1) leg(a, dt / n);
  }

  /** Stick to heading and speed (camera-relative), then slow for anyone close. */
  function control(a, move, dt) {
    const m = a.sim;
    if (R.exiting) SM().stopGently(m, dt);
    else SM().steer(m, SM().wishOf(move, G.Camera.state.yaw), dt);
    if (SM().yieldTo(m, peopleNear(m.x, m.z), dt)) R.braked += 1;
  }

  /** A soft hoof fall on each beat of the stride (twice a cycle). */
  function hooves(a, before) {
    const beat = (p) => Math.floor(p * 2);
    if (a.sim.speed > 0.4 && beat(a.sim.phase) !== beat(before)) G.MountSound.clop(a.kind);
  }

  /* ------------------------------ the rider ------------------------------ */

  /** Put the hero in the saddle: place, heading, speed and the ride pose (bouncing with the gait). */
  function seatHero(a, dt) {
    const P = S().player;
    const at = G.MountRigs.seatOf(a);
    const hip = P.rig.dims.hipH * P.rig.dims.scale;
    P.pos.set(at.x, at.y - hip, at.z);
    P.heading = a.sim.heading;
    P.speed = a.sim.speed;
    P.vx = Math.sin(a.sim.heading) * a.sim.speed;
    P.vz = Math.cos(a.sim.heading) * a.sim.speed;
    P.moving = P.speed > 0.3;
    R.seat = { x: P.pos.x, z: P.pos.z };
    if (!R.posed) {
      P.anim.play(a.kind === "camel" ? "ride_camel" : "ride", 0.25, 0.4);
      R.posed = true;
    }
    P.anim.setRate(U.clamp(0.4 + a.sim.speed / 3, 0.4, 3));
    P.anim.update(dt);
    G.Player.sync(P);
  }

  /** Ease the camera back and up the first moments of a ride. */
  function steerCamera(a, dt) {
    const C = G.Camera.state;
    if (!R.cam || R.cam.eased) return;
    const sp = a.sim.spec;
    C.dist = U.damp(C.dist, sp.camDist * a.rig.scale, 3, dt);
    C.pitch = U.damp(C.pitch, sp.camPitch, 3, dt);
    if (Math.abs(C.dist - sp.camDist * a.rig.scale) < 0.1) R.cam.eased = true;
  }

  /** The Jump button pats the animal while riding (its call): label it so. */
  function labelJump(word) {
    const H = G.Hud && G.Hud.refs;
    if (!H || !H.jump) return;
    H.jump.setAttribute("aria-label", word);
    const span = H.jump.querySelector("span");
    if (span) span.textContent = word;
  }

  /* ------------------------------ on and off ------------------------------ */

  /** Climb on: the animal stops being a collider, the hero takes the saddle, the camera eases back. */
  function mount(a) {
    if (R.cur || (G.Vehicles && G.Vehicles.mounted())) return false;
    const s = S();
    G.Mounts.unpark(a);
    R.cur = a;
    R.exiting = false;
    R.posed = false;
    R.rides += 1;
    a.hi = 0;
    a.sim.speed = 0;
    R.cam = { eased: false, dist: G.Camera.state.dist, pitch: G.Camera.state.pitch };
    s.player.group.visible = true;
    G.Player.place(s.player, a.sim.x, a.sim.z, a.sim.heading, s.world.heightAt);
    seatHero(a, 0);
    labelJump("Pat");
    G.Audio.play("pose");
    G.UI.toast("Push the stick to ride. Exit gets you down.", "hint", 2600);
    s.hudDirty = true;
    G.Camera.state.idle = 0;
    return true;
  }

  /** A free spot beside the animal to step down to (clear of walls and of the no-ride zones). */
  function pickExit(a) {
    const cols = S().world.colliders;
    const zones = zonesNow();
    const r = G.Player.RADIUS + 0.05;
    const ok = (p) => !G.Collide.blockedAt(cols, p.x, p.z, r) && !SV().zoneAt(zones, p.x, p.z, 0);
    const list = SM().exitSpots(a.sim);
    return list.find(ok) || G.Collide.freeSpot(cols, list[0].x, list[0].z, G.Player.RADIUS);
  }

  /** Get down: the animal stands where it is (solid again), the hero beside it, the camera back. */
  function finishExit(placeHero) {
    const a = R.cur;
    const s = S();
    R.cur = null;
    R.exiting = false;
    R.exits += 1;
    a.sim.speed = 0;
    if (placeHero) {
      const p = pickExit(a);
      G.Player.place(s.player, p.x, p.z, a.sim.heading, s.world.heightAt);
      G.Camera.snapBehind(s.player.heading);
    }
    G.Mounts.park(a);
    labelJump("Jump");
    restoreCamera();
    s.hudDirty = true;
  }

  /** Give the camera back its walking distance and tilt. */
  function restoreCamera() {
    if (!R.cam) return;
    G.Camera.state.dist = R.cam.dist;
    G.Camera.state.pitch = R.cam.pitch;
    R.cam = null;
  }

  /** Exit pressed: slow to a stop first (update finishes the exit). */
  function leave() {
    if (!R.cur) return false;
    R.exiting = true;
    if (R.cur.sim.speed < 0.3) finishExit(true);
    return true;
  }

  /** The Exit prompt over the ridden animal. */
  function exitTarget() {
    const a = R.cur;
    return {
      kind: "obj",
      id: "mount:exit",
      label: "Exit",
      aria: "Get down from " + a.name,
      x: a.sim.x,
      z: a.sim.z,
      dist: 0,
      enabled: true,
      h: (a.kind === "camel" ? 3.0 : 2.2) * a.rig.scale,
    };
  }

  /* ------------------------------ per frame ------------------------------ */

  /** Has something else moved the hero (a teleport, a flow that holds him)? Then he is off. */
  function displaced(P) {
    if (P.locked) return true;
    return R.seat && U.dist(P.pos.x, P.pos.z, R.seat.x, R.seat.z) > 0.6;
  }

  /** One frame of riding. */
  function ride(a, dt, move) {
    const phase = a.sim.phase;
    control(a, move, dt);
    moveLegs(a, dt);
    SM().stepGait(a.sim, dt);
    a.y = U.damp(a.y, S().world.heightAt(a.sim.x, a.sim.z), 18, dt);
    G.MountRigs.pose(a, R.t);
    seatHero(a, dt);
    steerCamera(a, dt);
    hooves(a, phase);
    if (R.exiting && a.sim.speed < 0.3) finishExit(true);
  }

  /** Called by Mounts.update; true while riding (the hero was moved here). */
  function update(dt, move, free) {
    R.t += dt;
    if (!R.cur) return false;
    if (displaced(S().player)) {
      finishExit(false);
      return false;
    }
    ride(R.cur, dt, free ? move : IDLE);
    return true;
  }

  /** The Jump button / Space while riding: a pat, and the animal answers. */
  function pat() {
    if (!R.cur) return false;
    return G.MountSound.call(R.cur.kind);
  }

  G.MountRide = {
    mount,
    leave,
    update,
    pat,
    exitTarget,
    riding: () => Boolean(R.cur),
    current: () => R.cur,
    debug: () => ({
      exiting: R.exiting,
      blocked: R.blocked,
      braked: R.braked,
      rides: R.rides,
      exits: R.exits,
      zones: R.zones.length,
      note: R.note || "",
    }),
  };
})((window.KQ = window.KQ || {}));
