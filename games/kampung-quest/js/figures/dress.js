/* ============================================================================
 * FILE: dress.js
 * PURPOSE: Kampung Quest — dressing the hero. The tailor (KQ.Sim.Wardrobe) gives plain overrides (torso, sleeves,
 *          legs, skirt, print ...); dressHero merges them over the hero's cast spec, builds the parts and the
 *          printed atlas for that look and swaps them onto the hero's rig in place (same skeleton, same face, same
 *          animations). undressHero puts the hero's own clothes back (also used for the ihram, which sits on the
 *          hero's own bare arms). Two print styles used only by the wardrobe live here: the thobe and the jersey.
 * BUSINESS CONTEXT: AC-R5 / AC-R6 (realism round, features/kampung-quest-realism/requirements.md): the hero can change clothes at the tailor and
 *   the look is rebuilt on the same rig, so animations, face and colliders keep working.
 *   The default classic jacket in royal blue is never repainted (the colour-family rule).
 * DEPENDENCIES: KQ.Figures (geometry, atlas, cast spec), KQ.Sim.Wardrobe (the overrides).
 * HOW TO TEST: npm run test:kq (wardrobe.test.mjs, rules); npx playwright test tests/kampung-quest-wardrobe.spec.mjs (browser).
 * ========================================================================== */
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

  /** The girl's long dress: a round white collar, a bow at the waist and a scatter of little dots. */
  function dress(c, s, front) {
    const h = F.printHelpers;
    const a = (s.print && s.print.accent) || "#ffffff";
    for (let i = 0; i < 9; i += 1) h.dot(c, 30 + ((i * 83) % 200), 70 + ((i * 47) % 170), 5, a);
    h.stroke(c, [0, 214, 256, 214], a, 10); // sash
    if (!front) return;
    h.stroke(c, [88, 0, 104, 30, 128, 36, 152, 30, 168, 0], "#fbfaf6", 12); // collar
    h.poly(c, [128, 214, 98, 196, 98, 232], a);
    h.poly(c, [128, 214, 158, 196, 158, 232], a);
    h.dot(c, 128, 214, 8, a);
  }

  /** The girl's tunic: an embroidered band round the neckline and down the front, and cuffed hem. */
  function tunic(c, s, front) {
    const h = F.printHelpers;
    const a = (s.print && s.print.accent) || "#f2c94c";
    h.stroke(c, [0, 246, 256, 246], a, 8);
    if (!front) return h.stroke(c, [86, 0, 128, 20, 170, 0], a, 6);
    h.stroke(c, [84, 0, 128, 40, 172, 0], a, 9);
    h.stroke(c, [128, 40, 128, 140], a, 5);
    for (let i = 0; i < 4; i += 1) h.dot(c, 128, 58 + i * 24, 5, "#fbfaf6");
  }

  if (F.TORSO_STYLES) {
    F.TORSO_STYLES.thobe = thobe;
    F.TORSO_STYLES.sports = sports;
    F.TORSO_STYLES.dress = dress;
    F.TORSO_STYLES.tunic = tunic;
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
   * @param {object} [base] the spec the overrides go on: the boy (CAST.hero, default) or the girl
   *   (HERO_GIRL, whose face and hands differ). Same rig, same skeleton either way.
   */
  F.dressHero = function (rig, over, base) {
    if (!over) return F.undressHero(rig);
    rememberOwn(rig);
    const id = rig.dressId === IDS[0] ? IDS[1] : IDS[0];
    const spec = Object.assign({}, base || F.CAST.hero, over, { id });
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
