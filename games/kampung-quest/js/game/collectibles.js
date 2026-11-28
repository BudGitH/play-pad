/* ============================================================================
 * FILE: collectibles.js
 * PURPOSE: The few things the world builders do not provide but the missions need: cans in the
 *          park, litter at the playground, and Mimi the cat. Small original meshes, placed on
 *          clear ground, shown only while a mission step asks for them.
 * BUSINESS CONTEXT: AC-11 (collect / deliver missions: "recycle 5 cans" style tasks, "clean the
 *   playground", "find a lost cat"), business rule 1 (child-friendly: a cat that follows you).
 * DEPENDENCIES: THREE, collide.js (clear spots), util.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const CAN_SPOTS = [
    [38.5, 24],
    [45, 26.5],
    [52.5, 23.5],
    [41, 29.5],
  ];
  const LITTER_SPOTS = [
    [15.5, 18],
    [19, 24.5],
    [25, 17.5],
    [14.8, 26],
    [24, 22],
  ];

  const RAMBUTAN_SPOTS = [
    [36.5, 21],
    [47.5, 22],
    [54, 26.5],
    [39.5, 31.5],
    [46.5, 31],
    [34.5, 27.5],
  ];

  /** A rambutan: a small red fuzzy ball with a green stem (its "hair" is a few tiny cones). */
  function rambutanMesh(i) {
    const g = new THREE.Group();
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 9),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd7263d : 0xe8413a, roughness: 0.7 }),
    );
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 7, 5),
      new THREE.MeshStandardMaterial({ color: 0x8fd14f, roughness: 0.9, wireframe: true }),
    );
    fruit.position.y = hair.position.y = 0.08;
    g.add(fruit, hair);
    return g;
  }

  /** A small drink can lying on its side (silver body, red band). */
  function canMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.19, 14),
      new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.6, roughness: 0.35 }),
    );
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0765, 0.0765, 0.07, 14),
      new THREE.MeshStandardMaterial({ color: 0xd7232c, roughness: 0.5 }),
    );
    body.position.y = band.position.y = 0.095;
    g.add(body, band);
    g.rotation.z = 1.3;
    g.position.y = 0.07;
    const wrap = new THREE.Group();
    wrap.add(g);
    return wrap;
  }

  /** A bit of litter: a flat coloured box, colour and turn chosen from its index. */
  function litterMesh(i) {
    const colours = [0xff4f8b, 0xffc83d, 0x44b3ff, 0x8be36a, 0xff8a3d];
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.05, 0.28),
      new THREE.MeshStandardMaterial({ color: colours[i % colours.length], roughness: 0.6 }),
    );
    m.rotation.y = i * 1.3;
    m.position.y = 0.03;
    const wrap = new THREE.Group();
    wrap.add(m);
    return wrap;
  }

  /**
   * Mimi the cat: an orange body, head, ears and tail built from primitives (the tail is kept in
   * userData to swish).
   */
  function catMesh() {
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0xe8963c, roughness: 0.8 });
    const part = (geo, x, y, z) => {
      const m = new THREE.Mesh(geo, fur);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    part(new THREE.SphereGeometry(0.17, 14, 10), 0, 0.2, 0).scale.set(1, 0.8, 1.5);
    part(new THREE.SphereGeometry(0.12, 14, 10), 0, 0.34, 0.24);
    part(new THREE.ConeGeometry(0.045, 0.1, 6), -0.07, 0.46, 0.24);
    part(new THREE.ConeGeometry(0.045, 0.1, 6), 0.07, 0.46, 0.24);
    const tail = part(new THREE.CylinderGeometry(0.025, 0.035, 0.34, 8), 0, 0.32, -0.28);
    tail.rotation.x = -0.9;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1008 });
    [-0.045, 0.045].forEach((x) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeMat);
      e.position.set(x, 0.355, 0.35);
      g.add(e);
    });
    g.userData.tail = tail;
    return g;
  }

  /**
   * Place one hidden mesh per spot on the nearest clear ground and return the list of collectible
   * records.
   */
  function spawn(scene, world, spots, make, kind) {
    return spots.map(function (s, i) {
      const spot = G.Collide.freeSpot(world.colliders, s[0], s[1], 0.5);
      const mesh = make(i);
      mesh.position.set(spot.x, world.heightAt(spot.x, spot.z), spot.z);
      mesh.visible = false;
      scene.add(mesh);
      return { id: kind + "_" + i, kind, mesh, x: spot.x, z: spot.z, taken: false };
    });
  }

  /**
   * Build the collectibles set (cans in the park, litter at the playground, Mimi) in the scene, all
   * hidden.
   */
  function create(scene, world) {
    const holy = KQ.region === "haramain"; // no cans, litter or Mimi in Makkah and Madinah
    const C = {
      world,
      cans: holy ? [] : spawn(scene, world, CAN_SPOTS, canMesh, "can"),
      litter: holy ? [] : spawn(scene, world, LITTER_SPOTS, litterMesh, "litter"),
      rambutans: holy ? [] : spawn(scene, world, RAMBUTAN_SPOTS, rambutanMesh, "rambutan"),
      cat: catMesh(),
      catFollow: false,
    };
    C.cat.visible = false;
    scene.add(C.cat);
    return C;
  }

  /** Show only what the active mission step needs. `prog` = missions.progress() or null. */
  function sync(C, prog, paused) {
    const want = prog && prog.type === "collect" && !paused ? prog.target : null;
    const item = prog ? prog.item : null;
    C.cans.forEach((c) => (c.mesh.visible = !c.taken && want === "park" && item !== "rambutan"));
    C.litter.forEach((c) => (c.mesh.visible = !c.taken && want === "playground"));
    C.rambutans.forEach(
      (c) => (c.mesh.visible = !c.taken && want === "park" && item === "rambutan"),
    );
    const catOut = Boolean(prog && prog.id === "lost_cat" && prog.stepIndex >= 2);
    C.catFollow = catOut;
    C.cat.visible = catOut;
  }

  /** Items the hero can pick up right now (visible and not yet taken). */
  function available(C) {
    return C.cans.concat(C.litter, C.rambutans).filter((c) => c.mesh.visible && !c.taken);
  }

  /** Mark a collectible as picked up and hide it. */
  function take(C, item) {
    item.taken = true;
    item.mesh.visible = false;
  }

  /** Make every can and litter piece collectable again (a new day). */
  function resetAll(C) {
    C.cans.concat(C.litter, C.rambutans).forEach((c) => (c.taken = false));
  }

  /** Mimi trots behind the hero; her tail swishes. */
  function updateCat(C, dt, hero, t) {
    if (!C.catFollow) return;
    const dx = hero.pos.x - C.cat.position.x;
    const dz = hero.pos.z - C.cat.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.3) {
      const s = Math.min(d - 1.3, 3.2 * dt);
      const nx = C.cat.position.x + (dx / d) * s;
      const nz = C.cat.position.z + (dz / d) * s;
      const free = G.Collide.freeSpot(C.world.colliders, nx, nz, 0.25);
      C.cat.position.x = free.x;
      C.cat.position.z = free.z;
      C.cat.rotation.y = U.dampAngle(C.cat.rotation.y, Math.atan2(dx, dz), 10, dt);
    }
    C.cat.position.y = C.world.heightAt(C.cat.position.x, C.cat.position.z);
    C.cat.userData.tail.rotation.z = Math.sin(t * 5) * 0.4;
  }

  G.Collectibles = { catMesh, create, sync, available, take, resetAll, updateCat };
})((window.KQ = window.KQ || {}));
