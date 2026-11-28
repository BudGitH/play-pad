/* ============================================================================
 * FILE: mount-rigs.js
 * PURPOSE: Makes and poses the rideable animals' meshes (KQ.Game.MountRigs): a camel rig from
 *          KQ.Figures.CamelToy (the same toy camel the herd is instanced from, at full detail)
 *          and a horse / pony rig from KQ.Figures.HorseMesh, each one skinned mesh
 *          (KQ.Figures.AnimalRig: one draw call). Poses: standing (breathing, head sway, tail
 *          swish), the "say hi" reaction (the head turns to the hero and nods), and the stride
 *          from KQ.Sim.Mount.stance while it moves (legs, body bob, head nod).
 * BUSINESS CONTEXT: AC-P5..P7 (a ridden animal walks / trots with moving legs; greeting gives a
 *   little reaction). Toy style, matching the herd and the cast.
 * DEPENDENCIES: KQ.Figures.AnimalRig, CamelToy, HorseMesh, KQ.WorldParts.HolyCamels (coat
 *   tints), KQ.Sim.Mount. The rig keeps the lowest foot on the ground (AnimalRig.groundDrop).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const F = () => KQ.Figures;
  const W = () => KQ.WorldParts;
  const PONY_SCALE = 0.78;
  /** Where the hero's toy head looks from (the reaction turns the animal's head toward him). */
  const mats = {};

  /** The material for a kind, made once (vertex-coloured toy plastic with a soft sheen). */
  function material(kind) {
    if (!mats[kind])
      mats[kind] = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: kind === "camel" ? 0.9 : 0.72,
        envMapIntensity: 0.4,
      });
    return mats[kind];
  }

  /** Build the rig for a mount definition {kind, coat}: { mesh, bones, kind, scale, seat }. */
  function build(def) {
    const camel = def.kind === "camel";
    const tint = camel ? W().HolyCamels.COATS[def.coat] : 0;
    const spec = camel ? F().CamelToy.spec(tint) : F().HorseMesh.spec(def.coat, def.kind);
    const rig = F().AnimalRig.build(spec, material(def.kind));
    rig.kind = def.kind;
    rig.scale = def.kind === "pony" ? PONY_SCALE : 1;
    rig.mesh.scale.setScalar(rig.scale);
    rig.mesh.name = "mount:" + def.id;
    rig.mesh.castShadow = true;
    return rig;
  }

  /** Standing still: slow breathing, a wandering head, an idle tail swish. */
  function idlePose(a, t) {
    const ph = t + a.seed;
    const camel = a.kind === "camel";
    return {
      y: 0.006 * Math.sin(ph * 1.6),
      pitch: 0,
      roll: 0,
      neckP: (camel ? 0.12 : 0.05) + 0.05 * Math.sin(ph * 0.7),
      neckY: 0.28 * Math.sin(ph * 0.31),
      headP: 0.05 * Math.sin(ph * 0.5),
      tail: 0.3 * Math.sin(ph * 2.1),
      legs: F().AnimalRig.LEGS.map(() => ({ hip: 0, knee: 0 })),
    };
  }

  /** The greeting: the head turns toward the hero and nods twice; `hi` counts down from 1.6 s. */
  function hiPose(p, a) {
    const k = Math.min(1, a.hi / 0.3, (1.6 - a.hi) / 0.3 + 0.2);
    const nod = Math.sin((1.6 - a.hi) * 9) * 0.25;
    p.neckY += (a.hiYaw - p.neckY) * k;
    p.neckP += nod * k;
    p.headP = (p.headP || 0) - nod * 0.6 * k;
    p.tail = 0.6 * Math.sin(a.hi * 14);
    return p;
  }

  /** Moving: the gait's legs from the sim, a bob, a nod of the head with each stride. */
  function stridePose(a) {
    const st = KQ.Sim.Mount.stance(a.sim);
    const camel = a.kind === "camel";
    return {
      y: 0, // AnimalRig.pose keeps the lowest foot on the ground: the body rises and falls with the legs
      pitch: st.nod * 0.12,
      roll: camel ? 0.04 * Math.sin(a.sim.phase * Math.PI * 2) : 0,
      neckP: (camel ? 0.18 : 0.1) + st.nod,
      neckY: 0,
      headP: -st.nod * 0.5,
      tail: 0.15 * Math.sin(a.sim.phase * Math.PI * 4),
      tailP: camel ? 0 : -0.25 * Math.min(1, a.sim.speed / 6),
      legs: st.legs,
    };
  }

  /** Pose an animal for this frame and put its mesh where its sim state is. */
  function pose(a, t) {
    const moving = a.sim.speed > 0.15;
    let p = moving ? stridePose(a) : idlePose(a, t);
    if (a.hi > 0 && !moving) p = hiPose(p, a);
    a.bob = F().AnimalRig.pose(a.rig, p) * a.rig.scale;
    const g = a.rig.mesh;
    g.position.set(a.sim.x, a.y, a.sim.z);
    g.rotation.y = a.sim.heading;
  }

  /** The hero's hips in the world for a ridden animal (seat point, raised by the stride bob). */
  function seatOf(a) {
    const s = a.rig.seat;
    const k = a.rig.scale;
    const h = a.sim.heading;
    return {
      x: a.sim.x + Math.sin(h) * s.z * k,
      y: a.y + s.y * k + a.bob,
      z: a.sim.z + Math.cos(h) * s.z * k,
    };
  }

  G.MountRigs = { build, pose, seatOf, PONY_SCALE };
})((window.KQ = window.KQ || {}));
