/* ============================================================================
 * FILE: vehicle-rig.js
 * PURPOSE: Kampung Quest — the rig every built vehicle carries (F.VehicleRig), the one surface the game layer
 *          (enter / exit, ambient traffic, bus passengers, sound) drives the models through. Local frame of the
 *          vehicle: faces +z, its left is +x, y up, origin on the ground mid-wheelbase.
 *
 *   v.rig.doors    [{ side: "L" | "R", seat: index into rig.seats, pivot: Object3D, kind, open(t), t }]
 *                  open(t), t 0 shut .. 1 open: a car / lorry door swings about its front edge (hinge) to 65 deg;
 *                  an MPV rear door ("slide") steps out and slides back; a bus door ("fold" front: two leaves swing
 *                  out; "slide" middle: plugs out and slides back). A car door is cut out of the merged body only
 *                  while it is open (t > 0) and merged back at t = 0, so parked cars stay a few draw calls.
 *                  Car doors: [front right, front left, rear right, rear left].
 *   v.rig.seats    [{ pos: Vector3 (local; the seated figure's origin, as vehicle-meshes.js SEAT), heading (local
 *                  radians, 0 = facing +z), kind: "driver" | "front" | "rear" | "bus" }]; bus seats show through
 *                  the windows.
 *   v.rig.lights   { setBrake(on), setHead(on), setIndicator("L" | "R" | "both" | null, t), setReverse(on),
 *                  setRunning(on), state() }: emissive levels in the vehicle's own trim material (uniforms), no
 *                  THREE.Light. setIndicator's t is a clock in seconds (blinks at ~1.4 Hz; omit t = steady on).
 *                  Head lamps also light the tail lamps (dim) and a taxi's roof sign. While v.rig.auto is true
 *                  (default) F.Vehicles.animate sets brake (slowing, or stopped with somebody aboard) and reverse
 *                  from the speed it is given; set v.rig.auto = false to drive them yourself.
 *   v.rig.exhaust  { pos: Vector3 (local tail-pipe tip), fuel: "petrol" | "diesel" | "electric" } or, for a
 *                  bicycle, null. Electric cars have no pipe (pos is null).
 *   v.rig.interior { wheel: the steering wheel Object3D (shown while occupied), seats: rig.seats.length, glass:
 *                  opacity of the tinted glass }: dash, seats and wheel are part of the trim mesh.
 *   v.rig.wheels(spin)  wheel roll angle (rad);   v.rig.steer(angle)  front wheels / fork yaw (rad, > 0 = left).
 *   Bicycles: v.rig.pedals(phase) crank angle (rad; the crank becomes its own mesh on first use).
 *   Scooters: v.rig.kickstand(down) centre stand down (parked) or up (riding); v.rig.stand is its state.
 *   Two-wheelers: v.rig.helmet { wear(figureGroup), remove(figureGroup) } puts a helmet on a cast figure's head
 *                  (F.VehicleRig.helmet), hiding its hair / cap piece until removed.
 *
 * BUSINESS CONTEXT: owner's realism pass (doors, lights that come on, exhaust, people inside), shared with the
 *   behaviour / sound workstream (js/game/*); features/kampung-quest-playability/notes-vehicles.md.
 * DEPENDENCIES: KQ.Figures.VehicleMats, KQ.Figures.Geo; THREE. Attached by vehicle-meshes.js.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const OPEN = (65 * Math.PI) / 180;
  const BLINK = 0.72;
  const ease = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.max(0, Math.min(1, Number(t) || 0));

  /* ------------------------------ lights ------------------------------ */

  /** The lamp levels from the light state, written to the trim material's two uniform vectors. */
  function applyLights(v, st) {
    const m = v.trimMat;
    if (!m) return;
    const a = m.userData.uLampA.value;
    const b = m.userData.uLampB.value;
    const on =
      st.indT === undefined || st.indT === null ? 1 : st.indT % BLINK < BLINK * 0.55 ? 1 : 0;
    const ind = (k) => (st.ind === k || st.ind === "both" ? on : 0);
    a.set(
      st.head ? 1 : 0,
      st.head ? 1 : st.running ? 0.75 : 0,
      Math.max(st.head ? 0.5 : 0, st.brake ? 0.7 : 0),
      st.brake ? 1 : 0,
    );
    b.set(ind("L"), ind("R"), st.reverse ? 1 : 0, st.sign);
  }

  /** The lights controller of a vehicle (see the header). */
  function lights(v) {
    const st = { head: false, brake: false, ind: null, indT: null, reverse: false, running: false };
    st.sign = v.kind === "bus" ? 1 : 0;
    const set = (k, on) => {
      st[k] = Boolean(on);
      if (k === "head" && v.style === "taxi") st.sign = st.head ? 1 : 0;
      applyLights(v, st);
    };
    const ctl = {
      setBrake: (on) => set("brake", on),
      setHead: (on) => set("head", on),
      setReverse: (on) => set("reverse", on),
      setRunning: (on) => set("running", on),
      setIndicator(side, t) {
        st.ind = side === "L" || side === "R" || side === "both" ? side : null;
        st.indT = t === undefined ? null : t;
        applyLights(v, st);
      },
      state: () => Object.assign({ levels: levels(v) }, st),
    };
    applyLights(v, st);
    return ctl;
  }

  /** The eight lamp levels now (head, drl, tail, brake, indicator L, indicator R, reverse, sign). */
  function levels(v) {
    if (!v.trimMat) return [];
    return v.trimMat.userData.uLampA.value
      .toArray()
      .concat(v.trimMat.userData.uLampB.value.toArray());
  }

  /* ------------------------------ car doors ------------------------------ */

  /** Swap a car's merged layers for the variant without the doors / parts in v.mask. */
  function remerge(v) {
    const set = v.geoSet;
    v.layers.forEach(function (m) {
      const g = set.variant(m.name === "body" ? "paint" : m.name, v.mask);
      if (g) m.geometry = g;
    });
  }

  /** Cut door k out of the body: its paint / trim / glass become meshes on its pivot. */
  function split(v, d, k) {
    const g = v.geoSet.door(k);
    const mats = { paint: v.paintMat, trim: v.trimMat, glass: F.VehicleMats.glass() };
    Object.keys(mats).forEach(function (layer) {
      if (!g[layer]) return;
      const m = new THREE.Mesh(g[layer], mats[layer]);
      m.name = "door-" + layer;
      m.castShadow = layer === "paint";
      d.pivot.add(m);
    });
    v.mask |= 1 << k;
    remerge(v);
    d.split = true;
  }

  /** Put door k back into the merged body (when shut). */
  function merge(v, d, k) {
    while (d.pivot.children.length) d.pivot.remove(d.pivot.children[0]);
    v.mask &= ~(1 << k);
    remerge(v);
    d.split = false;
  }

  /** Move a door to t (0..1) by its kind: a hinge swings, a slide steps out and runs back. */
  function pose(d, t) {
    const e = ease(t);
    if (d.kind === "slide") {
      d.pivot.position.set(
        d.hinge[0] + d.sx * 0.09 * Math.min(1, t * 4),
        d.hinge[1],
        d.hinge[2] - 0.78 * e,
      );
      return;
    }
    d.pivot.rotation.y = -d.sx * OPEN * e;
  }

  /** A car door's controller. */
  function carDoor(v, info, k) {
    const pivot = new THREE.Group();
    pivot.name = "door-pivot";
    pivot.position.set(info.hinge[0], info.hinge[1], info.hinge[2]);
    v.group.add(pivot);
    const d = Object.assign({ pivot, t: 0, split: false }, info);
    d.open = function (t) {
      const x = clamp01(t);
      if (x > 0 && !d.split) split(v, d, k);
      d.t = x;
      pose(d, x);
      if (x === 0 && d.split) merge(v, d, k);
    };
    return d;
  }

  /** Show the animated steering wheel (and hide the parked copy) while somebody drives. */
  function occupy(v, on) {
    if (!v.geoSet || !v.steering) return;
    v.steering.visible = Boolean(on);
    v.mask = on ? v.mask | 16 : v.mask & ~16;
    remerge(v);
  }

  /* ------------------------------ helmets ------------------------------ */

  /** A full-face-ish open helmet: a shell, a dark visor and a chin strap (one mesh, cached per colour). */
  function helmetGeo(hex) {
    const key = "h" + hex;
    if (cache[key]) return cache[key];
    const P = F.VehicleParts;
    const shell = new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
    cache[key] = F.Geo.merge([
      P.tag(P.paint(shell, hex), 2),
      P.tag(P.lens(0.84, 0.32, 0.3, [0, 0.02, 0.36], "#1a2430", [0.15, 0, 0], 14), 2),
      P.tag(
        P.paint(new THREE.TorusGeometry(0.47, 0.025, 4, 18, Math.PI).rotateZ(Math.PI), "#202226"),
        0,
      ),
    ]);
    return cache[key];
  }
  const cache = {};

  /** Fit a helmet to a cast figure's head (its head piece's box) and hide the hair / cap piece. */
  function wear(figure, mesh) {
    const rig = figure && figure.userData && figure.userData.rig;
    if (!rig || !rig.head) return false;
    const acc = rig.accessory;
    acc.geometry.computeBoundingBox();
    const box = acc.geometry.boundingBox;
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    mesh.scale.setScalar(Math.max(size.x, size.z) * 1.12);
    mesh.position.set(c.x, c.y - size.y * 0.12, c.z);
    rig.head.add(mesh);
    acc.visible = false;
    return true;
  }

  /** Take a helmet off a figure and show its head piece again. */
  function remove(figure, mesh) {
    const rig = figure && figure.userData && figure.userData.rig;
    if (mesh.parent) mesh.parent.remove(mesh);
    if (rig && rig.accessory) rig.accessory.visible = true;
  }

  /** A helmet controller for a rider (one helmet mesh per vehicle, made on first use). */
  function helmet(hex) {
    let mesh = null;
    const get = () => mesh || (mesh = new THREE.Mesh(helmetGeo(hex), F.VehicleMats.sharedTrim()));
    return {
      wear: (fig) => wear(fig, get()),
      remove: (fig) => mesh && remove(fig, mesh),
      mesh: () => mesh,
    };
  }

  /* ------------------------------ attach ------------------------------ */

  /** Seats as Vector3 records. */
  const seatList = (list) =>
    (list || []).map((s) => ({
      pos: new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]),
      heading: s.heading || 0,
      kind: s.kind,
    }));

  /** The parts every rig has. */
  function base(v, opts) {
    const e = opts.exhaust;
    v.rig = {
      auto: true,
      doors: [],
      seats: seatList(opts.seats),
      lights: lights(v),
      exhaust:
        e === undefined
          ? null
          : { pos: e ? new THREE.Vector3(e[0], e[1], e[2]) : null, fuel: opts.fuel },
      interior: {
        wheel: v.steering || null,
        seats: (opts.seats || []).length,
        glass: F.VehicleMats.glass().opacity,
      },
      wheels: (spin) => v.wheels.forEach((w) => (w.rotation.x = spin)),
      steer: (a) => v.pivots.forEach((p) => (p.rotation.y = a)),
    };
    return v.rig;
  }

  /** A car's rig: four doors (split on demand), seats, lights, exhaust, interior. */
  function car(v, set) {
    v.geoSet = set;
    v.mask = 0;
    const rig = base(v, { seats: set.seats, exhaust: set.exhaust, fuel: set.fuel });
    rig.doors = set.doors.map((info, k) => carDoor(v, info, k));
    return rig;
  }

  /** A rig whose doors are always their own meshes (bus, lorry): `doors` [{side, seat, pivot, kind, pose(t)}]. */
  function fixed(v, opts) {
    const rig = base(v, opts);
    rig.doors = (opts.doors || []).map(function (d) {
      const door = Object.assign({ t: 0 }, d);
      door.open = function (t) {
        door.t = clamp01(t);
        d.pose(ease(door.t));
      };
      return door;
    });
    return rig;
  }

  /** The automatic lights from the speed (brake when slowing or stopped with a driver, reverse going back). */
  function autoLights(v, dt, speed) {
    const rig = v.rig;
    if (!rig || rig.auto === false || !(dt > 0)) return;
    const was = v.lastSpeed === undefined ? speed : v.lastSpeed;
    v.lastSpeed = speed;
    const slowing = Math.abs(speed) < Math.abs(was) - dt * 0.8;
    v.brakeHold = slowing ? 0.35 : Math.max(0, (v.brakeHold || 0) - dt);
    const brake = v.brakeHold > 0 || (Math.abs(speed) < 0.05 && (v.occupied || v.kind === "bus"));
    const reverse = speed < -0.05;
    if (brake !== v.lastBrake) rig.lights.setBrake(brake);
    if (reverse !== v.lastReverse) rig.lights.setReverse(reverse);
    v.lastBrake = brake;
    v.lastReverse = reverse;
  }

  F.VehicleRig = {
    car,
    fixed,
    base,
    lights,
    occupy,
    helmet,
    wear,
    remove,
    autoLights,
    levels,
    OPEN,
  };
})((window.KQ = window.KQ || {}));
