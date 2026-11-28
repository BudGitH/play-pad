/* ============================================================================
 * FILE: mount-rigs.js
 * PURPOSE: Makes and poses the rideable animals' meshes (KQ.Game.MountRigs): a camel rig built
 *          from the herd's own part geometry (holy-camel-mesh.js, so a ridden camel looks like
 *          the others) and a horse / pony rig from KQ.Figures.HorseMesh, each one skinned mesh
 *          (KQ.Figures.AnimalRig: one draw call). Poses: standing (breathing, head sway, tail
 *          swish), the "say hi" reaction (the head turns to the hero and nods), and the stride
 *          from KQ.Sim.Mount.stance while it moves (legs, body bob, head nod).
 * BUSINESS CONTEXT: AC-P5..P7 (a ridden animal walks / trots with moving legs; greeting gives a
 *   little reaction). Toy style, matching the herd and the cast.
 * DEPENDENCIES: KQ.Figures.AnimalRig, KQ.Figures.HorseMesh, KQ.WorldParts.CamelMesh / HolyCamels
 *   (fur material, coats), KQ.Sim.Mount.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const F = () => KQ.Figures;
  const W = () => KQ.WorldParts;
  /** The rider's hip point on each kind (model space, before the rig's scale). */
  const CAMEL_SEAT = { y: 2.16, z: 0.46 };
  const PONY_SCALE = 0.78;
  /** Where the hero's toy head looks from (the reaction turns the animal's head toward him). */
  const mats = {};

  /** The camel's bone pivots from the herd's mesh (knees 0.56 m under the hips). */
  function camelPivots() {
    const pv = W().CamelMesh.PIVOT;
    return {
      body: [0, 1.2, 0],
      neck: pv.neck,
      tail: pv.tail,
      hips: pv.hips,
      knees: pv.hips.map((h) => [h[0], h[1] - 0.56, h[2] + 0.04]),
    };
  }

  /** A camel as an AnimalRig spec: the herd's body, saddle, neck + head, tail and legs, in model space. */
  function camelSpec() {
    const parts = W().CamelMesh.parts();
    const pv = camelPivots();
    const at = (g, p) => g.clone().translate(p[0], p[1], p[2]);
    const list = [
      { geo: parts.body.clone(), bone: "body" },
      { geo: parts.saddle.clone(), bone: "body" },
      { geo: at(parts.neck, pv.neck), bone: "neck" },
      { geo: at(parts.tail, pv.tail), bone: "tail" },
    ];
    F().AnimalRig.LEGS.forEach(function (k, i) {
      const split = { y: pv.knees[i][1] + 0.02, bone: "knee" + k };
      list.push({ geo: at(parts.leg, pv.hips[i]), bone: "hip" + k, split });
    });
    return { bones: F().AnimalRig.quadBones(pv), parts: list };
  }

  /** The material for a kind and coat, made once (camels share the herd's fur look, tinted). */
  function material(kind, coat) {
    const key = kind + ":" + coat;
    if (mats[key]) return mats[key];
    if (kind === "camel") {
      const m = W().HolyCamels.furMaterial();
      m.color.setHex(W().HolyCamels.COATS[coat] || 0xffffff);
      mats[key] = m;
    } else {
      mats[key] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
    }
    return mats[key];
  }

  /** Build the rig for a mount definition {kind, coat}: { mesh, bones, kind, scale, seat }. */
  function build(def) {
    const camel = def.kind === "camel";
    const spec = camel ? camelSpec() : F().HorseMesh.spec(def.coat);
    const rig = F().AnimalRig.build(spec, material(def.kind, def.coat));
    rig.kind = def.kind;
    rig.scale = def.kind === "pony" ? PONY_SCALE : 1;
    rig.mesh.scale.setScalar(rig.scale);
    rig.seat = camel ? CAMEL_SEAT : F().HorseMesh.SEAT;
    rig.mesh.name = "mount:" + def.id;
    rig.mesh.castShadow = true;
    return rig;
  }

  /** Standing still: slow breathing, a wandering head, an idle tail swish. */
  function idlePose(a, t) {
    const ph = t + a.seed;
    const camel = a.kind === "camel";
    return {
      y: 0.01 * Math.sin(ph * 1.6),
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
      y: st.bob,
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
    F().AnimalRig.pose(a.rig, p);
    a.bob = p.y * a.rig.scale;
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
