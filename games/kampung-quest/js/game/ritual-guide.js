/* ============================================================================
 * FILE: ritual-guide.js
 * PURPOSE: The dotted guide on the ground while a tawaf or sa'i step is active: a ring of dots round
 *          the Kaaba (anticlockwise) with a gold start line at the Black Stone, or a dotted lane
 *          between Safa and Marwa with a gold line at each hill. The next few dots ahead of the hero
 *          glow amber and a small arrow stands on the first of them, pointing the way. Removed (and
 *          its geometry freed) the moment the step ends.
 * BUSINESS CONTEXT: owner feedback, Makkah rites: "show the user guidance on how they should do the
 *   tawaf: dotted lines when the task is active". Guidance only: nothing here counts or blocks.
 * PERFORMANCE: about 4 draw calls (one InstancedMesh of dots, one mesh per line, one arrow), no
 *   lights, no per-frame allocation beyond a re-colour when the glowing dots change.
 * DEPENDENCIES: THREE, KQ.Sim.RitualWalk (pure geometry), G.Settings.reduced (optional).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const RW = () => KQ.Sim.RitualWalk;
  const LIFT = 0.07;
  const COLOR = { dot: 0x00897b, lit: 0xffa000, line: 0xff8f00 };
  const DUMMY = new THREE.Object3D();
  const TINT = new THREE.Color();
  const V = { guide: null, group: null, dots: null, arrow: null, geo: null, lit: "", time: 0 };

  /** An unlit, fog-free material that sits on the ground without flicker against the marble. */
  function groundMaterial(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }

  /** The instanced dots, all in the base colour at rest. */
  function makeDots(guide, heightAt) {
    const geo = new THREE.CircleGeometry(0.26, 14).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, groundMaterial(0xffffff, 0.92), guide.dots.length);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    guide.dots.forEach((d, i) => {
      DUMMY.position.set(d.x, heightAt(d.x, d.z) + LIFT, d.z);
      DUMMY.rotation.set(0, 0, 0);
      DUMMY.scale.set(1, 1, 1);
      DUMMY.updateMatrix();
      mesh.setMatrixAt(i, DUMMY.matrix);
      mesh.setColorAt(i, TINT.setHex(COLOR.dot));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  /** One gold line lying on the ground between two points. */
  function makeLine(l, heightAt) {
    const len = Math.hypot(l.x2 - l.x1, l.z2 - l.z1);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 0.55).rotateX(-Math.PI / 2),
      groundMaterial(COLOR.line, 0.95),
    );
    const x = (l.x1 + l.x2) / 2;
    const z = (l.z1 + l.z2) / 2;
    mesh.position.set(x, heightAt(x, z) + LIFT, z);
    mesh.rotation.y = Math.atan2(-(l.z2 - l.z1), l.x2 - l.x1);
    mesh.renderOrder = 2;
    return mesh;
  }

  /** A chevron lying flat, pointing along +z (turned to a heading by rotation.y). */
  function makeArrow() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.1);
    shape.lineTo(0.8, -0.1);
    shape.lineTo(0.3, -0.1);
    shape.lineTo(0, 0.45);
    shape.lineTo(-0.3, -0.1);
    shape.lineTo(-0.8, -0.1);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, groundMaterial(COLOR.lit, 0.98));
    mesh.renderOrder = 4;
    mesh.visible = false;
    return mesh;
  }

  /** Build the guide meshes for `guide` (from KQ.Sim.RitualWalk) into one group in the scene. */
  function build(guide) {
    const s = G.S;
    const group = new THREE.Group();
    const dots = makeDots(guide, s.world.heightAt);
    const arrow = makeArrow();
    group.add(dots, arrow);
    guide.lines.forEach((l) => group.add(makeLine(l, s.world.heightAt)));
    s.scene.add(group);
    Object.assign(V, { guide, group, dots, arrow, lit: "", time: 0 });
  }

  /** Show the guide for a rite ("tawaf" | "sai") from its geometry; replaces any guide already up. */
  function show(kind, geom) {
    hide();
    if (!G.S || !G.S.scene || !G.S.world || !geom) return false;
    build(kind === "tawaf" ? RW().tawafGuide(geom) : RW().saiGuide(geom));
    V.kind = kind;
    return true;
  }

  /** Remove the guide and free its geometry and materials. */
  function hide() {
    if (!V.group) return;
    V.group.parent.remove(V.group);
    V.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    Object.assign(V, { guide: null, group: null, dots: null, arrow: null, lit: "", kind: null });
  }

  /** Re-colour and enlarge the glowing dots (only when the set changes). */
  function paint(lit) {
    const key = lit.join(",");
    if (key === V.lit) return;
    V.lit = key;
    const on = new Set(lit);
    V.guide.dots.forEach((d, i) => {
      const s = on.has(i) ? 1.7 : 1;
      DUMMY.position.set(d.x, G.S.world.heightAt(d.x, d.z) + LIFT, d.z);
      DUMMY.scale.set(s, 1, s);
      DUMMY.updateMatrix();
      V.dots.setMatrixAt(i, DUMMY.matrix);
      V.dots.setColorAt(i, TINT.setHex(on.has(i) ? COLOR.lit : COLOR.dot));
    });
    V.dots.instanceMatrix.needsUpdate = true;
    V.dots.instanceColor.needsUpdate = true;
  }

  /** Stand the arrow on its dot (bobbing gently unless motion is reduced), or hide it. */
  function placeArrow(a, dt) {
    V.time += dt;
    V.arrow.visible = Boolean(a);
    if (!a) return;
    const still = G.Settings && G.Settings.reduced && G.Settings.reduced();
    const lift = LIFT + 0.04 + (still ? 0 : Math.abs(Math.sin(V.time * 3)) * 0.08);
    V.arrow.position.set(a.x, G.S.world.heightAt(a.x, a.z) + lift, a.z);
    V.arrow.rotation.y = a.heading;
  }

  /**
   * Per frame: s = { x, z, armed, want } (the hero and the counting state). Lights the dots ahead
   * and moves the arrow; does nothing when no guide is up.
   */
  function update(dt, s) {
    if (!V.guide) return;
    const st = RW().guideState(V.guide, s);
    paint(st.lit);
    placeArrow(st.arrow, dt);
  }

  /** A plain description for tests. */
  function debug() {
    return {
      visible: Boolean(V.group),
      kind: V.kind || null,
      dots: V.guide ? V.guide.dots.length : 0,
      lines: V.guide ? V.guide.lines.length : 0,
      lit: V.lit ? V.lit.split(",").map(Number) : [],
      arrow: V.arrow && V.arrow.visible ? { x: V.arrow.position.x, z: V.arrow.position.z } : null,
      meshes: V.group ? V.group.children.length : 0,
      inScene: Boolean(V.group && V.group.parent),
    };
  }

  G.RitualGuide = { show, hide, update, debug, visible: () => Boolean(V.group) };
})((window.KQ = window.KQ || {}));
