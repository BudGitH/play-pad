// Kampung Quest — the hero's ihram: two plain white cloths (a wrap round the waist and a cloth over the
// torso and left shoulder), bare legs and simple sandals instead of the cap, jacket and red shoes.
// Modest by design: the cloth covers hips to below the knee and the torso. Built once, then shown / hidden.
// Also the two short haircuts of tahallul (a trim and a shave) as head pieces.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const CLOTH = "#f7f6f1";
  const SOLE = "#7a5434";
  const STRAP = "#a8794b";
  const BELT = "#b9a98a";

  /** Add a painted geometry as a named mesh under a parent (same plastic material as the hero). */
  function mesh(rig, name, parent, geo, x, y, z) {
    const m = new THREE.Mesh(geo, rig.material);
    m.name = name;
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** The waist wrap (izar): a soft skirt from the hips to below the knees. */
  function waistWrap(rig, d) {
    const prof = [0.172, -0.152, 0.165, -0.08, 0.15, 0.0, 0.126, d.hipBlockH + 0.012];
    const g = G.paint(G.lathe(prof, 28), CLOTH);
    const belt = G.paint(G.lathe([0.156, 0.016, 0.158, 0.03, 0.15, 0.04], 28), BELT);
    const both = G.merge([g, G.place(belt, [0, 0.004, 0], null, [1, 1, 1])]);
    G.place(both, null, null, [1.0, 1, 0.74]);
    return mesh(rig, "ihramWrap", rig.hips, both, 0, 0, 0);
  }

  /** The upper cloth (rida): over the torso and the left shoulder, the right shoulder left bare. */
  function upperCloth(rig, d) {
    const h = d.torsoH + 0.02;
    const body = G.taper(G.roundedBox(0.272, h, d.torsoD + 0.036, 0.02, 2), 1, 0.84, 1, 0.9, h);
    const shoulder = G.roundedBox(0.1, 0.07, 0.15, 0.03, 2);
    const parts = [G.paint(body, CLOTH)];
    parts.push(G.place(G.paint(shoulder, CLOTH), [d.shoulderX, d.torsoH - 0.01, 0], [0, 0, -0.18]));
    return mesh(rig, "ihramCloth", rig.torso, G.merge(parts), 0, d.torsoH / 2, 0);
  }

  /** One bare leg (skin shin) and a sandal (sole, skin foot, strap) over the shoe, at a knee joint. */
  function bareLeg(rig, side, d, skin) {
    const knee = rig["knee" + side];
    const shin = G.paint(G.roundedBox(0.121, d.shin - 0.004, 0.126, 0.012, 1), skin, true);
    const foot = G.paint(G.roundedBox(0.124, 0.05, 0.168, 0.018, 1), skin, true);
    const sole = G.paint(G.roundedBox(0.128, 0.012, 0.176, 0.006, 1), SOLE);
    const strap = G.paint(G.roundedBox(0.13, 0.012, 0.06, 0.004, 1), STRAP);
    const y = -d.shin;
    return [
      mesh(rig, "ihramShin" + side, knee, shin, 0, -d.shin / 2 + 0.002, 0),
      mesh(rig, "ihramFoot" + side, knee, foot, 0, y + 0.03, 0.016),
      mesh(rig, "ihramSole" + side, knee, sole, 0, y + 0.004, 0.016),
      mesh(rig, "ihramStrap" + side, knee, strap, 0, y + 0.058, 0.03),
    ];
  }

  /** Build the ihram meshes once (hidden) and remember them on the rig. */
  function build(rig) {
    const d = rig.dims;
    const skin = rig.spec.skin;
    rig.ihram = {
      parts: [waistWrap(rig, d), upperCloth(rig, d)].concat(
        bareLeg(rig, "L", d, skin),
        bareLeg(rig, "R", d, skin),
      ),
    };
    return rig.ihram;
  }

  /** The hero's own clothes: the cap is handled by the head piece, the rest by hiding the ihram parts. */
  F.setIhram = function (rig, on) {
    if (!rig.ihram && !on) return;
    const set = rig.ihram || build(rig);
    set.parts.forEach((m) => (m.visible = Boolean(on)));
    rig.ihram.on = Boolean(on);
  };

  /** The head piece for the ihram look: the hero's own short hair, a trim (stubble) or a shave (bald). */
  F.IHRAM_HEAD = {
    none: { type: "hair_short", colour: "#3a2416" },
    trim: { type: "hair_buzz", colour: "#4a3626" },
    shave: { type: "hair_bald", colour: "#e3a97c" },
  };

  /** The head piece after tahallul for any look: the cap loses its hair tuft, hair becomes a trim or a shave. */
  F.cutHead = function (spec, cut) {
    if (!cut || cut === "none") return spec;
    if (spec.type === "cap" || spec.type === "songkok")
      return Object.assign({}, spec, { hair: null });
    return F.IHRAM_HEAD[cut === "shave" ? "shave" : "trim"];
  };
})((window.KQ = window.KQ || {}));
