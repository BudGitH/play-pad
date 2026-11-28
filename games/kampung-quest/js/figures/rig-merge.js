/* ============================================================================
 * FILE: rig-merge.js
 * PURPOSE: Draw a whole toy figure in ONE draw call (KQ.Figures.mergeRig). A figure is 14-15 part
 *          meshes on a pivot hierarchy (one material); this adds one SkinnedMesh whose bones are
 *          those parts, weight 1 per part, and moves the parts to a hidden layer. Posing still
 *          rotates the parts (the poses, the Animator and every test that reads a part keep
 *          working); the skinned mesh follows them on the GPU.
 * BUSINESS CONTEXT: AC-14 (at most 400 draw calls per frame on the low tier, shadows included).
 *   A town event puts four to eight figures on screen; at 14 calls each, plus 14 more in the
 *   shadow pass, they alone took the busiest views from ~350 to ~500 calls. Merged, a figure
 *   costs 1 + 1. Numbers: features/kampung-quest-playability/notes-perf.md.
 * HOW IT STAYS RIGHT: the merged geometry is rebuilt whenever a part's geometry, material or
 *   visibility changes (a new head piece, a hood's drape, a hidden part): a per-render reference
 *   check, so code that dresses or hides parts needs no change. Props held in a hand (umbrella,
 *   drum, tray) are not parts and stay ordinary meshes.
 * DEPENDENCIES: THREE (r147), build.js (rig fields). Classic script.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  /** Layer the merged-away parts move to: no camera or shadow camera renders it. */
  const HIDDEN_LAYER = 31;
  const PART_KEYS = [
    "hips",
    "legL",
    "kneeL",
    "legR",
    "kneeR",
    "torso",
    "head",
    "accessory",
    "drape",
    "armL",
    "foreL",
    "handL",
    "armR",
    "foreR",
    "handR",
  ];
  const IDENTITY = new THREE.Matrix4();
  /** Component readers (r147 has no BufferAttribute.getComponent). */
  const GET = ["getX", "getY", "getZ", "getW"];

  /** The part meshes of a rig, in a fixed order (missing ones skipped). */
  function partsOf(rig) {
    return PART_KEYS.map((k) => rig[k]).filter((o) => o && o.isMesh);
  }

  /** Is a part drawn: itself and every parent up to (not including) the figure group visible and attached. */
  function shown(o, group) {
    for (let p = o; p && p !== group; p = p.parent) if (!p.visible) return false;
    let p = o.parent;
    while (p && p !== group) p = p.parent;
    return p === group;
  }

  /**
   * Did any part's geometry, material or visibility change since the last build? Compares object
   * references against `M.last` (geometry, material per part; null when the part is not shown), so
   * the per-render check builds no string and allocates nothing.
   */
  function changed(M) {
    let diff = false;
    M.parts.forEach(function (o, i) {
      const on = shown(o, M.group);
      const geo = on ? o.geometry : null;
      const mat = on ? o.material : null;
      if (M.last[2 * i] === geo && M.last[2 * i + 1] === mat) return;
      M.last[2 * i] = geo;
      M.last[2 * i + 1] = mat;
      diff = true;
    });
    return diff;
  }

  /** Every vertex attribute any shown part has (name -> item size): position, normal, uv, color, aSkin... */
  function attributeSet(geos) {
    const out = {};
    geos.forEach((g) =>
      Object.keys(g.attributes).forEach((k) => (out[k] = g.attributes[k].itemSize)),
    );
    return out;
  }

  /** Append one part's triangles (non-indexed) with bone `bone`; a missing attribute is zeros. */
  function appendPart(acc, geo, bone, attrs) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const n = g.attributes.position.count;
    Object.keys(attrs).forEach(function (k) {
      const a = g.attributes[k];
      const size = attrs[k];
      for (let i = 0; i < n; i += 1)
        for (let c = 0; c < size; c += 1) acc[k].push(a ? a[GET[c]](i) : 0);
    });
    for (let i = 0; i < n; i += 1) {
      acc.skinIndex.push(bone, 0, 0, 0);
      acc.skinWeight.push(1, 0, 0, 0);
    }
    if (g !== geo) g.dispose();
    return n;
  }

  /** One geometry (+ a draw group per material) from the shown parts; bone i = parts[i]. */
  function buildGeometry(parts, group) {
    const live = parts.map((o, bone) => ({ o, bone })).filter((p) => shown(p.o, group));
    const attrs = attributeSet(live.map((p) => p.o.geometry));
    const acc = { skinIndex: [], skinWeight: [] };
    Object.keys(attrs).forEach((k) => (acc[k] = []));
    const mats = [];
    const groups = [];
    let start = 0;
    live.forEach(function ({ o, bone }) {
      let m = mats.indexOf(o.material);
      if (m === -1) m = mats.push(o.material) - 1;
      const count = appendPart(acc, o.geometry, bone, attrs);
      const last = groups[groups.length - 1];
      if (last && last.m === m) last.count += count;
      else groups.push({ start, count, m });
      start += count;
    });
    const g = new THREE.BufferGeometry();
    Object.keys(attrs).forEach((k) =>
      g.setAttribute(k, new THREE.Float32BufferAttribute(acc[k], attrs[k])),
    );
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(acc.skinIndex, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(acc.skinWeight, 4));
    groups.forEach((x) => g.addGroup(x.start, x.count, x.m));
    // Bounds in the figure group's space (the vertices are in each part's own space, so the
    // computed ones would be wrong): a sphere round a standing or kneeling figure.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 1.3);
    return { geometry: g, materials: mats };
  }

  /** Rebuild the merged mesh when the parts changed since the last build. */
  function refresh(M) {
    if (!changed(M)) return;
    const built = buildGeometry(M.parts, M.group);
    if (M.old) M.old.dispose();
    M.old = M.mesh.geometry; // the current draw may still use it: dispose on the next rebuild
    M.mesh.geometry = built.geometry;
    M.mesh.material = built.materials.length === 1 ? built.materials[0] : built.materials;
  }

  /** Keep each part's shadow flag on the merged mesh (Loop.figureShadows toggles the parts). */
  function syncShadow(M) {
    const cast = M.parts.some((o) => o.castShadow);
    M.mesh.castShadow = cast;
  }

  /**
   * Merge a built figure (KQ.Figures.build) into one skinned draw. Idempotent. Returns the
   * merge record (`rig.merged`), or null when the parts cannot be merged (then nothing changes).
   */
  F.mergeRig = function (group) {
    const rig = group.userData.rig;
    if (!rig || rig.merged) return rig ? rig.merged : null;
    const parts = partsOf(rig);
    if (!parts.length) return null;
    const skeleton = new THREE.Skeleton(
      parts,
      parts.map(() => IDENTITY.clone()),
    );
    const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), rig.material);
    mesh.name = "figureMerged";
    mesh.receiveShadow = true;
    group.add(mesh);
    mesh.bind(skeleton, IDENTITY);
    const M = { group, rig, parts, mesh, last: [], old: null };
    parts.forEach((o) => o.layers.set(HIDDEN_LAYER));
    refresh(M);
    syncShadow(M);
    mesh.onBeforeRender = function () {
      refresh(M);
      syncShadow(M);
    };
    rig.merged = M;
    return M;
  };
})((window.KQ = window.KQ || {}));
