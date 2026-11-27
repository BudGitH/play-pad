/* ============================================================================
 * FILE: holy-camel-herd.js
 * PURPOSE: The living part of the camels (KQ.WorldParts.CamelHerd): instanced meshes for the whole
 *          herd and its handlers, the poses (stand with breathing, head sway and a tail swish;
 *          rest kneeling; graze with the head down; walk a pacing gait round the caravan track)
 *          and one collider box per animal (walkers move theirs each frame).
 * BUSINESS CONTEXT: owner feedback "show camels in the Makkah region" with a simple idle / walk
 *   animation, a few near the outskirts, hero cannot walk through them, draw calls kept low.
 * DEPENDENCIES: holy-camel-mesh.js (parts, pivots), holy-camels.js (HERD, HANDLERS, track), geo.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const NEAR = 300;
  const WALK_SPEED = 0.95;
  const m4 = () => new THREE.Matrix4();
  const T = { root: m4(), body: m4(), part: m4(), rot: m4(), pos: m4(), scl: m4(), tmp: m4() };
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const V = new THREE.Vector3();
  const ONE = new THREE.Vector3(1, 1, 1);

  /** Set `out` to translate(p) * rotation(euler yaw/pitch/roll order YXZ) * scale(s). */
  function place(out, p, rot, s) {
    E.set(rot[0] || 0, rot[1] || 0, rot[2] || 0, "YXZ");
    Q.setFromEuler(E);
    return out.compose(V.set(p[0], p[1], p[2]), Q, s ? new THREE.Vector3(s[0], s[1], s[2]) : ONE);
  }

  /** The four leg poses of a pacing gait at phase `ph` (same-side legs move together). */
  function walkLegs(ph) {
    const a = 0.46;
    const leg = (p) => ({ ang: -a * Math.sin(p), lift: Math.max(0, Math.cos(p)) * 0.14, sy: 1 });
    return [leg(ph), leg(ph + Math.PI), leg(ph), leg(ph + Math.PI)];
  }

  /** Pose of one camel at time t: body offset / tilt, neck pitch / yaw, tail swing, four legs. */
  function pose(c, t) {
    const ph = c.phase + t;
    const base = {
      y: 0,
      pitch: 0,
      roll: 0,
      neckP: 0.12 + 0.05 * Math.sin(ph * 0.7),
      neckY: 0.3 * Math.sin(ph * 0.31),
      tail: 0.35 * Math.sin(ph * 2.1),
      legs: [0, 1, 2, 3].map(() => ({ ang: 0, lift: 0, sy: 1 })),
    };
    if (c.def.mode === "rest") return Object.assign(base, rest(ph));
    if (c.def.mode === "graze")
      return Object.assign(base, {
        neckP: 1.55 + 0.08 * Math.sin(ph * 1.6),
        neckY: 0.15 * Math.sin(ph * 0.4),
      });
    if (c.def.mode === "walk") return Object.assign(base, walk(c));
    base.y = 0.012 * Math.sin(ph * 1.6);
    return base;
  }

  /** Kneeling: body low, legs folded back under, head up, chewing. */
  function rest(ph) {
    const fold = { ang: 1.38, lift: 0, sy: 0.6 };
    return {
      y: -0.7 + 0.008 * Math.sin(ph * 1.5),
      legs: [fold, fold, fold, fold],
      neckP: -0.05 + 0.04 * Math.sin(ph * 0.9),
      neckY: 0.5 * Math.sin(ph * 0.22),
    };
  }

  /** Walking: pacing legs, a rolling body, the head nodding with each stride. */
  function walk(c) {
    const ph = c.gait;
    return {
      y: 0.03 * Math.abs(Math.sin(ph)),
      roll: 0.035 * Math.sin(ph),
      pitch: 0.02 * Math.sin(ph * 2),
      neckP: 0.18 + 0.1 * Math.sin(ph * 2 + 0.6),
      neckY: 0,
      legs: walkLegs(ph),
    };
  }

  /** Body-level matrix: root (position, yaw) then the body tilt about its centre. */
  function bodyMatrix(c, p) {
    place(T.root, [c.x, p.y, c.z], [0, c.yaw, 0]);
    place(T.pos, [0, 1.2, 0], [0, 0, 0]);
    place(T.rot, [0, 0, 0], [p.pitch, 0, p.roll]);
    place(T.scl, [0, -1.2, 0], [0, 0, 0]);
    return T.body.copy(T.root).multiply(T.pos).multiply(T.rot).multiply(T.scl);
  }

  /** Write `body * translate(pivot) * rotation(rot) * scale(s)` into instance `i` of `mesh`. */
  function put(mesh, i, pivot, rot, s) {
    place(T.part, pivot, rot, s);
    T.tmp.copy(T.body).multiply(T.part);
    mesh.setMatrixAt(i, T.tmp);
  }

  /** Update every instance matrix of camel `ci` for pose `p`. */
  function write(h, ci, c, p) {
    const piv = P.CamelMesh.PIVOT;
    const body = bodyMatrix(c, p);
    h.body.setMatrixAt(ci, body);
    put(h.neck, ci, piv.neck, [p.neckP, p.neckY, 0]);
    put(h.tail, ci, piv.tail, [0, 0, p.tail]);
    piv.hips.forEach((hip, k) => {
      const l = p.legs[k];
      put(h.legs, ci * 4 + k, [hip[0], hip[1] + l.lift, hip[2]], [l.ang, 0, 0], [1, l.sy, 1]);
    });
    if (c.saddleIx >= 0) h.saddle.setMatrixAt(c.saddleIx, body);
  }

  /** Where a walker is on the track and which way it faces (s = angle round the ellipse). */
  function track(s) {
    const k = P.HolyCamels.CARAVAN;
    const dx = -k.rx * Math.sin(s);
    const dz = k.rz * Math.cos(s);
    return { x: k.cx + k.rx * Math.cos(s), z: k.cz + k.rz * Math.sin(s), yaw: Math.atan2(dx, dz) };
  }

  /** Put a walking animal at `s + lap` on the caravan track. */
  function follow(c, s) {
    const t = track(s + c.def.lap);
    c.x = t.x;
    c.z = t.z;
    c.yaw = t.yaw;
  }

  /** Keep a collider box on its animal: a tight rectangle when it is axis-aligned, else a square. */
  function fitCollider(c) {
    const sin = Math.abs(Math.sin(c.yaw));
    const along = sin > 0.8 ? [1.35, 0.55] : sin < 0.2 ? [0.55, 1.35] : [0.95, 0.95];
    const k = c.collider;
    k.minX = c.x - along[0];
    k.maxX = c.x + along[0];
    k.minZ = c.z - along[1];
    k.maxZ = c.z + along[1];
  }

  /** A fresh collider box (filled by the first refresh). */
  const box = (kind) => ({ minX: 0, maxX: 0, minZ: 0, maxZ: 0, kind });

  /** The animals of the herd with their phases, saddles and colliders. */
  function makeAnimals() {
    const list = P.HolyCamels.HERD.map((def, i) => ({
      def,
      x: def.x || 0,
      z: def.z || 0,
      yaw: def.yaw || 0,
      phase: i * 1.7,
      gait: i * 0.9,
      saddleIx: -1,
      collider: box("camel"),
    }));
    list.filter((a) => a.def.saddle).forEach((a, k) => (a.saddleIx = k));
    return list;
  }

  /** The instanced meshes (one per part type), coloured by each animal's coat. */
  function makeMeshes(animals, handlers) {
    const parts = P.CamelMesh.parts();
    const mat = P.HolyCamels.furMaterial();
    const coat = (i) => P.HolyCamels.COATS[animals[Math.floor(i) % animals.length].def.coat];
    const saddled = animals.filter((a) => a.def.saddle);
    const inst = (geo, n, tint) =>
      P.instanced(
        geo,
        mat,
        Array.from({ length: n }, (_, i) => ({ x: 0, y: 0, z: 0, color: tint(i) })),
      );
    const meshes = {
      body: inst(parts.body, animals.length, coat),
      neck: inst(parts.neck, animals.length, coat),
      tail: inst(parts.tail, animals.length, coat),
      legs: inst(parts.leg, animals.length * 4, (i) => coat(i / 4)),
      saddle: inst(parts.saddle, Math.max(1, saddled.length), (i) =>
        saddled[i] ? saddled[i].def.saddle : 0xffffff,
      ),
      hand: inst(parts.handler, handlers.length, () => 0xffffff),
    };
    meshes.saddle.count = saddled.length;
    return meshes;
  }

  const MESH_NAMES = ["body", "neck", "tail", "legs", "saddle", "hand"];

  /** Create the instanced meshes and the animals. Returns the herd object used by update(). */
  function create(group, colliders) {
    const animals = makeAnimals();
    const handlers = P.HolyCamels.HANDLERS.map((def, i) => ({
      def,
      x: def.x || 0,
      z: def.z || 0,
      yaw: def.yaw || 0,
      gait: i,
      collider: box("handler"),
    }));
    const h = Object.assign(
      { animals, handlers, lead: { s: 0 }, time: 0 },
      makeMeshes(animals, handlers),
    );
    MESH_NAMES.forEach((k) => {
      h[k].name = "camel:" + k;
      h[k].frustumCulled = false;
      group.add(h[k]);
    });
    animals.concat(handlers).forEach((a) => colliders.push(a.collider));
    refresh(h, 0);
    return h;
  }

  /** Pose one handler: placed, bobbing when walking, with a small collider. */
  function poseHandler(h, a, i, dt) {
    if (a.def.mode === "walk") {
      follow(a, h.lead.s);
      a.gait += dt * Math.PI * WALK_SPEED;
    }
    const bob = a.def.mode === "walk" ? 0.03 * Math.abs(Math.sin(a.gait)) : 0;
    place(T.tmp, [a.x, bob, a.z], [0, a.yaw, 0]);
    h.hand.setMatrixAt(i, T.tmp);
    Object.assign(a.collider, {
      minX: a.x - 0.4,
      maxX: a.x + 0.4,
      minZ: a.z - 0.4,
      maxZ: a.z + 0.4,
    });
  }

  /** Pose every animal (also fits colliders); used at build and by update(). */
  function refresh(h, dt) {
    h.time += dt;
    h.lead.s += (WALK_SPEED / ((P.HolyCamels.CARAVAN.rx + P.HolyCamels.CARAVAN.rz) / 2)) * dt;
    h.animals.forEach((c, i) => {
      if (c.def.mode === "walk") {
        follow(c, h.lead.s);
        c.gait += dt * Math.PI * WALK_SPEED;
      }
      write(h, i, c, pose(c, h.time));
      fitCollider(c);
    });
    h.handlers.forEach((a, i) => poseHandler(h, a, i, dt));
    MESH_NAMES.forEach((k) => (h[k].instanceMatrix.needsUpdate = true));
  }

  /** Is the hero within NEAR metres of the herd's area? */
  function near(hero) {
    if (!hero) return true;
    return P.HolyCamels.AREAS.some(
      (a) =>
        hero.x > a[0] - NEAR &&
        hero.x < a[2] + NEAR &&
        hero.z > a[1] - NEAR &&
        hero.z < a[3] + NEAR,
    );
  }

  /** Per-frame: animate when the hero is anywhere near. */
  function update(h, dt, hero) {
    if (near(hero)) refresh(h, Math.min(dt, 0.1));
  }

  /** Shadows only above the low tier (the herd is small, but each caster adds a shadow draw call). */
  function setTier(h, tier) {
    MESH_NAMES.forEach((k) => (h[k].castShadow = tier !== "low"));
  }

  /** Plain description for tests: animal modes and positions. */
  function describe(h) {
    return {
      camels: h.animals.length,
      handlers: h.handlers.length,
      meshes: 6,
      animals: h.animals.map((a) => ({ mode: a.def.mode, x: +a.x.toFixed(1), z: +a.z.toFixed(1) })),
    };
  }

  P.CamelHerd = { create, refresh, update, setTier, describe, track, NEAR };
})((window.KQ = window.KQ || {}));
