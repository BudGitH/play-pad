/* ============================================================================
 * FILE: vehicle-car-geo.js
 * PURPOSE: Kampung Quest — a car's geometry set (F.VehicleCars): the moulded tub and greenhouse
 *          (vehicle-car-shape.js), the dress (vehicle-car-dress.js: lamps, grille, plates, handles, mirrors) and
 *          the cabin (vehicle-car-inside.js), gathered into four layers that are each ONE draw call:
 *            paint (the clearcoat body and pillars), trim (everything dark, bright or lit: one shader by class),
 *            glass (tinted, see-through), roof (it fades while the hero drives).
 *          Every piece has an owner: "body", a door ("door0".."door3": front right, front left, rear right, rear
 *          left) or "steer" (the parked steering wheel). variant(layer, mask) merges a layer without the owners in
 *          `mask` (bit k = door k cut out, bit 4 = the steering wheel), so a door is split out only while it opens
 *          and the parked car stays a few calls; door(k) is that door's own paint / trim / glass about its hinge.
 *            F.VehicleCars.build(style, lhd, low, fuel) -> { style, driverX, livery, variant(), door(k), doors,
 *              seats, exhaust, steerAt, axles, width, length, mid }
 *          Kampung cars wear Singapore plates (black, or white front / yellow rear), right-hand drive; a kampung
 *          taxi wears the generic teal / white livery. Makkah and Madinah cars are left-hand drive, plain plates.
 * BUSINESS CONTEXT: owner's realism pass; AC-P14 (models, draw budget), features/kampung-quest-playability/.
 * DEPENDENCIES: KQ.Figures.VehicleCarShape, VehicleCarDress, VehicleCarInside, VehicleParts, VehicleMats, Geo.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs tests/kampung-quest-vehicles-all.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = () => F.VehicleParts;
  const Shape = () => F.VehicleCarShape;
  const DRIVER_X = 0.34;
  const ARCH_R = 0.37;
  const WHEEL_Y = 0.3;
  const BLACK = "#111215";
  /** The kampung taxi's plain two-tone livery (no operator's name or colours): teal lower body, white upper. */
  const TAXI_LIVERY = { lower: "#1f7a8c", upper: "#f4f4f0" };
  /** Number plates: Singapore black, Singapore "Euro" (white front, yellow rear), and plain (Makkah / Madinah). */
  const PLATES = {
    black: { front: ["#141516", "#f2f2f0"], rear: ["#141516", "#f2f2f0"] },
    euro: { front: ["#f4f4f0", "#141516"], rear: ["#f2c230", "#141516"] },
    plain: { front: ["#f4f4f0", "#23252b"], rear: ["#f4f4f0", "#23252b"] },
  };
  const SG_PLATE = { hatch: "euro", sedan: "black", taxi: "black", suv: "euro", mpv: "black" };
  /** Which styles have a glass sunroof (a dark panel in the roof). */
  const SUNROOF = { suv: true, hatch: true };
  const OWNER_BIT = { door0: 1, door1: 2, door2: 4, door3: 8, steer: 16 };
  const cache = {};

  /** Recolour a whole geometry one colour and tag its class (window frames, door cards). */
  function recolour(g, hex, cls) {
    const c = new THREE.Color(hex).convertSRGBToLinear();
    const col = g.attributes.color;
    for (let i = 0; i < col.count; i += 1) col.setXYZ(i, c.r, c.g, c.b);
    return P().tag(g, cls);
  }

  /** Darken the roof's vertices over the sunroof (the roof material multiplies its paint by them). */
  function sunroof(g, s) {
    const pos = g.attributes.position;
    const col = g.attributes.color;
    for (let i = 0; i < pos.count; i += 1) {
      const z = pos.getZ(i);
      if (Math.abs(pos.getX(i)) < 0.36 && z < s.B - 0.12 && z > s.B - 0.75)
        col.setXYZ(i, 0.04, 0.045, 0.05);
    }
    return g;
  }

  /** The greenhouse's pieces with their layer colours: trim black and glossy, roof with its sunroof. */
  function greenPieces(s) {
    const out = [];
    const gh = Shape().greenhouse(s, P().detail());
    Object.keys(gh).forEach(function (key) {
      const [layer, owner] = key.split(":");
      let g = gh[key];
      if (layer === "trim") g = recolour(g, BLACK, F.VehicleMats.CLS.gloss);
      if (layer === "roof" && SUNROOF[s.name]) g = sunroof(g, s);
      out.push({ layer, owner, g });
    });
    return out;
  }

  /** A door's inner card: its skin moved 4 cm in, turned inside out, dark (so an open door shows its inside). */
  function doorCard(skin) {
    const g = skin.clone();
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setXYZ(
        i,
        pos.getX(i) - nrm.getX(i) * 0.04,
        pos.getY(i) - nrm.getY(i) * 0.04,
        pos.getZ(i) - nrm.getZ(i) * 0.04,
      );
      nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
    }
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    return recolour(g, Shape().COLOURS.INTERIOR, F.VehicleMats.CLS.matte);
  }

  /** The tub's pieces (paint), plus a card for each door skin (trim, owned by that door). */
  function tubPieces(s, livery) {
    const out = [];
    const tub = Shape().tub(s, P().detail(), livery);
    Object.keys(tub).forEach(function (key) {
      const owner = key.split(":")[1];
      out.push({ layer: "paint", owner, g: tub[key] });
      if (owner !== "body") out.push({ layer: "trim", owner, g: doorCard(tub[key]) });
      if (owner === "cabin") out[out.length - 2].owner = "body";
    });
    return out;
  }

  /** Every piece of a car. */
  function allPieces(s, o) {
    return tubPieces(s, o.livery).concat(
      greenPieces(s),
      F.VehicleCarDress.front(s, o),
      F.VehicleCarDress.rear(s, o),
      F.VehicleCarDress.sides(s, o),
      F.VehicleCarInside.pieces(s, o.driverX, o.low),
    );
  }

  /** Where door k hinges (its front edge, at the shoulder's side) and how it moves. */
  function hinge(s, k) {
    const z = k < 2 ? s.doors[0] : s.doors[1];
    const side = s.doorSides[k] === "L" ? 1 : -1;
    const x = side * F.VehicleLoft.point(s.body, { z }, 0.2)[0];
    return { at: [x, 0.6, z], side, kind: k >= 2 && s.slide ? "slide" : "hinge" };
  }

  /** The seat each door serves (the driver's door serves seat 0). */
  function doorSeat(k, driverX) {
    const driverDoor = driverX < 0 ? 0 : 1;
    if (k < 2) return k === driverDoor ? 0 : 1;
    return k === 2 ? 2 : 3;
  }

  /** A layer merged without the owners whose bits are set in mask (cached per layer and mask). */
  function variant(set, layer, mask) {
    const key = layer + ":" + mask;
    if (set.merged[key] !== undefined) return set.merged[key];
    const list = set.pieces.filter((p) => p.layer === layer && !((OWNER_BIT[p.owner] || 0) & mask));
    set.merged[key] = list.length ? F.Geo.merge(list.map((p) => p.g)) : null;
    return set.merged[key];
  }

  /** Door k's own geometries (paint, trim, glass), moved so its hinge is the origin (cached). */
  function door(set, k) {
    if (set.doorGeos[k]) return set.doorGeos[k];
    const h = set.doors[k].hinge;
    const out = {};
    ["paint", "trim", "glass"].forEach(function (layer) {
      const list = set.pieces.filter((p) => p.layer === layer && p.owner === "door" + k);
      out[layer] = list.length
        ? F.Geo.merge(list.map((p) => p.g.clone())).translate(-h[0], -h[1], -h[2])
        : null;
    });
    set.doorGeos[k] = out;
    return out;
  }

  /**
   * A geometry set from owned pieces: `doors` [{side, seat, hinge:[x,y,z], sx, kind}], `props` copied on.
   * Adds variant(layer, mask) and door(k). Shared by the cars and the lorry.
   */
  function makeSet(pieces, doors, props) {
    const set = { pieces, merged: {}, doorGeos: {}, doors };
    return Object.assign(set, props, {
      variant: (layer, mask) => variant(set, layer, mask || 0),
      door: (k) => door(set, k),
    });
  }

  /** The geometry set of a style (see the header). */
  function assemble(name, lhd, low, fuel) {
    const s = Shape().style(name);
    const driverX = lhd ? DRIVER_X : -DRIVER_X;
    const livery = s.sign && !lhd ? TAXI_LIVERY : null;
    const scheme = PLATES[lhd ? "plain" : SG_PLATE[s.name]];
    const doors = [0, 1, 2, 3].map(function (k) {
      const h = hinge(s, k);
      return {
        side: s.doorSides[k],
        seat: doorSeat(k, driverX),
        hinge: h.at,
        sx: h.side,
        kind: h.kind,
      };
    });
    return makeSet(allPieces(s, { driverX, livery, scheme, fuel, low }), doors, {
      style: s.name,
      driverX,
      livery,
      fuel,
      seats: F.VehicleCarInside.seats(s, driverX),
      exhaust: fuel === "electric" ? null : F.VehicleCarDress.exhaust(s),
      steerAt: F.VehicleCarInside.STEER_AT,
      axles: [s.axF, s.axR],
      archR: s.arch,
      width: s.w,
      length: s.zf - s.zr,
      mid: (s.zf + s.zr) / 2,
      height: s.roof,
    });
  }

  /**
   * Build (and cache) the geometry set of a style; an unknown style is a sedan. `lhd` puts the driver on the left
   * (x > 0), else on the right (Singapore). `low` builds fewer segments; `fuel` "electric" closes the grille and
   * drops the tail pipe.
   */
  function build(style, lhd, low, fuel) {
    const name = Shape().STYLES.indexOf(style) >= 0 ? style : "sedan";
    const f = fuel === "electric" ? "electric" : "petrol";
    const key = [name, lhd ? "l" : "r", low ? "low" : "hi", f].join("-");
    if (cache[key]) return cache[key];
    cache[key] = P().withDetail(low, function () {
      const set = assemble(name, lhd, low, f);
      variant(set, "paint", 0);
      return set;
    });
    return cache[key];
  }

  F.VehicleCars = {
    build,
    makeSet,
    recolour,
    PLATES,
    STYLES: ["hatch", "sedan", "taxi", "suv", "mpv"],
    ARCH_R,
    WHEEL_Y,
    OWNER_BIT,
  };
})((window.KQ = window.KQ || {}));
