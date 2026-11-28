/* ============================================================================
 * FILE: bigmap-draw.js
 * PURPOSE: Draws the full map's overlay on top of the base picture (map-base.js): the walking route to
 *          the go-here target, every establishment as a coloured icon disc with its name (decluttered
 *          by priority: an icon that would sit on a more important one waits until you zoom in, and a
 *          label that would hide something is left out), the mission objective (pink) and the
 *          neighbours with a mission, the go-here target (blue ring), and the hero's arrow with its
 *          heading. Returns what is on screen (for taps and for tests).
 * BUSINESS CONTEXT: playability round AC-P1 / P2 / P4 (labelled icons, hero position and heading,
 *   objective highlighted, the go-here target). Text is only drawn on the canvas.
 * DEPENDENCIES: minimap.js (hero arrow, glyph, palette), map-places.js, map-target.js, map-base.js,
 *   mission-flow.js, KQ.Sim.MapView.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const MV = () => KQ.Sim.MapView;
  const FONT = "700 12px system-ui, sans-serif";
  const INK = "#101014";
  /** Small stuff (car parks, bins) only shows once the map is zoomed in this far (pixels per metre). */
  const SMALL_PRIO = 7;
  const SMALL_SCALE = 3;

  /** Icon radius in window pixels: landmarks are bigger than the small stuff. */
  const radiusOf = (kind) => (kind.prio <= 2 ? 18 : kind.prio <= 4 ? 16 : 14);

  /** The places of a city that are in (or near) the window, as layout items (screen position, size, label size). */
  function placeItems(ctx, view, s, city, sel) {
    ctx.font = FONT;
    const out = [];
    out.zoomOnly = 0;
    G.MapPlaces.list(s, city).forEach(function (p) {
      const pt = MV().toScreen(view, p.x, p.z);
      if (!MV().inside(view, pt, 40)) return;
      const kind = KQ.PLACES.KINDS[p.kind];
      const force = p.id === sel || G.MapTarget.is(p);
      if (!force && kind.prio >= SMALL_PRIO && view.scale < SMALL_SCALE) {
        out.zoomOnly += 1; // small stuff waits for a closer zoom, but is still counted in the "+N more" hint
        return;
      }
      const lw = Math.ceil(ctx.measureText(p.label).width) + 8;
      out.push({
        id: p.id,
        place: p,
        kind,
        x: pt.x,
        y: pt.y,
        r: radiusOf(kind),
        prio: kind.prio,
        force,
        lw,
        lh: 16,
      });
    });
    return out;
  }

  /** A round badge: colour disc, dark rim, white icon (the Kaaba is a black cube with a gold band). */
  function badge(ctx, x, y, r, color, icon, ink) {
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.stroke();
    if (icon === "kaaba") {
      ctx.fillStyle = "#d9b04a";
      ctx.fillRect(x - r * 0.5, y - r * 0.12, r, r * 0.24);
    } else G.Minimap.glyph(ctx, icon, x, y, r * 1.3, ink || "#ffffff");
  }

  /** A word under or over an icon, white with a dark outline so it reads on any ground. */
  function text(ctx, str, cx, y, size) {
    ctx.font = "700 " + (size || 12) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.fillStyle = "#ffffff";
    ctx.strokeText(str, cx, y);
    ctx.fillText(str, cx, y);
  }

  /** The ring that marks the chosen place (white) and the go-here target (blue). */
  function rings(ctx, it) {
    const target = G.MapTarget.is(it.place);
    if (!target && !it.force) return;
    ctx.lineWidth = 4;
    ctx.strokeStyle = target ? G.MapTarget.COLOR : "#ffffff";
    ctx.beginPath();
    ctx.arc(it.x, it.y, it.r + 5, 0, 7);
    ctx.stroke();
  }

  /** Draw the kept icons (least important first, so the important ones sit on top), then their labels. */
  function drawPlaces(ctx, kept) {
    kept
      .slice()
      .reverse()
      .forEach(function (e) {
        const it = e.item;
        rings(ctx, it);
        badge(ctx, it.x, it.y, it.r, it.kind.color, it.kind.icon, it.kind.ink);
      });
    kept.forEach(function (e) {
      if (e.label)
        text(ctx, e.item.place.label, (e.label.x0 + e.label.x1) / 2, (e.label.y0 + e.label.y1) / 2);
    });
  }

  /** The route to the go-here target: a dashed blue line with a white edge. */
  function drawRoute(ctx, view, s) {
    const pts = G.MapTarget.route(s);
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    [
      ["#ffffff", 8, []],
      [G.MapTarget.COLOR, 4.5, [10, 8]],
    ].forEach(function (pass) {
      ctx.strokeStyle = pass[0];
      ctx.lineWidth = pass[1];
      ctx.setLineDash(pass[2]);
      ctx.beginPath();
      pts.forEach(function (p, i) {
        const q = MV().toScreen(view, p.x, p.z);
        if (i) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      });
      ctx.stroke();
    });
    ctx.restore();
  }

  /** A triangle on the window's edge pointing at an off-screen point (the mission objective). */
  function edgePointer(ctx, view, pt, color) {
    const cx = view.w / 2;
    const cy = view.h / 2;
    const ang = Math.atan2(pt.y - cy, pt.x - cx);
    const k = Math.min(
      (view.w / 2 - 26) / Math.abs(Math.cos(ang) || 1e-6),
      (view.h / 2 - 26) / Math.abs(Math.sin(ang) || 1e-6),
    );
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 13);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** The mission objective (pink pin, or a pink edge pointer when it is off screen) and the neighbours with a mission. */
  function drawMission(ctx, view) {
    const t = G.MissionFlow.targetPos();
    if (!t) return;
    const pt = MV().toScreen(view, t.x, t.z);
    const color = G.MapMarkers.COLORS.objective;
    if (!MV().inside(view, pt, -14)) return edgePointer(ctx, view, pt, color);
    badge(ctx, pt.x, pt.y, 20, color, "pin", "#ffffff");
    text(ctx, "Mission", pt.x, pt.y + 32, 13);
  }

  /** The hero: a halo you can find from far away, the blue arrow turned to the heading, and "You". */
  function drawHero(ctx, view, s) {
    const P = s.player;
    const pt = MV().toScreen(view, P.pos.x, P.pos.z);
    ctx.fillStyle = "rgba(61,107,255,0.25)";
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 24, 0, 7);
    ctx.fill();
    ctx.stroke();
    G.Minimap.drawHero(ctx, pt.x, pt.y, 300, Math.PI - P.heading);
    text(ctx, "You", pt.x, pt.y + 38, 13);
  }

  /**
   * Draw the whole overlay for a city onto an already painted base. ui: { sel (selected place id),
   * showHero }. Returns { hits: the layout items on screen (for taps), kept: their layout entries }.
   */
  function render(ctx, view, s, city, ui) {
    drawRoute(ctx, view, s);
    const items = placeItems(ctx, view, s, city, ui.sel);
    const kept = MV().layout(items, 3);
    drawPlaces(ctx, kept);
    if (ui.showHero) {
      drawMission(ctx, view);
      drawHero(ctx, view, s);
    }
    return {
      hits: kept.map((e) => e.item),
      kept,
      hidden: items.length - kept.length + items.zoomOnly,
    };
  }

  G.BigMapDraw = { render, radiusOf };
})((window.KQ = window.KQ || {}));
