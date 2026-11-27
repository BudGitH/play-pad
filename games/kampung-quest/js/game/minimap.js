/* ============================================================================
 * FILE: minimap.js
 * PURPOSE: The GTA-style round radar (HUD) and the full map screen. The radar turns with the hero
 *          (the hero's arrow always points up, an "N" marker rides the rim), draws the roads in
 *          light grey on a dark town, and shows coloured blips with a small icon each: the
 *          objective (with an arrow on the rim when it is off the radar), the mosque, food, a
 *          neighbour with a mission, home and, in the Haramain region, the Kaaba and the Prophet's
 *          Mosque. The full map is the same picture, north-up, with word labels.
 * BUSINESS CONTEXT: AC-11 (a radar arrow for the active mission), design D. Drawn from
 *   KQ.WorldParts.LAYOUT (Kampung) or KQ.HOLY (Haramain) so it always matches the world.
 * DEPENDENCIES: KQ.WorldParts.LAYOUT, KQ.HOLY, pictures.js (icon paths), util.js. 2D canvas only
 *   (cheap vector fills, redrawn ~10 times a second).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const L = () => KQ.WorldParts.LAYOUT;
  const PAL = {
    void: "#16211a",
    grass: "#36563c",
    walk: "#7f8c7d",
    road: "#e9e7e0",
    edge: "#2b2e35",
    dash: "#a9a69c",
    block: "#a79c86",
    hawker: "#d9822b",
    mosque: "#e6efe9",
    dome: "#2f9e6e",
    shop: "#c98a82",
    lib: "#8ea6cf",
    play: "#e0b449",
    park: "#4b8a50",
    sand: "#cdbd93",
    marble: "#f1ece0",
    ink: "#101014",
    hero: "#3d6bff",
    north: "#ff5a5f",
  };
  /** Radar and full-map widths in metres, per region. */
  const SPANS = { kampung: { radar: 80, full: 150 }, haramain: { radar: 90, full: 340 } };
  const region = () => (KQ.region === "haramain" && KQ.HOLY ? "haramain" : "kampung");

  /** Fill a world-space rectangle {x0, z0, x1, z1} with a colour. */
  function rect(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
  }

  /** Fill a world-space disc. */
  function disc(ctx, x, z, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, z, r, 0, 7);
    ctx.fill();
  }

  /** Paint both roads: a muted pavement band, a light carriageway with dark kerbs, a dashed centre line. */
  function paintRoads(ctx, lay) {
    const h = lay.half;
    const w = lay.road.walk;
    const r = lay.road.half;
    ctx.fillStyle = PAL.walk;
    ctx.fillRect(-h, -w, h * 2, w * 2);
    ctx.fillRect(-w, -h, w * 2, h * 2);
    ctx.fillStyle = PAL.edge;
    ctx.fillRect(-h, -r - 0.5, h * 2, r * 2 + 1);
    ctx.fillRect(-r - 0.5, -h, r * 2 + 1, h * 2);
    ctx.fillStyle = PAL.road;
    ctx.fillRect(-h, -r, h * 2, r * 2);
    ctx.fillRect(-r, -h, r * 2, h * 2);
    ctx.strokeStyle = PAL.dash;
    ctx.lineWidth = 0.45;
    ctx.setLineDash([2.4, 2.4]);
    ctx.beginPath();
    ctx.moveTo(-h, 0);
    ctx.lineTo(h, 0);
    ctx.moveTo(0, -h);
    ctx.lineTo(0, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Paint the whole Kampung once per frame, in world units (x east, z south). */
  function paintTown(ctx) {
    const lay = L();
    const h = lay.half;
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(-h, -h, h * 2, h * 2);
    rect(ctx, lay.park, PAL.park);
    rect(ctx, lay.playground, PAL.play);
    lay.linkways.forEach((r) => rect(ctx, r, PAL.walk));
    paintRoads(ctx, lay);
    lay.blocks.forEach((b) => rect(ctx, b, PAL.block));
    rect(ctx, lay.hawker, PAL.hawker);
    rect(ctx, lay.shops, PAL.shop);
    rect(ctx, lay.library, PAL.lib);
    rect(ctx, lay.mosque.hall, PAL.mosque);
    const hall = lay.mosque.hall;
    disc(ctx, (hall.x0 + hall.x1) / 2, (hall.z0 + hall.z1) / 2, 6, PAL.dome);
  }

  /** Round discs of the Haramain region: [KQ.HOLY path, colour]. */
  const HOLY_DISCS = [
    ["makkah.mataf", PAL.marble],
    ["makkah.zamzam", "#7fb8d9"],
    ["makkah.safa", "#c9a96b"],
    ["makkah.marwa", "#c9a96b"],
    ["makkah.clockTower", "#8a93a0"],
    ["hajj.mina", "#e8dcc0"],
    ["hajj.arafah", "#d9c7a0"],
    ["hajj.muzdalifah", "#d9c7a0"],
    ["madinah.umbrellas", "#f3efe4"],
    ["madinah.quba", "#e6efe9"],
    ["madinah.greenDome", PAL.dome],
  ];
  /** Boxes of the Haramain region ({x, z, w, d} centre and size): [KQ.HOLY path, colour]. */
  const HOLY_BOXES = [
    ["madinah.nabawi", "#efeadc"],
    ["madinah.rawdah", PAL.dome],
    ["makkah.kaaba", "#15151a"],
  ];

  /** A site in KQ.HOLY by its dotted path ("makkah.kaaba"), or null. */
  function holy(path) {
    return path.split(".").reduce((o, k) => (o ? o[k] : null), KQ.HOLY) || null;
  }

  /** Paint the Haramain world: sand, the marble mataf, the sa'i lane, the sites and the Prophet's Mosque. */
  function paintHoly(ctx) {
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(-420, -420, 1400, 760);
    const lane = holy("makkah.masaLane");
    ctx.fillStyle = "#e8e0c8";
    ctx.fillRect(lane.x - lane.w / 2, lane.z0, lane.w, lane.z1 - lane.z0);
    HOLY_DISCS.forEach(function (d) {
      const p = holy(d[0]);
      if (p) disc(ctx, p.x, p.z, p.r, d[1]);
    });
    HOLY_BOXES.forEach(function (b) {
      const o = holy(b[0]);
      if (!o) return;
      ctx.fillStyle = b[1];
      ctx.fillRect(o.x - o.w / 2, o.z - o.d / 2, o.w, o.d);
    });
  }

  /** The frame of one draw: scale, rotation (the radar turns with the hero), centre and view centre. */
  function frameOf(cw, view) {
    const a = view.rotate ? view.heading + Math.PI : 0;
    return { k: cw / view.span, a, cos: Math.cos(a), sin: Math.sin(a), c: cw / 2, view };
  }

  /** World position -> canvas pixels under the frame (the same maths as the canvas transform). */
  function project(f, x, z) {
    const dx = (x - f.view.cx) * f.k;
    const dz = (z - f.view.cz) * f.k;
    return { x: f.c + dx * f.cos - dz * f.sin, y: f.c + dx * f.sin + dz * f.cos };
  }

  /** Run `fn(ctx)` with the canvas set to world units (rotated and scaled like `project`). */
  function inWorld(ctx, f, fn) {
    ctx.save();
    ctx.translate(f.c, f.c);
    ctx.rotate(f.a);
    ctx.scale(f.k, f.k);
    ctx.translate(-f.view.cx, -f.view.cz);
    fn(ctx);
    ctx.restore();
  }

  /** Fill a canvas icon path (24 x 24 viewBox, from pictures.js) centred at (x, y) with size `s`. */
  function glyph(ctx, name, x, y, s, color) {
    const icons = G.Pictures && G.Pictures.ICONS;
    if (!icons || !icons[name]) return;
    ctx.save();
    ctx.translate(x - s / 2, y - s / 2);
    ctx.scale(s / 24, s / 24);
    ctx.fillStyle = color;
    ctx.fill(new Path2D(icons[name]));
    ctx.restore();
  }

  /** One blip: a coloured disc with a dark rim and a small white icon (the Kaaba is a drawn cube). */
  function blipAt(ctx, p, m, r) {
    ctx.fillStyle = m.color;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 7);
    ctx.fill();
    ctx.stroke();
    if (m.kind === "kaaba") {
      ctx.fillStyle = "#d9b04a";
      ctx.fillRect(p.x - r * 0.55, p.y - r * 0.12, r * 1.1, r * 0.24);
    } else {
      glyph(ctx, m.icon, p.x, p.y, r * 1.35, m.ink || "#ffffff");
    }
  }

  /** A triangle on the rim pointing at an off-radar target (the objective, a due mosque). */
  function edgeArrow(ctx, f, m, cw) {
    const p = project(f, m.x, m.z);
    const ang = Math.atan2(p.y - f.c, p.x - f.c);
    const rim = f.c - cw * 0.07;
    const s = cw * 0.075;
    ctx.save();
    ctx.translate(f.c + Math.cos(ang) * rim, f.c + Math.sin(ang) * rim);
    ctx.rotate(ang);
    ctx.fillStyle = m.color;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = Math.max(1.5, cw * 0.012);
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.8, s * 0.9);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.8, -s * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** A word label under a blip (the full map only). */
  function blipLabel(ctx, p, m, cw) {
    ctx.font = "700 " + Math.round(cw * 0.032) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = PAL.ink;
    ctx.fillStyle = "#ffffff";
    ctx.strokeText(m.label, p.x, p.y + cw * 0.085);
    ctx.fillText(m.label, p.x, p.y + cw * 0.085);
  }

  /** Is a projected point inside the round radar (or the square map)? */
  function onMap(p, cw, round) {
    const lim = cw / 2 - cw * 0.07;
    return round ? Math.hypot(p.x - cw / 2, p.y - cw / 2) <= lim : p.x > 0 && p.x < cw;
  }

  /** Draw one marker: a blip in view; else a rim arrow (objective), a rim blip (big, or a landmark) or nothing. */
  function drawMarker(ctx, f, m, cw, round) {
    const p = project(f, m.x, m.z);
    const r = cw * (m.big ? 0.075 : 0.058);
    if (onMap(p, cw, round)) {
      blipAt(ctx, p, m, r);
      if (f.view.labels && m.label) blipLabel(ctx, p, m, cw);
    } else if (m.arrow && round) edgeArrow(ctx, f, m, cw);
    else if (m.big || m.rim) blipAt(ctx, clampRim(p, cw), m, r * (m.big ? 1 : 0.85));
  }

  /** Pin a projected point to the rim of the map. */
  function clampRim(p, cw) {
    const c = cw / 2;
    const dx = p.x - c;
    const dy = p.y - c;
    const len = Math.max(1, Math.hypot(dx, dy));
    const lim = c - cw * 0.08;
    const k = Math.min(1, lim / len);
    return { x: c + dx * k, y: c + dy * k };
  }

  /** The "N" marker: a small red disc on the rim in the direction of north (always the top on the full map). */
  function northMark(ctx, f, cw) {
    const rim = f.c - cw * 0.075;
    const x = f.c + Math.sin(f.a) * rim;
    const y = f.c - Math.cos(f.a) * rim;
    ctx.fillStyle = PAL.north;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = Math.max(1.5, cw * 0.012);
    ctx.beginPath();
    ctx.arc(x, y, cw * 0.058, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.font = "800 " + Math.round(cw * 0.07) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("N", x, y + cw * 0.004);
    ctx.textBaseline = "alphabetic";
  }

  /** The hero: a soft view cone and a royal-blue arrow with a white rim, drawn in the middle (turned to the heading on a north-up map). */
  function heroArrow(ctx, f, cw) {
    const turn = f.view.rotate ? 0 : Math.PI - f.view.heading;
    ctx.save();
    ctx.translate(f.c, f.c);
    ctx.rotate(turn);
    const cone = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 0.3);
    cone.addColorStop(0, "rgba(255,255,255,0.4)");
    cone.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, cw * 0.3, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62);
    ctx.closePath();
    ctx.fill();
    const s = cw * 0.06;
    ctx.fillStyle = PAL.hero;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, cw * 0.018);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.4);
    ctx.lineTo(s, s);
    ctx.lineTo(0, s * 0.4);
    ctx.lineTo(-s, s);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw the map into a 2D canvas context (size cw x cw).
   * view: { cx, cz, span (world metres across), hero:{x,z}, heading, rotate (the radar turns with
   *   the hero), labels (word labels, full map), markers:[{x, z, color, big, kind, icon, arrow, label}] }
   * `round` clips to a circle (the radar).
   */
  function draw(ctx, cw, view, round) {
    const f = frameOf(cw, view);
    ctx.clearRect(0, 0, cw, cw);
    ctx.save();
    if (round) {
      ctx.beginPath();
      ctx.arc(cw / 2, cw / 2, cw / 2 - 1, 0, 7);
      ctx.clip();
    }
    ctx.fillStyle = PAL.void;
    ctx.fillRect(0, 0, cw, cw);
    inWorld(ctx, f, region() === "haramain" ? paintHoly : paintTown);
    view.markers.forEach((m) => drawMarker(ctx, f, m, cw, round));
    heroArrow(ctx, f, cw);
    northMark(ctx, f, cw);
    ctx.restore();
  }

  /** How many metres across the radar and the full map show in this region. */
  const radarSpan = () => SPANS[region()].radar;
  const fullSpan = () => SPANS[region()].full;

  /** The full map's view options: word labels, and in the Kampung centred on the whole town (not on the hero). */
  const fullOpts = () =>
    region() === "kampung" ? { labels: true, cx: 0, cz: 0 } : { labels: true };

  G.Minimap = { draw, radarSpan, fullSpan, fullOpts };
})((window.KQ = window.KQ || {}));
