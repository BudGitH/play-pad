/* ============================================================================
 * FILE: minimap.js
 * PURPOSE: The round minimap (and the full map screen): roads, buildings, the hero's arrow and
 *          markers for the mission, the mosque (when a prayer is due), the hawker centre and home.
 * BUSINESS CONTEXT: AC-11 (a minimap arrow for the active mission), design D (minimap wrapped in
 *   the needs ring). Drawn from KQ.WorldParts.LAYOUT so it always matches the world.
 * DEPENDENCIES: KQ.WorldParts.LAYOUT, util.js. 2D canvas only (cheap: redrawn ~10 times a second).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const L = () => KQ.WorldParts.LAYOUT;
  const COLORS = {
    grass: "#3d6b43",
    road: "#4a4c52",
    walk: "#b9b2a2",
    block: "#d9cfba",
    hawker: "#d9822b",
    mosque: "#e6efe9",
    dome: "#2f9e6e",
    shop: "#c98a82",
    lib: "#9db2d6",
    play: "#e0b449",
    park: "#4f8a50",
  };
  let bg = null;

  /** Fill a world-space rectangle {x0, z0, x1, z1} with a colour. */
  function rect(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
  }

  /** Paint the whole town once, in world units (x east, z south). */
  function paintTown(ctx) {
    const lay = L();
    const h = lay.half;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(-h, -h, h * 2, h * 2);
    ctx.fillStyle = COLORS.walk;
    ctx.fillRect(-h, -lay.road.walk, h * 2, lay.road.walk * 2);
    ctx.fillRect(-lay.road.walk, -h, lay.road.walk * 2, h * 2);
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(-h, -lay.road.half, h * 2, lay.road.half * 2);
    ctx.fillRect(-lay.road.half, -h, lay.road.half * 2, h * 2);
    lay.blocks.forEach((b) => rect(ctx, b, COLORS.block));
    rect(ctx, lay.hawker, COLORS.hawker);
    rect(ctx, lay.shops, COLORS.shop);
    rect(ctx, lay.library, COLORS.lib);
    rect(ctx, lay.mosque.hall, COLORS.mosque);
    rect(ctx, lay.playground, COLORS.play);
    rect(ctx, lay.park, COLORS.park);
    ctx.fillStyle = COLORS.dome;
    ctx.beginPath();
    ctx.arc(
      (lay.mosque.hall.x0 + lay.mosque.hall.x1) / 2,
      (lay.mosque.hall.z0 + lay.mosque.hall.z1) / 2,
      6,
      0,
      7,
    );
    ctx.fill();
  }

  /** The town drawn once into a cached offscreen canvas, reused by every minimap frame. */
  function background() {
    if (bg) return bg;
    const size = 512;
    bg = document.createElement("canvas");
    bg.width = bg.height = size;
    const ctx = bg.getContext("2d");
    const h = L().half;
    ctx.scale(size / (h * 2), size / (h * 2));
    ctx.translate(h, h);
    paintTown(ctx);
    return bg;
  }

  /** Convert a world position to minimap pixels for the current view (centre and span). */
  function toMap(x, z, view, cw) {
    return {
      x: cw / 2 + ((x - view.cx) / view.span) * cw,
      y: cw / 2 + ((z - view.cz) / view.span) * cw,
    };
  }

  /** Draw a marker dot at a world position, pinned to the map's edge when it is off the view. */
  function marker(ctx, m, view, cw) {
    const p = toMap(m.x, m.z, view, cw);
    const c = cw / 2;
    const dx = p.x - c;
    const dy = p.y - c;
    const len = Math.hypot(dx, dy);
    const lim = c - cw * 0.08;
    if (len > lim) {
      p.x = c + (dx / len) * lim;
      p.y = c + (dy / len) * lim;
    }
    ctx.fillStyle = m.color;
    ctx.strokeStyle = "#101014";
    ctx.lineWidth = Math.max(1.5, cw * 0.012);
    ctx.beginPath();
    ctx.arc(p.x, p.y, cw * (m.big ? 0.06 : 0.045), 0, 7);
    ctx.fill();
    ctx.stroke();
  }

  /** Draw the hero's arrow on the map, turned to their heading. */
  function heroArrow(ctx, cw, heading, view, hero) {
    const p = toMap(hero.x, hero.z, view, cw);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#101014";
    ctx.lineWidth = Math.max(1.5, cw * 0.012);
    const s = cw * 0.055;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.3);
    ctx.lineTo(s, s);
    ctx.lineTo(0, s * 0.45);
    ctx.lineTo(-s, s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw the map into a 2D canvas context (size cw x cw, circular).
   * view: { cx, cz, span (world metres across), hero:{x,z}, heading, markers:[{x,z,color,big}] }
   */
  function draw(ctx, cw, view, round) {
    ctx.clearRect(0, 0, cw, cw);
    ctx.save();
    if (round) {
      ctx.beginPath();
      ctx.arc(cw / 2, cw / 2, cw / 2 - 1, 0, 7);
      ctx.clip();
    }
    const h = L().half;
    const k = cw / view.span;
    ctx.fillStyle = "#1c2a1f";
    ctx.fillRect(0, 0, cw, cw);
    ctx.drawImage(
      background(),
      cw / 2 + (-h - view.cx) * k,
      cw / 2 + (-h - view.cz) * k,
      h * 2 * k,
      h * 2 * k,
    );
    view.markers.forEach((m) => marker(ctx, m, view, cw));
    heroArrow(ctx, cw, view.heading, view, view.hero);
    ctx.restore();
  }

  G.Minimap = { draw, background };
})((window.KQ = window.KQ || {}));
