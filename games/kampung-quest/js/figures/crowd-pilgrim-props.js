// Kampung Quest — extra props and headwear for the Haramain crowd, all built from boxes and spheres in the
// same toy scale as the rest of the crowd (a figure is about 1 m tall). Geometries join the crowd kit's mesh
// list (F.crowdExtraGeometries); each prop is placed by a small function in F.CROWD_PROPS, which the kit
// calls with (kit, placement, pose matrices, colours, person, tools). A prop mesh draws only while someone
// carries it, so none of these cost a draw call in the kampung.
//   stick (elder's walking stick), baby (carried: body + head), flag and umbrella (tour guides),
//   cart (cleaner or vendor), wheelchair (frame + seated person), cup (Zamzam).
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const WHITE = "#ffffff";

  /** A painted box of size w x h x d at p. */
  function box(w, h, d, hex, p, r) {
    return G.place(G.paint(G.roundedBox(w, h, d, Math.min(0.01, w / 4), 1), hex || WHITE), p, r);
  }

  /** A painted cylinder (radius top/bottom, height) at p. */
  function cyl(rt, rb, h, hex, p, r, seg) {
    return G.place(G.paint(new THREE.CylinderGeometry(rt, rb, h, seg || 8, 1), hex || WHITE), p, r);
  }

  /** A painted ellipsoid of size s at p. */
  function blob(s, p, hex) {
    return G.place(G.paint(new THREE.SphereGeometry(1, 10, 7), hex || WHITE), p, null, s);
  }

  /** A walking stick hanging from the hand: a thin wooden cylinder with a bent grip. */
  function stick() {
    return G.merge([
      cyl(0.014, 0.012, 0.8, "#7a5636", [0, -0.4, 0]),
      box(0.07, 0.025, 0.025, "#7a5636", [0, 0.01, 0.02]),
    ]);
  }

  /** A baby wrapped in a cloth (white, tinted by the cloth colour) and a little head (tinted by skin). */
  function babyBody() {
    return G.merge([
      box(0.13, 0.19, 0.1, WHITE, [0, 0, 0]),
      blob([0.07, 0.06, 0.06], [0, -0.07, 0.01], WHITE),
    ]);
  }

  function babyHead() {
    return G.merge([blob([0.052, 0.052, 0.052], [0, 0.135, 0.012], WHITE)]);
  }

  /** A tour guide's flag: a pole and a banner (the banner takes the tour colour). */
  function flag() {
    return G.merge([
      cyl(0.012, 0.012, 1.75, "#4b4b52", [0, 0.875, 0]),
      box(0.46, 0.3, 0.012, WHITE, [0.24, 1.55, 0]),
    ]);
  }

  /** A tour guide's umbrella: a pole and a wide cone canopy (tinted by the tour colour). */
  function umbrella() {
    const canopy = G.place(G.paint(new THREE.ConeGeometry(0.46, 0.2, 10), WHITE), [0, 1.62, 0]);
    return G.merge([cyl(0.012, 0.012, 1.6, "#4b4b52", [0, 0.8, 0]), canopy]);
  }

  /** A cleaner's / vendor's cart: a grey frame on two wheels with handles (the goods tub is cartTop). */
  function cartBase() {
    const wheel = (x) => cyl(0.09, 0.09, 0.03, "#2a2a30", [x, 0.09, 0.05], [0, 0, Math.PI / 2], 10);
    return G.merge([
      box(0.46, 0.05, 0.7, "#8c9096", [0, 0.2, 0]),
      wheel(-0.23),
      wheel(0.23),
      box(0.4, 0.02, 0.02, "#4b4b52", [0, 0.42, -0.4]),
      box(0.02, 0.22, 0.02, "#4b4b52", [-0.18, 0.31, -0.36]),
      box(0.02, 0.22, 0.02, "#4b4b52", [0.18, 0.31, -0.36]),
    ]);
  }

  function cartTop() {
    return G.merge([box(0.42, 0.22, 0.52, WHITE, [0, 0.33, 0.05])]);
  }

  /** A wheelchair seen from behind its pusher: frame, two big wheels, seat, back and handles. */
  function wcFrame() {
    const wheel = (x) =>
      cyl(0.17, 0.17, 0.03, "#2a2a30", [x, 0.17, -0.02], [0, 0, Math.PI / 2], 12);
    return G.merge([
      wheel(-0.25),
      wheel(0.25),
      box(0.38, 0.04, 0.36, "#3b3f4a", [0, 0.27, 0.05]),
      box(0.38, 0.3, 0.03, "#3b3f4a", [0, 0.42, -0.14]),
      box(0.03, 0.03, 0.3, "#8c9096", [-0.2, 0.52, -0.25]),
      box(0.03, 0.03, 0.3, "#8c9096", [0.2, 0.52, -0.25]),
      box(0.3, 0.03, 0.12, "#3b3f4a", [0, 0.1, 0.27]),
    ]);
  }

  /** The person sitting in it: a torso (clothes colour) with arms and legs folded forward. */
  function wcBody() {
    return G.merge([
      box(0.26, 0.36, 0.14, WHITE, [0, 0.48, -0.05]),
      box(0.22, 0.09, 0.3, WHITE, [0, 0.31, 0.1]),
      box(0.18, 0.2, 0.09, WHITE, [0, 0.16, 0.28]),
    ]);
  }

  function wcHead() {
    return G.merge([blob([0.085, 0.095, 0.085], [0, 0.7, -0.04], WHITE)]);
  }

  /** A small plastic cup for drinking Zamzam. */
  function cup() {
    return G.merge([cyl(0.032, 0.024, 0.075, WHITE, [0, 0, 0.0], null, 10)]);
  }

  /** Gulf head cloth: a dome with a drape down the back and sides (tinted white or red-checked red). */
  function hatGhutra() {
    return [
      blob([0.125, 0.09, 0.13], [0, 0.155, 0], WHITE),
      box(0.26, 0.2, 0.04, WHITE, [0, 0.07, -0.105]),
      box(0.03, 0.15, 0.13, WHITE, [-0.118, 0.1, -0.03]),
      box(0.03, 0.15, 0.13, WHITE, [0.118, 0.1, -0.03]),
    ];
  }

  /** An African head wrap (gele): a tall soft bundle on top with a flared knot. */
  function hatWrap() {
    return [
      blob([0.14, 0.11, 0.15], [0, 0.2, -0.005], WHITE),
      blob([0.07, 0.05, 0.06], [0.1, 0.25, 0.02], WHITE),
    ];
  }

  /** A turban: a wound rounded bundle. */
  function hatTurban() {
    return [
      blob([0.13, 0.095, 0.135], [0, 0.185, 0], WHITE),
      blob([0.12, 0.04, 0.125], [0, 0.135, 0], WHITE),
    ];
  }

  /** A Central Asian skullcap (doppi): a low square-sided cap. */
  function hatDoppi() {
    return [cyl(0.085, 0.108, 0.07, WHITE, [0, 0.175, 0], [0, Math.PI / 4, 0], 4)];
  }

  /** The extra mesh geometries by name (merged into the crowd kit's list on first use). */
  F.crowdExtraGeometries = function () {
    return {
      stick: stick(),
      babyBody: babyBody(),
      babyHead: babyHead(),
      flag: flag(),
      umbrella: umbrella(),
      cartBase: cartBase(),
      cartTop: cartTop(),
      wcFrame: wcFrame(),
      wcBody: wcBody(),
      wcHead: wcHead(),
      cup: cup(),
      hat_ghutra: G.merge(hatGhutra()),
      hat_wrap: G.merge(hatWrap()),
      hat_turban: G.merge(hatTurban()),
      hat_doppi: G.merge(hatDoppi()),
    };
  };

  /** Put `mesh` at the right hand (slot 13) shifted by (x, y, z), in colour `col`. */
  function inHand(T, kit, g, m, name, off, col) {
    T.put(kit, name, g, T.at(m, 13, off[0], off[1], off[2]), col);
  }

  /** Props by name: function (kit, placement g, pose matrices m, colours tint, person p, tools T). */
  F.CROWD_PROPS = {
    stick: (kit, g, m, t, p, T) => inHand(T, kit, g, m, "stick", [0, -0.03, 0.01], T.ID),
    cup: (kit, g, m, t, p, T) => inHand(T, kit, g, m, "cup", [0, -0.04, 0.035], T.ID),
    baby(kit, g, m, t, p, T) {
      T.put(kit, "babyBody", g, T.at(m, 5, 0, 0.14, 0.13), t.bag);
      T.put(kit, "babyHead", g, T.at(m, 5, 0, 0.14, 0.13), t.skin);
    },
    flag: (kit, g, m, t, p, T) => T.put(kit, "flag", g, T.local(-0.26, 0, 0.1), t.bag),
    umbrella: (kit, g, m, t, p, T) => T.put(kit, "umbrella", g, T.local(-0.26, 0, 0.1), t.bag),
    cart(kit, g, m, t, p, T) {
      T.put(kit, "cartBase", g, T.local(0, 0, 0.62), T.ID);
      T.put(kit, "cartTop", g, T.local(0, 0, 0.62), t.bag);
    },
    wheelchair(kit, g, m, t, p, T) {
      T.put(kit, "wcFrame", g, T.local(0, 0, 0.58), T.ID);
      T.put(kit, "wcBody", g, T.local(0, 0, 0.58), t.top);
      T.put(kit, "wcHead", g, T.local(0, 0, 0.58), t.skin);
    },
  };
})((window.KQ = window.KQ || {}));
