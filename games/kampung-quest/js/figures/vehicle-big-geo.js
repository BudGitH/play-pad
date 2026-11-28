/* ============================================================================
 * FILE: vehicle-big-geo.js
 * PURPOSE: Kampung Quest — the big vehicles (F.VehicleBig), in the same smooth, lifelike style as the cars:
 *          - a generic, unbranded low-floor single-deck town bus (light body with a green stripe and skirt, big
 *            tinted windows, two doors on the LEFT as in Singapore, rabbit-ear mirrors, round wheel arches, a
 *            destination sign that reads "Kampung 21"); its two doors are separate geometries so they can open;
 *          - a small canopy lorry (a blue cab-over cab, a flat tray with drop sides and a green canvas canopy on
 *            hoops, dual rear wheels), drivable like a car.
 *            F.VehicleBig.bus() -> { body, trim, glass, lamp, doors:[front, middle], sign, axles, width, length,
 *                                    mid, wheelR, doorX }
 *            F.VehicleBig.lorry(lhd) -> { body, roof, trim, glass, lamp, axles, width, length, mid, wheelR,
 *                                         driverX, steerAt, inset, style }
 *          Local frame: faces +z, left +x, the origin on the ground mid-wheelbase.
 * BUSINESS CONTEXT: AC-P14 (playability round, models) and the owner's "add a bus or lorry too"
 *   (features/kampung-quest-playability/notes-vehicles.md). No operator names, logos or real liveries.
 * DEPENDENCIES: KQ.Figures.VehicleParts (vehicle-parts.js), KQ.Figures.Geo (geometry.js).
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicles-ground.spec.mjs (bus loop, lorry drive)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = F.VehicleParts;
  const G = F.Geo;
  const PI = Math.PI;
  const WHITE = "#ffffff";
  const DARK = "#2b2d33";
  const BLACK = "#1b1c20";
  const GREEN = "#2f8f5b";
  const cache = {};

  /* ------------------------------ bus ------------------------------ */

  /** Bus sizes: half length, width, roof, wheel radius, axles, the two (left-side) door centres and width. */
  const BUS = {
    zf: 5,
    zr: -5,
    w: 2.4,
    roof: 3.0,
    r: 0.48,
    axF: 2.8,
    axR: -2.5,
    doors: [3.95, 0.35],
    dw: 1.2,
  };

  /** The bus's side view: a long box with a raked, rounded front, rounded roof edges and round arches. */
  function busShape() {
    const b = BUS;
    const p = new THREE.Shape();
    p.moveTo(b.zr + 0.15, 0.32);
    p.quadraticCurveTo(b.zr, 0.32, b.zr, 0.5);
    p.lineTo(b.zr, b.roof - 0.25);
    p.quadraticCurveTo(b.zr, b.roof, b.zr + 0.3, b.roof);
    p.lineTo(b.zf - 0.45, b.roof);
    p.quadraticCurveTo(b.zf - 0.05, b.roof, b.zf - 0.02, b.roof - 0.4);
    p.lineTo(b.zf + 0.05, 0.6);
    p.quadraticCurveTo(b.zf + 0.06, 0.32, b.zf - 0.15, 0.32);
    [b.axF, b.axR].forEach(function (zc) {
      p.lineTo(zc + 0.6, 0.32);
      p.absarc(zc, b.r, 0.6, 0, PI, false);
      p.lineTo(zc - 0.6, 0.32);
    });
    p.lineTo(b.zr + 0.15, 0.32);
    return p;
  }

  /** The bus body (tinted by its material: a light livery colour), smooth-shaded. */
  function busBody() {
    const g = P.sideShape(busShape(), BUS.w, WHITE, 0.1, 8, 3);
    return P.smoothed(g, 40);
  }

  /** The livery stripe, the skirt and the roof pods (vertex coloured trim), wells, bumpers and the mirrors. */
  function busTrim() {
    const b = BUS;
    const len = b.zf - b.zr - 0.3;
    const parts = [P.block(b.w * 0.9, 0.5, len - 1.2, [0, 0.55, 0], BLACK)];
    [-1, 1].forEach(function (k) {
      const x = k * (b.w / 2 + 0.005);
      parts.push(P.box(0.02, 0.14, len, [x, 0.95, -0.05], GREEN));
      parts.push(P.box(0.02, 0.08, len, [x, 2.68, -0.05], GREEN));
      parts.push(P.box(0.02, 0.22, len - 0.2, [x, 0.44, -0.05], "#3b3f46"));
      [b.axF, b.axR].forEach((zc) => parts.push(P.halfRing(x, b.r, zc, 0.62, 0.04, DARK)));
      parts.push(...busMirror(k));
    });
    parts.push(P.block(b.w * 0.96, 0.24, 0.16, [0, 0.42, b.zf + 0.12], "#3b3f46"));
    parts.push(P.block(b.w * 0.96, 0.24, 0.16, [0, 0.42, b.zr - 0.12], "#3b3f46"));
    parts.push(P.block(1.4, 0.25, 2.4, [0, b.roof + 0.12, -2.8], "#d9dcdf"));
    return G.merge(parts.concat(busWindows()));
  }

  /** A rabbit-ear mirror on a curved arm at the front corner (k = side). */
  function busMirror(k) {
    const arm = [
      [k * 1.12, 2.45, BUS.zf - 0.1],
      [k * 1.3, 2.5, BUS.zf + 0.25],
      [k * 1.25, 2.15, BUS.zf + 0.45],
    ];
    return [
      P.bent(arm, 0.025, BLACK, 10),
      P.lens(0.12, 0.34, 0.06, [k * 1.25, 1.95, BUS.zf + 0.45], BLACK),
    ];
  }

  /** The tinted glass: a window band down each side (with the doors' glass on the left), windscreen, rear. */
  function busGlass() {
    const b = BUS;
    const parts = [P.box(b.w - 0.3, 1.45, 0.03, [0, 1.62, b.zf + 0.17], "#2c3f52")];
    parts.push(P.box(b.w - 0.5, 0.9, 0.03, [0, 2.0, b.zr - 0.12], "#2c3f52"));
    return G.merge(parts);
  }

  /** The side windows, as opaque tinted glass in black frames (pillars between the panes), both sides. */
  function busWindows() {
    const b = BUS;
    const parts = [];
    [-1, 1].forEach(function (k) {
      const x = k * (b.w / 2 + 0.012);
      parts.push(P.box(0.02, 1.25, b.zf - b.zr - 1.6, [x, 1.95, -0.55], "#22303d"));
      for (let z = b.zr + 0.4; z < b.zf - 0.9; z += 1.25) {
        parts.push(P.box(0.03, 1.3, 0.07, [x, 1.95, z], BLACK));
      }
    });
    parts.push(P.box(b.w - 0.2, 1.55, 0.02, [0, 1.62, b.zf + 0.15], "#22303d"));
    parts.push(P.box(b.w - 0.4, 1.0, 0.02, [0, 2.0, b.zr - 0.11], "#22303d"));
    return parts;
  }

  /** One door (two glazed leaves in a dark frame) on the left side, centred at local z 0 (moved by the caller). */
  function busDoor() {
    const h = 2.25;
    const parts = [];
    [-1, 1].forEach(function (s) {
      const z = (s * BUS.dw) / 4;
      parts.push(P.box(0.04, h, BUS.dw / 2 - 0.02, [0, 0.35 + h / 2, z], "#2e3340"));
      parts.push(P.box(0.045, h - 0.35, BUS.dw / 2 - 0.14, [0, 0.45 + h / 2, z], "#5d7590"));
    });
    return G.merge(parts);
  }

  /** The bus lamps: headlamps, indicators, tail and brake lamps (unlit material, so they glow at dusk). */
  function busLamp() {
    const b = BUS;
    const parts = [];
    [-1, 1].forEach(function (k) {
      parts.push(P.lens(0.32, 0.16, 0.1, [k * 0.85, 0.72, b.zf + 0.15], "#fff6d6", [0, 0, 0], 12));
      parts.push(P.lens(0.14, 0.1, 0.08, [k * 1.0, 0.95, b.zf + 0.13], "#f2a51c"));
      parts.push(P.lens(0.18, 0.4, 0.08, [k * 0.95, 0.95, b.zr - 0.13], "#d62b2b", [0, 0, 0], 12));
    });
    return G.merge(parts);
  }

  /** The destination sign's face (a canvas: amber letters on black), front and left side. */
  function busSign() {
    const front = new THREE.PlaneGeometry(1.5, 0.28);
    front.translate(0, BUS.roof - 0.38, BUS.zf + 0.12); // above the mirrors, so nothing hides its text
    const side = new THREE.PlaneGeometry(1.2, 0.26).rotateY(PI / 2);
    side.translate(BUS.w / 2 + 0.04, 2.75, BUS.zf - 2.2);
    return [front, side];
  }

  /** The two sign faces as one geometry (positions, normals, uvs; no vertex colours: the sign has its own texture). */
  function signPlanes() {
    const [a, b] = busSign();
    const g = new THREE.BufferGeometry();
    ["position", "normal", "uv"].forEach(function (k) {
      const n = a.attributes[k].itemSize;
      const arr = new Float32Array(a.attributes[k].array.length + b.attributes[k].array.length);
      arr.set(a.attributes[k].array);
      arr.set(b.attributes[k].array, a.attributes[k].array.length);
      g.setAttribute(k, new THREE.BufferAttribute(arr, n));
    });
    const off = a.attributes.position.count;
    const idx = Array.from(a.index.array).concat(Array.from(b.index.array).map((i) => i + off));
    g.setIndex(idx);
    return g;
  }

  /** The bus's shared geometries. */
  function bus() {
    if (cache.bus) return cache.bus;
    cache.bus = {
      body: busBody(),
      // the bus is drawn in few calls (it parks beside the busy hawker centre): its tinted glass and lamps
      // are part of the trim, its two doors one mesh, its two signs one mesh, no blob, the trim casts no shadow
      trim: G.merge([busTrim(), busGlass(), busLamp()]),
      door: G.merge(BUS.doors.map((z) => busDoor().translate(0, 0, z))),
      signs: signPlanes(),
      lean: true,
      doorX: BUS.w / 2 + 0.03,
      doorSlide: BUS.dw / 2 + 0.05,
      axles: [BUS.axF, BUS.axR],
      width: BUS.w,
      length: BUS.zf - BUS.zr,
      mid: 0,
      wheelR: BUS.r,
      inset: 0.28,
    };
    return cache.bus;
  }

  /* ------------------------------ lorry ------------------------------ */

  /** Lorry sizes: cab front / back, tray front / back, deck height, width, wheel radius, axles. */
  const LOR = {
    zf: 2.5,
    cab: 1.15,
    tray: 1.05,
    zr: -2.7,
    deck: 0.92,
    w: 1.92,
    r: 0.38,
    axF: 1.75,
    axR: -1.5,
  };

  /** The cab's side view: a cab-over with a gently raked, rounded windscreen and a front wheel arch. */
  function cabShape() {
    const L = LOR;
    const p = new THREE.Shape();
    p.moveTo(L.cab, 0.45);
    p.lineTo(L.cab, 2.15);
    p.quadraticCurveTo(L.cab, 2.25, L.cab + 0.15, 2.25);
    p.lineTo(L.zf - 0.35, 2.25);
    p.quadraticCurveTo(L.zf - 0.08, 2.24, L.zf - 0.06, 1.95);
    p.lineTo(L.zf, 0.75);
    p.quadraticCurveTo(L.zf + 0.02, 0.45, L.zf - 0.15, 0.45);
    p.lineTo(L.axF + 0.48, 0.45);
    p.absarc(L.axF, L.r, 0.48, 0, PI, false);
    p.lineTo(L.cab, 0.45);
    return p;
  }

  /** The canvas canopy's cross-section: walls with a rounded top over the hoops. */
  function canopyShape() {
    const w = LOR.w / 2 - 0.02;
    const p = new THREE.Shape();
    p.moveTo(-w, 0);
    p.lineTo(-w, 0.95);
    p.quadraticCurveTo(-w, 1.25, -w + 0.3, 1.27);
    p.lineTo(w - 0.3, 1.27);
    p.quadraticCurveTo(w, 1.25, w, 0.95);
    p.lineTo(w, 0);
    p.lineTo(-w, 0);
    return p;
  }

  /** The canopy: the cross-section pushed back along the tray, smooth-shaded, standing on the deck. */
  function canopy() {
    const len = LOR.tray - LOR.zr - 0.1;
    const g = new THREE.ExtrudeGeometry(canopyShape(), {
      depth: len,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 8,
    });
    g.translate(0, LOR.deck + 0.16, LOR.zr + 0.05);
    return P.smoothed(P.paint(g, "#3f6b4a"), 45);
  }

  /** The tray: chassis rails, the deck, drop sides and tailboard, mudguards, steps, bumper, fuel tank. */
  function lorryTrim(driverX) {
    const L = LOR;
    const len = L.tray - L.zr;
    const zc = (L.tray + L.zr) / 2;
    const parts = [
      P.block(0.9, 0.18, L.zf - L.zr - 0.3, [0, 0.55, (L.zf + L.zr) / 2 - 0.1], BLACK),
      P.block(L.w, 0.08, len, [0, L.deck, zc], "#6d6256"),
      P.block(L.w * 0.96, 0.18, 0.12, [0, 0.52, L.zf], "#3b3f46"),
      P.drum("z", 0.18, 0.7, [-0.62, 0.62, 0.2], "#8d939b", 14),
      canopy(),
    ];
    [-1, 1].forEach(function (k) {
      parts.push(P.block(0.04, 0.16, len, [k * (L.w / 2), L.deck + 0.1, zc], "#c9b89a"));
      parts.push(P.halfRing(k * (L.w / 2 - 0.1), L.r, L.axR, 0.48, 0.05, DARK));
      parts.push(P.block(0.28, 0.04, 0.3, [k * 0.82, 0.38, L.cab + 0.2], "#9aa0a8"));
      parts.push(P.lens(0.1, 0.24, 0.05, [k * (L.w / 2 + 0.12), 1.75, L.zf - 0.25], BLACK));
      parts.push(
        P.rod(
          [k * (L.w / 2 - 0.02), 1.9, L.zf - 0.4],
          [k * (L.w / 2 + 0.12), 1.85, L.zf - 0.25],
          0.015,
          BLACK,
        ),
      );
    });
    return G.merge(parts.concat(cabInside(driverX)));
  }

  /** Inside the cab: tinted panes behind the glass, a dash and the two seats (the driver's back is left out). */
  function cabInside(driverX) {
    const seat = "#3a4152";
    const tint = "#22303d";
    return [
      P.box(LOR.w - 0.36, 0.7, 0.02, [0, 1.72, LOR.zf + 0.045], tint),
      P.box(0.02, 0.55, 0.75, [LOR.w / 2 + 0.008, 1.75, LOR.cab + 0.6], tint),
      P.box(0.02, 0.55, 0.75, [-LOR.w / 2 - 0.008, 1.75, LOR.cab + 0.6], tint),
      P.block(LOR.w - 0.3, 0.25, 0.26, [0, 1.3, LOR.zf - 0.2], "#23252b"),
      P.block(0.5, 0.08, 0.5, [driverX, 1.26, LOR.cab + 0.55], seat),
      P.block(0.5, 0.08, 0.5, [-driverX, 1.26, LOR.cab + 0.55], seat),
      P.block(0.5, 0.55, 0.1, [-driverX, 1.55, LOR.cab + 0.25], seat),
    ];
  }

  /** The cab's glass: a big windscreen and a window in each door. */
  function lorryGlass() {
    const L = LOR;
    const parts = [P.box(L.w - 0.3, 0.75, 0.02, [0, 1.72, L.zf + 0.06], WHITE)];
    [-1, 1].forEach((k) =>
      parts.push(P.box(0.02, 0.6, 0.8, [k * (L.w / 2 + 0.02), 1.75, L.cab + 0.6], WHITE)),
    );
    return G.merge(parts);
  }

  /** The lorry lamps: round headlamps, indicators, tail lamps under the tray. */
  function lorryLamp() {
    const parts = [];
    [-1, 1].forEach(function (k) {
      parts.push(P.lens(0.2, 0.2, 0.08, [k * 0.68, 0.75, LOR.zf + 0.08], "#fff6d6", [0, 0, 0], 12));
      parts.push(P.lens(0.1, 0.08, 0.06, [k * 0.84, 0.95, LOR.zf + 0.06], "#f2a51c"));
      parts.push(P.lens(0.2, 0.1, 0.05, [k * 0.72, 0.75, LOR.zr - 0.02], "#d62b2b"));
    });
    return G.merge(parts);
  }

  /** The lorry's shared geometries (`lhd` puts the driver on the left). */
  function lorry(lhd) {
    const key = lhd ? "lorry-l" : "lorry-r";
    if (cache[key]) return cache[key];
    const driverX = lhd ? 0.45 : -0.45;
    const body = P.squeeze(
      P.sideShape(cabShape(), LOR.w, WHITE, 0.06, 8, 3),
      (y) => 1 - 0.05 * P.smooth(1.9, 2.3, y),
    );
    cache[key] = {
      style: "lorry",
      driverX,
      body: P.smoothed(body, 40),
      trim: lorryTrim(driverX),
      glass: lorryGlass(),
      lamp: lorryLamp(),
      axles: [LOR.axF, LOR.axR],
      width: LOR.w,
      length: LOR.zf - LOR.zr,
      mid: (LOR.zf + LOR.zr) / 2,
      wheelR: LOR.r,
      inset: 0.2,
      steerAt: [1.24, 2.02],
    };
    return cache[key];
  }

  F.VehicleBig = { bus, lorry };
})((window.KQ = window.KQ || {}));
