// Kampung Quest — dressing the hero. The tailor (KQ.Sim.Wardrobe) gives plain overrides (torso, sleeves,
// legs, skirt, print ...); dressHero merges them over the hero's cast spec, builds the parts and the
// printed atlas for that look and swaps them onto the hero's rig in place (same skeleton, same face, same
// animations). undressHero puts the hero's own clothes back (also used for the ihram, which sits on the
// hero's own bare arms). Two print styles used only by the wardrobe live here: the thobe and the jersey.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  /** Parts and atlas are built under one of two ids in turn, so the look being replaced stays until the swap is done. */
  const IDS = ["hero-dress-a", "hero-dress-b"];
  const MAT_KEY = "hero-dress";
  /** [rig joint, parts key]: every body part whose shape or colour depends on the clothes. */
  const SLOTS = [
    ["hips", "hips"],
    ["legL", "thighL"],
    ["legR", "thighR"],
    ["kneeL", "shinL"],
    ["kneeR", "shinR"],
    ["torso", "torso"],
    ["armL", "upper"],
    ["armR", "upper"],
    ["foreL", "fore"],
    ["foreR", "fore"],
    ["handL", "hand"],
    ["handR", "hand"],
  ];

  /** Thobe print: a round collar band, a short placket with buttons and a chest pocket. */
  function thobe(c, s, front) {
    const h = F.printHelpers;
    const trim = (s.print && s.print.accent) || "#cfc8b6";
    if (!front) return h.stroke(c, [128, 40, 128, 256], "rgba(0,0,0,0.10)", 3);
    h.stroke(c, [92, 0, 128, 26, 164, 0], trim, 6);
    h.stroke(c, [128, 26, 128, 150], trim, 5);
    for (let i = 0; i < 3; i += 1) h.dot(c, 128, 52 + i * 30, 5, trim);
    h.rect(c, 168, 96, 44, 48, "rgba(0,0,0,0.10)", 5);
  }

  /** Jersey print: a V collar, side stripes and the number 7 (small on the chest, big on the back). */
  function sports(c, s, front) {
    const h = F.printHelpers;
    const a = (s.print && s.print.accent) || "#f4f1e8";
    h.stroke(c, [84, 0, 128, 34, 172, 0], a, 9);
    h.stroke(c, [22, 60, 22, 256], a, 10);
    h.stroke(c, [234, 60, 234, 256], a, 10);
    c.fillStyle = a;
    c.textAlign = "center";
    c.font = front ? "bold 46px sans-serif" : "bold 130px sans-serif";
    c.fillText("7", front ? 186 : 128, front ? 110 : 190);
  }

  if (F.TORSO_STYLES) {
    F.TORSO_STYLES.thobe = thobe;
    F.TORSO_STYLES.sports = sports;
  }

  /** Remember the hero's own geometry once, so undressHero can put it back. */
  function rememberOwn(rig) {
    if (rig.ownParts) return;
    rig.ownParts = {};
    SLOTS.forEach((s) => (rig.ownParts[s[0]] = rig[s[0]].geometry));
  }

  /** Every mesh of the rig that wears `from` now wears `to` (the ihram pieces and the head piece too). */
  function swapMaterial(rig, from, to) {
    rig.root.traverse((o) => {
      if (o.isMesh && o.material === from) o.material = to;
    });
  }

  /** The one shared "dressed hero" material, pointed at the newest atlas (created on first use). */
  function dressMaterial(atlas) {
    const mat = F.plasticMaterial(MAT_KEY, atlas);
    mat.map = atlas;
    mat.needsUpdate = true;
    return mat;
  }

  /** Free the parts and atlas of a look that is no longer worn. */
  function drop(id) {
    if (!id) return;
    F.releaseParts(id);
    F.releaseAtlas(id);
  }

  /**
   * Paint the hero in a look.
   * @param rig the hero's rig (KQ.Figures.build("hero").userData.rig)
   * @param {object|null} over spec overrides from KQ.Sim.Wardrobe.specFor; null / undefined puts the
   *   hero's own clothes back.
   */
  F.dressHero = function (rig, over) {
    if (!over) return F.undressHero(rig);
    rememberOwn(rig);
    const id = rig.dressId === IDS[0] ? IDS[1] : IDS[0];
    const spec = Object.assign({}, F.CAST.hero, over, { id });
    const parts = F.partsFor(spec, rig.dims);
    const mat = dressMaterial(F.makeAtlas(spec));
    SLOTS.forEach((s) => (rig[s[0]].geometry = parts[s[1]]));
    swapMaterial(rig, rig.material, mat);
    drop(rig.dressId);
    rig.dressId = id;
    rig.dressMat = mat;
  };

  /** Back to the hero's own jacket, gloves and shoes. */
  F.undressHero = function (rig) {
    if (!rig.ownParts || !rig.dressId) return;
    SLOTS.forEach((s) => (rig[s[0]].geometry = rig.ownParts[s[0]]));
    swapMaterial(rig, rig.dressMat, rig.material);
    drop(rig.dressId);
    rig.dressId = null;
  };
})((window.KQ = window.KQ || {}));
