/* ============================================================================
 * FILE: vehicle-car-shape.js
 * PURPOSE: Kampung Quest — the shapes of the five modern car styles (F.VehicleCarShape): compact sedan, hatchback,
 *          crossover SUV, MPV and taxi (a sedan in the generic two-tone livery). Each style is a few numbers (body
 *          ends, axles, nose and bonnet heights, windscreen base A and top B, roof end C, rear-glass base D, belt
 *          line, door edges) turned into two moulded bodies for F.VehicleLoft:
 *            - the tub: everything below the windows, with a low rounded nose that leans back, a sloping bonnet,
 *              arches round the wheels with a lip, a rear haunch, the sill tucking under, hard shut lines at the
 *              door edges, bonnet and boot lid, a dark underside (and dark cladding on the SUV);
 *            - the greenhouse: a raked windscreen rolling into the roof and a sloping rear glass, cut into layers by
 *              (station, ring) zones: glass, roof, body-colour A / C pillars, black B pillar, window frames and seals,
 *              each piece owned by the body or by a door (so a door's skin and window can swing away together).
 *          Generic and unbranded: no maker's design is copied. Local frame: faces +z, left +x, y up.
 *            F.VehicleCarShape.style(name) -> the style's numbers (+ derived curves)
 *            F.VehicleCarShape.tub(s) / .greenhouse(s) -> {layer:owner -> geometry}
 * BUSINESS CONTEXT: owner's realism pass ("not boxy: the front is angled and curved"), sg-cars-reference.md,
 *   features/kampung-quest-playability/notes-vehicles.md, "Realism pass".
 * DEPENDENCIES: KQ.Figures.VehicleLoft (vehicle-loft.js), KQ.Figures.VehicleParts (vehicle-parts.js).
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs tests/kampung-quest-vehicles-all.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const L = () => F.VehicleLoft;
  const P = () => F.VehicleParts;
  const PI = Math.PI;
  const WHEEL_Y = 0.3;
  const UNDER = "#141517";
  const CLAD = "#2a2c30";
  const SEAM = "#1d1f23";
  const INTERIOR = "#2c2e33";
  /** Ring angles (right half of the tub's section): underside / sill / door / shoulder (greenhouse base) / top. */
  const A_UNDER = -1.15;
  const A_DOOR_LO = -0.6;
  const A_SHOULDER = 0.75;
  const A_HOOD = 0.95;
  /**
   * The greenhouse section's exponent and its ring angles: by height fraction f up the side (a = asin(f^(n/2)))
   * for the belt seal, the side glass top and its frame; by width fraction g across the top (a = acos(g^(n/2)))
   * for the corner (pillars / roof edge) and the top.
   */
  const G_N = 6;
  const byH = (f) => Math.asin(Math.pow(f, G_N / 2));
  const byW = (g) => Math.acos(Math.pow(g, G_N / 2));
  const G_SEAL = byH(0.07);
  const G_SIDE = byH(0.86);
  const G_FRAME = byH(0.92);
  const G_CORNER = byW(0.66);

  /**
   * The styles. z forward: ends zf / zr, axles axF / axR, arch radius, sill, waist; nose top / bumper bottom,
   * bonnet lean; windscreen base A / top B, roof end C, rear glass base D, roof heights; belt at A and its rise to D;
   * boot deck (a sedan's; null = a tailgate), width; plan exponents; door edges [front door front, B pillar,
   * rear door rear]; rear seat rows; flags.
   */
  const STYLES = {
    sedan: {
      zf: 1.95,
      zr: -1.85,
      axF: 1.22,
      axR: -1.12,
      arch: 0.37,
      sill: 0.21,
      waist: 0.5,
      nose: 0.63,
      chin: 0.24,
      lean: 0.12,
      A: 0.98,
      B: 0.13,
      C: -0.92,
      D: -1.38,
      roof: 1.37,
      roofC: 1.33,
      belt: 0.84,
      rise: 0.05,
      deck: 0.88,
      w: 1.64,
      mF: 5,
      mR: 6,
      doors: [0.62, -0.08, -0.7],
      rows: [-0.78],
      spoiler: true,
    },
    hatch: {
      zf: 1.72,
      zr: -1.6,
      axF: 1.08,
      axR: -1.0,
      arch: 0.37,
      sill: 0.21,
      waist: 0.52,
      nose: 0.67,
      chin: 0.25,
      lean: 0.12,
      A: 0.74,
      B: 0.06,
      C: -1.08,
      D: -1.5,
      roof: 1.44,
      roofC: 1.41,
      belt: 0.86,
      rise: 0.07,
      deck: null,
      w: 1.6,
      mF: 5,
      mR: 9,
      doors: [0.46, -0.12, -0.58],
      rows: [-0.78],
      cladding: false,
      roofSpoiler: true,
    },
    suv: {
      zf: 1.92,
      zr: -1.86,
      axF: 1.2,
      axR: -1.12,
      arch: 0.4,
      sill: 0.27,
      waist: 0.6,
      nose: 0.8,
      chin: 0.31,
      lean: 0.1,
      A: 0.86,
      B: 0.16,
      C: -1.22,
      D: -1.72,
      roof: 1.62,
      roofC: 1.58,
      belt: 0.98,
      rise: 0.05,
      deck: null,
      w: 1.7,
      mF: 6,
      mR: 9,
      doors: [0.6, -0.12, -0.68],
      rows: [-0.8],
      cladding: true,
      rails: true,
      roofSpoiler: true,
    },
    mpv: {
      zf: 1.92,
      zr: -1.98,
      axF: 1.2,
      axR: -1.18,
      arch: 0.37,
      sill: 0.22,
      waist: 0.56,
      nose: 0.72,
      chin: 0.26,
      lean: 0.14,
      A: 1.0,
      B: 0.36,
      C: -1.56,
      D: -1.86,
      roof: 1.66,
      roofC: 1.63,
      belt: 0.92,
      rise: 0.04,
      deck: null,
      w: 1.68,
      mF: 5,
      mR: 10,
      doors: [0.66, 0.0, -0.76],
      rows: [-0.6, -1.3],
      slide: true,
      rails: true,
    },
  };
  STYLES.taxi = Object.assign({}, STYLES.sedan, { sign: true, spoiler: false });
  /** Which door is which: [front right, front left, rear right, rear left] in that order everywhere. */
  const DOOR_SIDES = ["R", "L", "R", "L"];
  const derived = {};
  const smooth = (a, b, v) => P().smooth(a, b, v);
  const lerp = (a, b, t) => a + (b - a) * t;

  /** The tub's top line y(z): fascia top, sloping bonnet, belt along the doors, boot deck or tailgate. */
  function topLine(s) {
    const tailTop = s.deck === null ? s.belt + s.rise : s.deck;
    const pts = [
      [s.zf, s.nose - 0.08],
      [s.zf - 0.07, s.nose - 0.01],
      [s.zf - 0.25, s.nose + 0.04],
      [s.axF, s.nose + 0.08],
      [s.A, s.belt],
      [s.D, s.belt + s.rise],
      [s.zr + 0.3, tailTop + 0.005],
      [s.zr + 0.07, tailTop],
      [s.zr, tailTop - 0.08],
    ];
    if (s.deck === null) pts.splice(5, 1);
    return L().curve(pts);
  }

  /** The body's lowest line before the arches: the sill, rising to the chin at the nose and the tail. */
  function baseLine(s) {
    return L().curve([
      [s.zr, s.chin + 0.03],
      [s.zr + 0.4, s.sill],
      [s.zf - 0.45, s.sill],
      [s.zf, s.chin],
    ]);
  }

  /** Height of the bottom of the body at z: the base line, cut by a round arch (and a short ramp) over each axle. */
  function bottomAt(s, d, z) {
    let y = d.base(z);
    [s.axF, s.axR].forEach(function (ax) {
      const dz = Math.abs(z - ax);
      if (dz < s.arch) y = Math.max(y, WHEEL_Y + Math.sqrt(s.arch * s.arch - dz * dz));
      else if (dz < s.arch + 0.03) y = Math.max(y, lerp(WHEEL_Y, d.base(z), (dz - s.arch) / 0.03));
    });
    return y;
  }

  /** A soft bump of height 1 at z0 falling to 0 at distance w (the haunches over the wheels). */
  const bump = (z, z0, w) =>
    Math.abs(z - z0) > w ? 0 : Math.pow(Math.cos(((z - z0) / w) * PI * 0.5), 2);

  /** The tub's section at a station. */
  function tubSec(s, d, z) {
    const b = bottomAt(s, d, z);
    const t = d.top(z);
    const m = Math.min(Math.max(s.waist, b + 0.07), t - 0.06);
    const hw = s.w / 2 - 0.02 + 0.012 * bump(z, s.axF, 0.7) + 0.02 * bump(z, s.axR, 0.8);
    return { b, t, m, hwLo: hw, hwUp: hw, nLo: 4.5, nUp: 4.5, tuck: 0.075 };
  }

  /** Plan factor: a squircle in plan (rounded nose and tail corners). */
  function tubPlan(s, z) {
    const zc = (s.zf + s.zr) / 2;
    const front = z > zc;
    const u = Math.abs(z - zc) / Math.abs((front ? s.zf : s.zr) - zc);
    if (u >= 1) return 0;
    const m = front ? s.mF : s.mR;
    return Math.pow(1 - Math.pow(u, m), 1 / m);
  }

  /**
   * How far back the skin at station z, height y is set (the fascia leans back toward the bonnet; the tail's top
   * tucks forward a little).
   */
  function tubShear(s, z, y) {
    const tail = s.deck === null ? s.belt + s.rise : s.deck;
    const front =
      s.lean * smooth(s.chin + 0.08, s.nose + 0.02, y) * smooth(s.zf - 0.8, s.zf - 0.02, z);
    const rear = 0.07 * smooth(tail - 0.3, tail, y) * smooth(s.zr + 0.6, s.zr + 0.02, z);
    return front - rear;
  }

  /** The style's numbers and its curves (cached). */
  function style(name) {
    const key = STYLES[name] ? name : "sedan";
    if (derived[key]) return derived[key];
    const s = Object.assign({ name: key }, STYLES[key]);
    const d = { base: baseLine(s), top: topLine(s) };
    s.body = {
      zf: s.zf,
      zr: s.zr,
      sec: (st) => tubSec(s, d, st.z),
      plan: (z) => tubPlan(s, z),
      shear: (z, y) => tubShear(s, z, y),
    };
    s.top = d.top;
    s.gh = ghBody(s);
    s.doorSides = DOOR_SIDES;
    derived[key] = s;
    return s;
  }

  /** Which door (index into DOOR_SIDES) is at z on side sx (+1 left), or -1. */
  function doorAt(s, z, sx) {
    const [d0, d1, d2] = s.doors;
    const left = sx > 0 ? 1 : 0;
    if (z < d0 - 0.006 && z > d1 + 0.006) return left;
    if (z < d1 - 0.006 && z > d2 + 0.006) return 2 + left;
    return -1;
  }

  /** A hard colour seam: four entries, the middle two (tagged) make a thin strip `w` wide. */
  function seam(v, w, tag, key) {
    return [
      { [key]: v - w, tag: "" },
      { [key]: v - w, tag },
      { [key]: v + w, tag },
      { [key]: v + w, tag: "" },
    ];
  }

  /** The tub's ring angles (right half), bottom middle to top middle, with seams on the detailed tiers. */
  function tubRing(detail) {
    const fine = detail > 0.7;
    const pick = (lo, hi, n) =>
      Array.from({ length: n + 1 }, (_, i) => ({ a: lerp(lo, hi, i / n), tag: "" }));
    const ring = pick(-PI / 2, A_UNDER, fine ? 3 : 2).map((r) =>
      Object.assign(r, { tag: "under" }),
    );
    ring.push({ a: A_UNDER, tag: "" });
    ring.push(...pick(A_UNDER, A_DOOR_LO, fine ? 3 : 2).slice(1));
    if (fine) ring.push(...seam(A_DOOR_LO + 0.014, 0.012, "seamLo", "a"));
    ring.push(...pick(A_DOOR_LO + 0.03, A_SHOULDER, fine ? 9 : 5));
    ring.push({ a: A_SHOULDER, tag: "shoulder" });
    ring.push(
      ...pick(A_SHOULDER, A_HOOD - 0.014, fine ? 2 : 1)
        .slice(1)
        .map((r) => Object.assign(r, { tag: "top" })),
    );
    if (fine)
      ring.push(
        ...seam(A_HOOD, 0.012, "seamHood", "a").map((r) => Object.assign(r, { top: true })),
      );
    ring.push(
      ...pick(A_HOOD + 0.014, PI / 2, fine ? 5 : 3).map((r) => Object.assign(r, { tag: "top" })),
    );
    return ring;
  }

  /** The tub's stations: spread along the length plus arch ramps, door edges and the shut lines (fine tiers). */
  function tubStations(s, detail) {
    const fine = detail > 0.7;
    const extra = [];
    [s.axF, s.axR].forEach((ax) =>
      [-1, 1].forEach((k) =>
        extra.push(ax + k * s.arch, ax + k * (s.arch + 0.03), ax + k * s.arch * 0.6),
      ),
    );
    s.doors.forEach((z) => extra.push(...(fine ? seam(z, 0.005, "seam", "z") : [z])));
    extra.push(s.A, s.D);
    if (fine) extra.push(...seam(s.zf - 0.22, 0.005, "seamHoodF", "z"));
    if (fine && s.deck !== null) extra.push(...seam(s.D - 0.04, 0.005, "seamBoot", "z"));
    if (fine && s.deck === null) extra.push(...seam(s.zr + 0.12, 0.005, "seamGate", "z"));
    return L().stations(s.zr, s.zf, Math.round(34 * detail), extra, 5);
  }

  /** The tub's vertex colour at a grid point: underside, cladding, shut lines, the cabin floor; else paint. */
  function tubPaint(s, livery) {
    const [d0, , d2] = s.doors;
    return function (st, rg, y) {
      if (rg.tag === "under") return UNDER;
      if (s.cladding && rg.a < A_DOOR_LO) return CLAD;
      if (st.tag === "seam" && rg.a > A_DOOR_LO && rg.a < A_SHOULDER) return SEAM;
      if (rg.tag === "seamLo" && st.z < d0 && st.z > d2) return SEAM;
      if (
        (rg.a > A_SHOULDER + 0.001 || rg.tag === "shoulder") &&
        st.z < s.A - 0.01 &&
        st.z > s.D + 0.01
      )
        return INTERIOR;
      if (rg.tag === "seamHood" && (st.z > s.A + 0.02 || (s.deck !== null && st.z < s.D - 0.04)))
        return SEAM;
      if (st.tag === "seamHoodF" && rg.a > A_HOOD - 0.02) return SEAM;
      if ((st.tag === "seamBoot" || st.tag === "seamGate") && rg.a > A_SHOULDER - 0.2) return SEAM;
      if (livery) return y < s.belt - 0.06 ? livery.lower : livery.upper;
      return null;
    };
  }

  /**
   * The tub as layer pieces: {"paint:body": geo, "paint:door0": geo ...}. Door skins stop at the sill seam and the
   * shoulder; the shut-line strips stay with the body (they read as the door jamb when a door opens).
   */
  function tub(s, detail, livery) {
    const cabin = (zc) => zc < s.A - 0.005 && zc > s.D + 0.005;
    const body = Object.assign({}, s.body, {
      owner: (zc, a, sx) => {
        if (a >= A_SHOULDER) return cabin(zc) ? "hole:body" : "paint:body";
        if (a <= A_DOOR_LO + 0.03) return "paint:body";
        const k = doorAt(s, zc, sx);
        if (k >= 0) return "paint:door" + k;
        return cabin(zc) ? "paint:cabin" : "paint:body";
      },
    });
    const out = L().loft(body, tubStations(s, detail), tubRing(detail), tubPaint(s, livery));
    delete out["hole:body"];
    return out;
  }

  /** The greenhouse's roof line y(z): windscreen rolling into a crowned roof, then the rear glass. */
  function roofLine(s, base) {
    return L().curve([
      [s.A, base(s.A)],
      [lerp(s.A, s.B, 0.5), lerp(base(s.A), s.roof, 0.56)],
      [s.B, s.roof - 0.018],
      [lerp(s.B, s.C, 0.4), s.roof],
      [s.C, s.roofC],
      [lerp(s.C, s.D, 0.5), lerp(s.roofC, base(s.D), 0.58)],
      [s.D, base(s.D)],
    ]);
  }

  /** The greenhouse body: base on the tub's shoulder, top on the roof line, sides leaning in to the roof. */
  function ghBody(s) {
    const at = (z) => L().point(s.body, { z }, A_SHOULDER);
    const base = (z) => at(z)[1] - 0.012;
    const roof = roofLine(s, base);
    return {
      zf: s.A,
      zr: s.D,
      sec: function (st) {
        const hw = Math.max(0.05, at(st.z)[0] - 0.012);
        const t = Math.max(roof(st.z), base(st.z) + 0.0005);
        return {
          b: base(st.z) - 0.001,
          t,
          m: base(st.z),
          hwLo: hw,
          hwUp: hw,
          nLo: 2,
          nUp: G_N,
          tuck: hw * 0.2,
        };
      },
      plan: () => 1,
    };
  }

  /** The layer and owner of a greenhouse quad at (z, ring angle a) on side sx. */
  function ghOwner(s, zc, a, sx) {
    const k = doorAt(s, zc, sx);
    const own = (layer) => layer + ":" + (k < 0 ? "body" : "door" + k);
    if (a < G_SEAL) return own("trim");
    if (a < G_SIDE) return ghSide(s, zc, k, own);
    if (a < G_FRAME) return own("trim");
    if (a < G_CORNER) return zc > s.B || zc < s.C ? "paint:body" : "roof:body";
    return zc > s.B + 0.01 || zc < s.C - 0.01 ? "glass:body" : "roof:body";
  }

  /** The side band: black sail ahead of the front door, black B pillar, door glass, quarter glass or C pillar. */
  function ghSide(s, zc, k, own) {
    const [d0, d1, d2] = s.doors;
    if (zc > d0) return "trim:body";
    if (Math.abs(zc - d1) < 0.05) return "trim:body";
    if (k >= 0) return own("glass");
    if (zc < s.D + 0.12 || (s.deck !== null && zc < d2 - 0.1)) return "paint:body";
    return zc < d2 - 0.02 ? "glass:body" : "trim:body";
  }

  /** The greenhouse's stations: door edges, pillar edges, windscreen top and roof end. */
  function ghStations(s, detail) {
    const [d0, d1, d2] = s.doors;
    const extra = [
      d0,
      d1 - 0.05,
      d1,
      d1 + 0.05,
      d2,
      d2 - 0.02,
      d2 - 0.1,
      s.B,
      s.B + 0.01,
      s.C,
      s.C - 0.01,
      s.D + 0.12,
    ];
    return L().stations(
      s.D,
      s.A,
      Math.round(22 * detail),
      extra.filter((z) => z < s.A && z > s.D),
      2,
    );
  }

  /** The greenhouse's ring (right half): seal, side glass, frame, corner, top. */
  function ghRing(detail) {
    const fine = detail > 0.7;
    const hs = fine ? [0, 0.07, 0.3, 0.55, 0.75, 0.86, 0.92, 0.96] : [0, 0.07, 0.45, 0.86, 0.92];
    const ws = fine ? [0.8, 0.66, 0.45, 0.22, 0] : [0.66, 0.3, 0];
    return hs.map((f) => ({ a: byH(f), tag: "" })).concat(ws.map((g) => ({ a: byW(g), tag: "" })));
  }

  /** The greenhouse as layer pieces: glass, roof, paint (pillars) and trim (frames, seals, B pillar), by owner. */
  function greenhouse(s, detail) {
    const body = Object.assign({}, s.gh, { owner: (zc, a, sx) => ghOwner(s, zc, a, sx) });
    return L().loft(body, ghStations(s, detail), ghRing(detail), () => null);
  }

  F.VehicleCarShape = {
    style,
    tub,
    greenhouse,
    doorAt,
    STYLES: Object.keys(STYLES),
    WHEEL_Y,
    A_SHOULDER,
    A_DOOR_LO,
    COLOURS: { UNDER, CLAD, SEAM, INTERIOR },
  };
})((window.KQ = window.KQ || {}));
