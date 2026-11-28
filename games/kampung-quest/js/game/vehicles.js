/* ============================================================================
 * FILE: vehicles.js
 * PURPOSE: The toy cars and bicycles the hero can drive and ride: parked at their spots, a
 *          "Drive" / "Ride" prompt beside one, getting in, steering with the stick, braking for
 *          people, stopping at no-drive zones, getting out at a free spot.
 * BUSINESS CONTEXT: AC-H6 (enter / exit a car, ride a bicycle, in both regions; never harm
 *   anyone; never inside mosques or the mataf). Child-friendly: a vehicle only slows down, it
 *   cannot hurt anyone, there is no fail state and a wall just stops it gently.
 * HOW IT FITS: Loop.stepActors calls update(dt, move, free) before the hero's own movement and
 *   skips Player.update when it returns true (the hero is mounted: this file moves, poses and
 *   syncs the hero). Interact.find asks target(hero) for the Drive / Ride / Exit button.
 *   The pure rules (speeds, turning, braking, zones) are KQ.Sim.Vehicle; the meshes are
 *   KQ.Figures.Vehicles; spots and zones are vehicle-spots.js; the hum and horn vehicle-sound.js.
 * RULES: all movement ends in Collide.settle (two circles per vehicle); a parked vehicle is ONE
 *   oriented-box collider the size of its body (AC-P12: nobody walks through the middle of a car; it is
 *   removed while the vehicle is driven); a driven vehicle stops when it touches a parked one; the hero
 *   is never settled against his own vehicle; a vehicle left far away goes back to its spot. Every
 *   vehicle sits on the plane through the ground under its wheels (AC-P11, Sim.Vehicle.groundPose).
 * DEPENDENCIES: collide.js, player.js, camera.js, ui-core.js (toast), hud.js (Jump label),
 *   vehicle-spots.js, vehicle-sound.js, KQ.Sim.Vehicle, KQ.Figures.Vehicles.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const SV = () => KQ.Sim.Vehicle;
  const S = () => G.S;
  /** The prompt shows within this many metres of a vehicle's body. */
  const REACH = 1.5;
  /** A vehicle left this far from the hero goes back to where it was parked (m), checked every second. */
  const HOME_FAR = 45;
  /** Parked vehicles farther than this from the hero are not drawn (m); checked twice a second. */
  const DRAW_FAR = 85;
  /** The longest move tested against walls at once (m), like the hero's own legs. */
  const MAX_LEG = 0.2;
  /** Seconds between two "let's walk" notes. */
  const NOTE_GAP = 4;
  const POSE = { car: "drive", bike: "pedal", moto: "drive", lorry: "drive" };
  const NOUN = { car: "car", bike: "bicycle", moto: "scooter", lorry: "lorry" };
  /** The Jump button's word while mounted, per kind. */
  const HORN_WORD = { car: "Honk", bike: "Ring", moto: "Beep", lorry: "Honk" };
  const IDLE = { x: 0, y: 0, mag: 0, run: false };
  /** A parked bicycle leans on its kickstand by this much (radians, toward its right, where the stand is). */
  const STAND_LEAN = 0.1;
  const V = {
    list: [],
    mounted: null,
    ready: false,
    t: 0,
    homeT: 0,
    cullT: 0,
    zones: [],
    zonesT: -99,
    noteAt: -99,
    exiting: false,
    posed: false,
    cam: null,
    seat: null,
    blocked: 0,
    braked: 0,
    bumped: 0,
  };

  /* ------------------------------ setup ------------------------------ */

  /** The world's ground height under a point. */
  const groundAt = (x, z) => S().world.heightAt(x, z);

  /** The two circles a vehicle's body is tested with, as {x, z}. */
  function rings(v) {
    const r = v.sim.spec.ring;
    const fx = Math.sin(v.sim.heading);
    const fz = Math.cos(v.sim.heading);
    return [-1, 1].map((k) => ({ x: v.sim.x + fx * r.off * k, z: v.sim.z + fz * r.off * k }));
  }

  /** The oriented box of the body (the model's own footprint when it has one, else the spec's). */
  function footprint(v) {
    const f = v.mesh.foot;
    const sim = v.sim;
    if (!f) return SV().box(sim, 0);
    const o = SV().box(sim, 0);
    o.hx = f.hw;
    o.hz = f.hl;
    o.x = sim.x + Math.sin(sim.heading) * f.mid;
    o.z = sim.z + Math.cos(sim.heading) * f.mid;
    return o;
  }

  /** The collider of a parked vehicle: one oriented box the size of its body (AC-P12). */
  function boxesOf(v) {
    const b = G.Collide.orientedBox(footprint(v), v.kind);
    b.vehicle = v.id;
    return [b];
  }

  /** NPCs cache the colliders near them; make them look again after a vehicle moved. */
  function refreshNear() {
    const npcs = S().npcs;
    if (npcs && npcs.agents) npcs.agents.forEach((A) => (A.nearAt = null));
  }

  /** Make a parked vehicle solid (the world colliders list is shared by hero, NPCs and camera). */
  function park(v) {
    unpark(v);
    v.boxes = boxesOf(v);
    v.boxes.forEach((b) => S().world.colliders.push(b));
    refreshNear();
  }

  /** Take a vehicle's boxes out of the world (it is about to be driven). */
  function unpark(v) {
    if (!v.boxes) return;
    const list = S().world.colliders;
    v.boxes.forEach(function (b) {
      const i = list.indexOf(b);
      if (i !== -1) list.splice(i, 1);
    });
    v.boxes = null;
  }

  /** Put a vehicle's mesh where its sim state is: on the ground under its wheels, leaning into a turn. */
  function syncMesh(v) {
    const g = v.mesh.group;
    g.position.set(v.sim.x, v.y, v.sim.z);
    g.rotation.order = "YXZ";
    g.rotation.y = v.sim.heading;
    g.rotation.x = -v.pitch;
    const turn =
      v.kind === "car" ? 0 : -v.sim.steer * Math.min(1, Math.abs(v.sim.speed) / 4) * 0.22;
    g.rotation.z = v.roll + turn + (v.lean || 0);
  }

  /** The ground pose under the wheels right now: {y, pitch, roll}. */
  function poseNow(v) {
    return SV().groundPose(v.sim, v.mesh.contacts, groundAt);
  }

  /** Snap a vehicle onto the ground under its wheels (parking, going home). */
  function ground(v) {
    const p = poseNow(v);
    v.y = p.y;
    v.pitch = p.pitch;
    v.roll = p.roll;
    KQ.Figures.Vehicles.suspend(v.mesh, p.off);
  }

  /** Does a tyre stand right on the edge of a kerb (the ground differs a few cm to either side of it)? */
  function onEdge(v) {
    const f = [Math.sin(v.sim.heading), Math.cos(v.sim.heading)];
    const at = (p, d) =>
      groundAt(
        v.sim.x + f[0] * p.fwd + f[1] * (p.lat + d),
        v.sim.z + f[1] * p.fwd - f[0] * (p.lat + d),
      );
    return v.mesh.contacts.some((p) => Math.abs(at(p, -0.07) - at(p, 0.07)) > 0.01);
  }

  /** Slide a vehicle parked astride a kerb edge sideways (a few cm at a time) until its tyres stand on one level. */
  function offEdge(v) {
    const sim = v.sim;
    const x = sim.x;
    const z = sim.z;
    const side = [Math.cos(sim.heading), -Math.sin(sim.heading)];
    for (let i = 1; i <= 10 && onEdge(v); i += 1) {
      const d = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.08;
      sim.x = x + side[0] * d;
      sim.z = z + side[1] * d;
      if (!bodyFree(v)) Object.assign(sim, { x, z });
    }
    if (onEdge(v)) Object.assign(sim, { x, z });
  }

  /** Is the whole body (both circles) clear of walls and other vehicles? */
  function bodyFree(v) {
    const cols = S().world.colliders;
    const r = v.sim.spec.ring.r;
    return rings(v).every((c) => !G.Collide.blockedAt(cols, c.x, c.z, r * 0.9));
  }

  /** Nudge a vehicle whose spot a wall or prop covers to the nearest place its whole body fits. */
  function placeFree(v) {
    const sim = v.sim;
    const x = sim.x;
    const z = sim.z;
    for (let ring = 0; ring <= 12 && !bodyFree(v); ring += 1) {
      for (let k = 0; k < 12; k += 1) {
        sim.x = x + Math.cos((k / 12) * Math.PI * 2) * ring * 0.4;
        sim.z = z + Math.sin((k / 12) * Math.PI * 2) * ring * 0.4;
        if (bodyFree(v)) return;
      }
    }
    if (!bodyFree(v)) Object.assign(sim, { x, z });
  }

  /**
   * Add a parked vehicle: {kind, x, z, heading, color}. A spot a wall or prop covers is nudged to
   * the nearest free place. Returns its id, or null for a bad spot.
   */
  function spawn(spot) {
    const sim = SV().create(spot.kind, spot.x, spot.z, spot.heading);
    const mesh = KQ.Figures.Vehicles.build(spot.kind, spot.color, spot);
    if (!sim || !mesh) return null;
    const v = { id: spot.kind + (V.list.length + 1), kind: spot.kind, sim, mesh, y: 0 };
    v.pitch = v.roll = 0;
    v.lean = spot.kind === "bike" ? STAND_LEAN : 0;
    placeFree(v);
    offEdge(v);
    v.style = mesh.style;
    v.home = { x: sim.x, z: sim.z, heading: sim.heading };
    ground(v);
    S().scene.add(mesh.group);
    syncMesh(v);
    park(v);
    V.list.push(v);
    return v.id;
  }

  /** Build the parked vehicles once the world exists (lazily, from the first update). */
  function ensure() {
    const s = S();
    if (V.ready || !s || !s.world || !s.scene) return;
    V.ready = true;
    G.VehicleSpots.spots().forEach(spawn);
  }

  /* ------------------------------ who is around ------------------------------ */

  /** Everyone on foot near a point: visible cast neighbours and crowd extras, as {x, z}. */
  function peopleNear(x, z) {
    const s = S();
    const out = [];
    const far = V.mounted ? Math.max(18, SV().lookAhead(V.mounted.sim.spec) + 3) : 18;
    const near = (p) => U.dist2(p.x, p.z, x, z) < far * far;
    s.npcs.agents.forEach((A) => !A.hidden && A.group.visible && near(A) && out.push(A));
    if (s.crowd) s.crowd.members.forEach((m) => m.show > 0.3 && near(m) && out.push(m));
    return out;
  }

  /** The no-drive zones, refreshed once a second (a world may add its list late). */
  function zonesNow() {
    if (V.t - V.zonesT > 1) {
      V.zones = G.VehicleSpots.zones();
      V.zonesT = V.t;
    }
    return V.zones;
  }

  /* ------------------------------ driving ------------------------------ */

  /** Say a friendly "let's walk" line, at most once every few seconds. */
  function note(text) {
    if (V.t - V.noteAt < NOTE_GAP) return;
    V.noteAt = V.t;
    G.UI.toast(text || "Let's walk here", "hint", 2800);
  }

  /** Would the body (both circles) end up inside a no-drive zone it was not in before? Returns the zone or null. */
  function zoneBlock(v, from, to) {
    const zones = zonesNow();
    const r = v.sim.spec.ring.r;
    for (let i = 0; i < 2; i += 1) {
      const z = SV().blockedMove(zones, from[i].x, from[i].z, to[i].x, to[i].z, r);
      if (z) return z;
    }
    return null;
  }

  /**
   * Push the body out of walls with its two circles; returns how far it had to move (m), the push (px, pz)
   * and whether it touched another (parked) vehicle.
   */
  function settleBody(v) {
    const r = v.sim.spec.ring;
    const cols = S().world.colliders;
    const out = { pushed: 0, vehicle: false, px: 0, pz: 0 };
    rings(v).forEach(function (c) {
      const hit = G.Collide.blockedAt(cols, c.x, c.z, r.r);
      if (hit && hit.vehicle) out.vehicle = true;
      const before = { x: c.x, z: c.z };
      G.Collide.settle(cols, c, r.r);
      v.sim.x += c.x - before.x;
      v.sim.z += c.z - before.z;
      out.px += c.x - before.x;
      out.pz += c.z - before.z;
      out.pushed += U.dist(before.x, before.z, c.x, c.z);
    });
    return out;
  }

  /** One short leg of movement: roll, stop gently at a zone, slide along walls (and lose a little speed). */
  function leg(v, dt) {
    const from = rings(v);
    const sim = v.sim;
    const was = { x: sim.x, z: sim.z };
    SV().advance(sim, dt);
    const hit = zoneBlock(v, from, rings(v));
    if (hit) {
      sim.x = was.x;
      sim.z = was.z;
      sim.speed = 0;
      V.blocked += 1;
      note(hit.say);
      return;
    }
    const touch = settleBody(v);
    if (touch.vehicle && headOn(sim, touch)) {
      sim.speed = 0; // a driven vehicle stops at another one (AC-P12); it never pushes it
      V.bumped += 1;
    } else if (touch.pushed > 0.01) sim.speed *= 0.82;
  }

  /** Was the push straight against the way it rolls (a bump, not a scrape it can steer out of)? */
  function headOn(sim, touch) {
    const along = touch.px * Math.sin(sim.heading) + touch.pz * Math.cos(sim.heading);
    return along * Math.sign(sim.speed || 1) < -0.6 * touch.pushed;
  }

  /** Move the vehicle for dt in legs short enough not to skip a thin wall. */
  function moveLegs(v, dt) {
    const n = Math.max(1, Math.ceil(Math.abs(v.sim.speed * dt) / MAX_LEG));
    for (let i = 0; i < n; i += 1) leg(v, dt / n);
  }

  /** Stick to speed and heading, then slow for anyone close (people are never hit). */
  function control(v, move, dt) {
    const sv = v.sim;
    const out = V.exiting ? IDLE : move;
    if (V.exiting) SV().stopGently(sv, dt);
    else SV().stepSpeed(sv, SV().throttleOf(out), dt);
    SV().stepHeading(sv, SV().steerOf(out), dt);
    const cap = SV().speedCap(sv, peopleNear(sv.x, sv.z));
    if (SV().brakeFor(sv, cap, dt)) V.braked += 1;
  }

  /**
   * Sit on the ground under the wheels every frame (height, pitch, roll). Not smoothed: a damped height sank
   * the tyres 10 cm into a kerb for a few frames (AC-P11); the plane through the four contacts already turns
   * a kerb into a gentle tilt as each wheel climbs it in turn. The stand lean fades once riding.
   */
  function follow(v, dt) {
    ground(v);
    v.lean = U.damp(v.lean || 0, 0, 8, dt);
  }

  /* ------------------------------ the rider ------------------------------ */

  /** The hero's world position in the seat of a vehicle. */
  function seatOf(v) {
    const seat = KQ.Figures.Vehicles.SEAT[v.kind];
    const h = v.sim.heading;
    const lat = v.mesh.seatX;
    return {
      x: v.sim.x + Math.sin(h) * seat.z + Math.cos(h) * lat,
      y: v.y + seat.y,
      z: v.sim.z + Math.cos(h) * seat.z - Math.sin(h) * lat,
    };
  }

  /** Put the hero in the seat: place, heading, speed and the driving / pedalling pose. */
  function seatHero(v, dt) {
    const P = S().player;
    const at = seatOf(v);
    P.pos.set(at.x, at.y, at.z);
    P.heading = v.sim.heading;
    P.speed = Math.abs(v.sim.speed);
    P.vx = Math.sin(v.sim.heading) * v.sim.speed;
    P.vz = Math.cos(v.sim.heading) * v.sim.speed;
    P.moving = P.speed > 0.3;
    V.seat = at;
    if (!V.posed) {
      P.anim.play(POSE[v.kind], 0.2, v.kind === "bike" ? 1.5 : 0.3);
      V.posed = true;
    }
    P.anim.setRate(v.kind === "bike" ? U.clamp(P.speed / 3.5, 0, 2.4) : 1);
    P.anim.update(dt);
    G.Player.sync(P);
  }

  /**
   * Ease the camera further back (and a touch higher) the first moments of a ride; then pull it a little
   * further back as the vehicle speeds up (camFar at top speed, AC-P13) and swing it in behind the vehicle,
   * keeping any zoom the player chose.
   */
  function steerCamera(v, dt) {
    const C = G.Camera.state;
    const spec = v.sim.spec;
    const frac = U.clamp(Math.abs(v.sim.speed) / spec.maxFwd, 0, 1);
    const extra = U.damp(V.cam.extra, spec.camFar * frac, 2, dt);
    C.dist += extra - V.cam.extra;
    V.cam.extra = extra;
    if (C.idle > 0.8 && v.sim.speed > 1.5)
      C.yaw = U.dampAngle(C.yaw, v.sim.heading, 1 + 2 * frac, dt);
    if (V.cam.eased) return;
    C.dist = U.damp(C.dist, spec.camDist + extra, 3, dt);
    C.pitch = U.damp(C.pitch, spec.camPitch, 3, dt);
    if (Math.abs(C.dist - spec.camDist - extra) < 0.1) V.cam.eased = true;
  }

  /* ------------------------------ get in / get out ------------------------------ */

  /** The Jump button doubles as the horn / bell while mounted; label it so. */
  function labelHorn(kind) {
    const R = G.Hud && G.Hud.refs;
    if (!R || !R.jump) return;
    const word = HORN_WORD[kind] || "Jump";
    R.jump.setAttribute("aria-label", word);
    const span = R.jump.querySelector("span");
    if (span) span.textContent = word;
  }

  /** Get in: the hero takes the seat, the vehicle stops being a collider, the camera eases back. */
  function mount(v) {
    const s = S();
    unpark(v);
    V.mounted = v;
    V.exiting = false;
    V.posed = false;
    KQ.Figures.Vehicles.setOccupied(v.mesh, true);
    V.cam = { eased: false, extra: 0, dist: G.Camera.state.dist, pitch: G.Camera.state.pitch };
    s.player.group.visible = true;
    v.sim.speed = 0;
    V.seat = seatOf(v);
    // straight into the seat: a lorry's cab seat is far ahead of its middle, which read as "displaced"
    G.Player.place(s.player, V.seat.x, V.seat.z, v.sim.heading, groundAt);
    labelHorn(v.kind);
    G.Audio.play("pose");
    s.hudDirty = true;
    G.Camera.state.idle = 0;
  }

  /** Candidate places beside a vehicle for the hero to step out to: left, right, behind, ahead (x, z). */
  function exitSpots(v) {
    const side = v.kind === "bike" || v.kind === "moto" ? 0.85 : v.sim.spec.halfWid + 0.75;
    const end = v.sim.spec.halfLen + 0.9;
    const h = v.sim.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const at = (fwd, lat) => ({
      x: v.sim.x + fx * fwd + fz * lat,
      z: v.sim.z + fz * fwd - fx * lat,
    });
    return [at(0, side), at(0, -side), at(-end, 0), at(end, 0), at(0, side + 1)];
  }

  /** The first exit spot that is clear of walls and no-drive-free enough to stand in; else the nearest free one. */
  function pickExit(v) {
    const cols = S().world.colliders;
    const list = exitSpots(v);
    const ok = list.find((p) => !G.Collide.blockedAt(cols, p.x, p.z, G.Player.RADIUS + 0.05));
    return ok || G.Collide.freeSpot(cols, list[0].x, list[0].z, G.Player.RADIUS);
  }

  /** Leave the seat: hero to a free spot beside it, vehicle parked where it stands, camera back. */
  function finishExit(placeHero) {
    const v = V.mounted;
    const s = S();
    V.mounted = null;
    V.exiting = false;
    v.sim.speed = 0;
    v.lean = v.kind === "bike" ? STAND_LEAN : 0;
    syncMesh(v);
    KQ.Figures.Vehicles.setOccupied(v.mesh, false);
    if (placeHero) {
      const p = pickExit(v);
      G.Player.place(s.player, p.x, p.z, v.sim.heading, groundAt);
      G.Camera.snapBehind(s.player.heading);
    }
    park(v);
    G.VehicleSound.stop();
    labelHorn(null);
    restoreCamera();
    s.hudDirty = true;
  }

  /** Give the camera back its walking distance and tilt. */
  function restoreCamera() {
    const C = G.Camera.state;
    if (!V.cam) return;
    C.dist = V.cam.dist;
    C.pitch = V.cam.pitch;
    V.cam = null;
  }

  /** The button asked to get out: brake to a stop first (update finishes the exit). */
  function leave() {
    V.exiting = true;
    if (Math.abs(V.mounted.sim.speed) < 0.3) finishExit(true);
  }

  /** Press the Drive / Ride / Exit button for a prompt id ("vehicle:<id>" or "vehicle:exit"). */
  function press(id) {
    if (V.mounted) return leave();
    const v = V.list.find((x) => "vehicle:" + x.id === id);
    if (v) mount(v);
  }

  /* ------------------------------ the prompt ------------------------------ */

  /** How far the hero stands from the body of a parked vehicle (m, 0 touching). */
  function gapTo(v, hero) {
    const r = v.sim.spec.ring.r;
    return Math.min(...rings(v).map((c) => U.dist(hero.x, hero.z, c.x, c.z) - r));
  }

  /** The Talk-button target: "Get out" while mounted, else Drive / Ride for the nearest parked vehicle in reach. */
  function target(hero) {
    if (V.mounted) return exitTarget(V.mounted);
    let best = null;
    V.list.forEach(function (v) {
      const d = gapTo(v, hero);
      if (d <= REACH && (!best || d < best.d)) best = { v, d };
    });
    if (!best) return null;
    const v = best.v;
    return promptFor(v, "vehicle:" + v.id, v.sim.spec.label, best.d);
  }

  /** The Exit prompt, floating over the vehicle the hero is in. */
  function exitTarget(v) {
    return promptFor(v, "vehicle:exit", "Exit", 0, "Get out of the " + NOUN[v.kind]);
  }

  /** A Talk-button target for a vehicle. */
  function promptFor(v, id, label, dist, aria) {
    return {
      kind: "obj",
      id,
      label,
      aria: aria || label + " the " + NOUN[v.kind],
      x: v.sim.x,
      z: v.sim.z,
      dist,
      enabled: true,
      h: { car: 1.9, lorry: 2.6 }[v.kind] || 1.4,
    };
  }

  /* ------------------------------ per frame ------------------------------ */

  /** Hide the parked vehicles far from the hero (a street of 30 cars would cost hundreds of draw calls). */
  function cull(hero, dt) {
    V.cullT -= dt;
    if (V.cullT > 0) return;
    V.cullT = 0.5;
    V.list.forEach(function (v) {
      v.mesh.group.visible = v === V.mounted || U.dist(v.sim.x, v.sim.z, hero.x, hero.z) < DRAW_FAR;
    });
  }

  /** A parked vehicle left far behind goes back to its spot (nobody sees it jump). */
  function sendHome(hero, dt) {
    V.homeT += dt;
    if (V.homeT < 1) return;
    V.homeT = 0;
    V.list.forEach(function (v) {
      if (v === V.mounted) return;
      const away = U.dist(v.sim.x, v.sim.z, v.home.x, v.home.z) > 0.5;
      if (away && U.dist(v.sim.x, v.sim.z, hero.x, hero.z) > HOME_FAR) returnHome(v);
    });
  }

  /** Put a vehicle back at its parking spot. */
  function returnHome(v) {
    unpark(v);
    v.sim.x = v.home.x;
    v.sim.z = v.home.z;
    v.sim.heading = v.home.heading;
    v.sim.speed = 0;
    v.sim.steer = 0;
    v.lean = v.kind === "bike" ? STAND_LEAN : 0;
    ground(v);
    syncMesh(v);
    park(v);
  }

  /** Has something else moved the hero (a teleport, a flow that holds him)? Then he is out of the seat. */
  function displaced(P) {
    if (P.locked) return true;
    return V.seat && U.dist(P.pos.x, P.pos.z, V.seat.x, V.seat.z) > 0.6;
  }

  /** One frame of a mounted ride. */
  function ride(dt, move) {
    const v = V.mounted;
    control(v, move, dt);
    moveLegs(v, dt);
    follow(v, dt);
    syncMesh(v);
    KQ.Figures.Vehicles.animate(v.mesh, dt, v.sim.speed, v.sim.steer);
    seatHero(v, dt);
    steerCamera(v, dt);
    G.VehicleSound.update(dt, v.kind, Math.abs(v.sim.speed), v.sim.spec.maxFwd);
    if (V.exiting && Math.abs(v.sim.speed) < 0.3) finishExit(true);
  }

  /**
   * Called every sim step from Loop.stepActors, before the hero's own movement.
   * @param {number} dt seconds
   * @param {{x:number,y:number}} move the stick (camera-relative is not used: a vehicle steers like a car)
   * @param {boolean} free false while a menu is open (the vehicle then rolls to a stop)
   * @returns {boolean} true when the hero is mounted and this file moved him (skip Player.update)
   */
  function update(dt, move, free) {
    ensure();
    if (!V.ready) return false;
    V.t += dt;
    const P = S().player;
    sendHome(P.pos, dt);
    cull(P.pos, dt);
    if (G.Bus) G.Bus.update(dt);
    if (!V.mounted) return false;
    if (displaced(P)) {
      finishExit(false);
      return false;
    }
    ride(dt, free ? move : IDLE);
    return true;
  }

  /** Put every parked vehicle back at its spot (a tidy-up for tests and for a new game). */
  function returnAll() {
    V.list.forEach((v) => v !== V.mounted && returnHome(v));
  }

  /** The Jump button / Space while mounted: honk the horn or ring the bell. */
  function horn() {
    return V.mounted ? G.VehicleSound.horn(V.mounted.kind) : false;
  }

  /** Test hook: the vehicles, which one is mounted, and the counters. */
  function debug() {
    return {
      region: G.VehicleSpots.region(),
      ready: V.ready,
      mounted: V.mounted ? V.mounted.id : null,
      kind: V.mounted ? V.mounted.kind : null,
      exiting: V.exiting,
      zones: V.zones.length,
      blocked: V.blocked,
      braked: V.braked,
      bumped: V.bumped,
      sound: G.VehicleSound.debug(),
      bus: G.Bus ? G.Bus.debug() : null,
      list: V.list.map((v) => ({
        id: v.id,
        kind: v.kind,
        style: v.style,
        x: Number(v.sim.x.toFixed(2)),
        z: Number(v.sim.z.toFixed(2)),
        heading: Number(v.sim.heading.toFixed(2)),
        speed: Number(v.sim.speed.toFixed(2)),
        parked: v !== V.mounted,
      })),
    };
  }

  /**
   * Test hook (AC-P11): for each vehicle, the worst gap between the bottom of a tyre and the ground height under
   * it (m; > 0 hovers, < 0 sinks): each tyre's lowest point is carried through the drawn wheel pivot's transform
   * (body pose, suspension and steering included); the ground under it is the highest in its footprint
   * (Sim.Vehicle.groundUnder: on a kerb's edge the tyre stands on the kerb).
   */
  function groundGaps() {
    const p = new THREE.Vector3();
    return V.list.map(function (v) {
      v.mesh.group.updateMatrixWorld(true);
      let worst = 0;
      v.mesh.feet.forEach(function (f) {
        p.set(f.at[0], f.at[1], f.at[2]);
        f.pivot.localToWorld(p);
        const gap = p.y - SV().groundUnder(groundAt, p.x, p.z);
        if (Math.abs(gap) > Math.abs(worst)) worst = gap;
      });
      return { id: v.id, kind: v.kind, gap: Number(worst.toFixed(3)) };
    });
  }

  G.Vehicles = {
    update,
    groundGaps,
    target,
    press,
    horn,
    returnAll,
    spawn,
    debug,
    mounted: () => Boolean(V.mounted),
    /** Where every drivable vehicle is (their sim states: x, z, heading, speed); the bus brakes for them. */
    sims: () => V.list.map((v) => v.sim),
    exiting: () => V.exiting,
  };
})((window.KQ = window.KQ || {}));
