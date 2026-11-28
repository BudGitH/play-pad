/* ============================================================================
 * FILE: map-view.js
 * PURPOSE: The pure maths of the full map (KQ.Sim.MapView): a view = a window onto the world with a
 *          scale (pixels per metre) and a centre; zoom about a point, pan, clamp to the world, resize,
 *          world <-> screen, the icon / label layout that keeps a crowded map readable, the
 *          vehicle-park clustering and the "have I arrived" test.
 * BUSINESS CONTEXT: playability round AC-P2 / P3 / P4 (features/kampung-quest-playability): the map
 *   zooms (pinch, wheel, buttons), pans (drag), is clamped to the world, and a chosen place is
 *   cleared on arrival. No DOM, no THREE: unit-tested in tests/kampung-quest/map.test.mjs.
 * DEPENDENCIES: none. Views are plain objects and every function returns a new one (nothing mutates).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const Sim = (KQ.Sim = KQ.Sim || {});
  /** How far in the map zooms, as a multiple of the "whole world fits" scale. */
  const ZOOM_MAX = 8;
  /** One tap on + / - changes the scale by this factor. */
  const ZOOM_STEP = 1.6;
  /** Arrived when the hero is within this many metres of a go-here target. */
  const ARRIVE_M = 4;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** The scale at which the whole world just fits a w x h window. */
  function fitScale(b, w, h) {
    return Math.min(w / (b.x1 - b.x0), h / (b.z1 - b.z0));
  }

  /** Keep one axis of the view inside the world: centred when the world is smaller than the window. */
  function clampAxis(c, lo, hi, halfWindowM) {
    if (hi - lo <= halfWindowM * 2) return (lo + hi) / 2;
    return clamp(c, lo + halfWindowM, hi - halfWindowM);
  }

  /** Clamp the scale to [min, max] and the centre so the window never leaves the world. */
  function fit(v) {
    const scale = clamp(v.scale, v.min, v.max);
    const b = v.bounds;
    return Object.assign({}, v, {
      scale,
      cx: clampAxis(v.cx, b.x0, b.x1, v.w / 2 / scale),
      cz: clampAxis(v.cz, b.z0, b.z1, v.h / 2 / scale),
    });
  }

  /** A view of the whole world `bounds` {x0, z0, x1, z1} in a w x h pixel window (fully zoomed out). */
  function create(bounds, w, h) {
    const min = fitScale(bounds, w, h);
    return fit({
      bounds,
      w,
      h,
      min,
      max: min * ZOOM_MAX,
      scale: min,
      cx: (bounds.x0 + bounds.x1) / 2,
      cz: (bounds.z0 + bounds.z1) / 2,
    });
  }

  /** How far in the view is: 1 = the whole world, ZOOM_MAX = closest. */
  const level = (v) => v.scale / v.min;

  /** World (x, z) metres -> window pixels. */
  function toScreen(v, x, z) {
    return { x: v.w / 2 + (x - v.cx) * v.scale, y: v.h / 2 + (z - v.cz) * v.scale };
  }

  /** Window pixels -> world (x, z) metres. */
  function toWorld(v, sx, sy) {
    return { x: v.cx + (sx - v.w / 2) / v.scale, z: v.cz + (sy - v.h / 2) / v.scale };
  }

  /** Zoom by `factor` keeping the world point under window pixel (sx, sy) where it is (pinch / wheel / buttons). */
  function zoomAt(v, factor, sx, sy) {
    const at = toWorld(v, sx, sy);
    const scale = clamp(v.scale * factor, v.min, v.max);
    return fit(
      Object.assign({}, v, {
        scale,
        cx: at.x - (sx - v.w / 2) / scale,
        cz: at.z - (sy - v.h / 2) / scale,
      }),
    );
  }

  /** Drag the map by (dx, dy) window pixels (the map follows the finger). */
  function panBy(v, dx, dy) {
    return fit(Object.assign({}, v, { cx: v.cx - dx / v.scale, cz: v.cz - dy / v.scale }));
  }

  /** Centre the window on a world point (the "centre on me" button), keeping the zoom. */
  function centreOn(v, x, z) {
    return fit(Object.assign({}, v, { cx: x, cz: z }));
  }

  /** The window changed size (rotation, resize): keep the zoom level and the centre. */
  function resize(v, w, h) {
    const lv = level(v);
    const min = fitScale(v.bounds, w, h);
    return fit(Object.assign({}, v, { w, h, min, max: min * ZOOM_MAX, scale: min * lv }));
  }

  /** Is a window pixel inside the window? */
  const inside = (v, p, pad) =>
    p.x >= -(pad || 0) && p.y >= -(pad || 0) && p.x <= v.w + (pad || 0) && p.y <= v.h + (pad || 0);

  /** Do a circle {x, y, r} and a rectangle {x0, y0, x1, y1} touch? */
  function circleHitsRect(c, r) {
    const nx = clamp(c.x, r.x0, r.x1);
    const ny = clamp(c.y, r.y0, r.y1);
    return Math.hypot(c.x - nx, c.y - ny) < c.r;
  }

  /** Do two rectangles overlap? */
  const rectsOverlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

  /** The label box of an item under its icon (or above it), `lw` x `lh` pixels. */
  function labelBox(it, above) {
    const y0 = above ? it.y - it.r - 3 - it.lh : it.y + it.r + 3;
    return { x0: it.x - it.lw / 2, y0, x1: it.x + it.lw / 2, y1: y0 + it.lh };
  }

  /** Is there room for this label: clear of every kept icon (but its own) and every kept label? */
  function labelFits(box, own, kept, boxes) {
    if (kept.some((k) => k !== own && circleHitsRect(k, box))) return false;
    return !boxes.some((b) => rectsOverlap(b, box));
  }

  /** Find a free spot for an item's label (below, else above); null when there is none or no label. */
  function placeLabel(it, kept, boxes) {
    if (!it.lw) return null;
    const below = labelBox(it, false);
    if (labelFits(below, it, kept, boxes)) return below;
    const above = labelBox(it, true);
    return labelFits(above, it, kept, boxes) ? above : null;
  }

  /** The most important icons (prio up to this) are slid aside, not dropped, when they would sit on another. */
  const NUDGE_PRIO = 5;

  /** The first kept icon `it` would overlap (within `gap`), or null. */
  const clashWith = (it, kept, g) =>
    kept.find((k) => Math.hypot(k.x - it.x, k.y - it.y) < k.r + it.r + g) || null;

  /** Is the whole icon (its circle) inside a `box` {w, h} window? */
  const fullyIn = (it, box) =>
    it.x - it.r >= 0 && it.y - it.r >= 0 && it.x + it.r <= box.w && it.y + it.r <= box.h;

  /**
   * Bring an icon fully inside the window: as it is when it already is; a headline kind (prio up to
   * NUDGE_PRIO) is pulled in from the edge; a lesser one that would be cut off is null (it waits
   * until a pan or zoom shows it whole, and is counted in the "+N more" hint). No box = no limit.
   */
  function pullIn(it, box) {
    if (!box || fullyIn(it, box)) return it;
    if (it.prio > NUDGE_PRIO || box.w < it.r * 2 || box.h < it.r * 2) return null;
    return Object.assign({}, it, {
      x: clamp(it.x, it.r, box.w - it.r),
      y: clamp(it.y, it.r, box.h - it.r),
    });
  }

  /** The eight compass steps tried when a headline icon has to slide aside (first the straight ones). */
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
    [-0.7, 0.7],
    [0.7, -0.7],
    [-0.7, -0.7],
  ];

  /** The first spot, on a ring `d` pixels out (then 1.6 x out), that is inside the window and clear of every kept icon. */
  function slideTo(it, kept, g, d, box) {
    for (const ring of [d, d * 1.6]) {
      for (const [dx, dy] of DIRS) {
        const moved = Object.assign({}, it, { x: it.x + dx * ring, y: it.y + dy * ring });
        if ((!box || fullyIn(moved, box)) && !clashWith(moved, kept, g)) return moved;
      }
    }
    return null;
  }

  /**
   * Where an icon can sit: where it is when nothing is in the way; else, for a headline kind (prio up to
   * NUDGE_PRIO), a copy slid sideways or up / down until it is clear (a horse stable beside the camel yard
   * stays on the map); else null (it waits until the map is zoomed in). With a `box` {w, h} the icon
   * always ends fully inside the window, or is dropped.
   */
  function clearSpot(it, kept, g, box) {
    const home = pullIn(it, box);
    if (!home) return null;
    const hit = clashWith(home, kept, g);
    if (!hit) return home;
    if (home.prio > NUDGE_PRIO) return null;
    return slideTo(home, kept, g, hit.r + home.r + g, box);
  }

  /**
   * Declutter a map: items are {id, x, y (pixels), r (icon radius), prio (low wins), force, lw, lh
   * (label size, 0 = no label)}. Icons are kept in priority order unless they would overlap an icon
   * already kept (`force` items are always kept; a headline icon slides aside instead, see clearSpot);
   * then labels are placed where they hide nothing. `box` ({w, h}, the window) keeps every non-forced
   * icon fully on screen. Returns [{ item, label: box | null }] in priority order.
   */
  function layout(items, gap, box) {
    const g = gap == null ? 2 : gap;
    const sorted = items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => a.it.prio - b.it.prio || a.i - b.i);
    const kept = [];
    sorted.forEach(function (e) {
      const at = e.it.force ? e.it : clearSpot(e.it, kept, g, box);
      if (at) kept.push(at);
    });
    const boxes = [];
    return kept.map(function (it) {
      const label = placeLabel(it, kept, boxes);
      if (label) boxes.push(label);
      return { item: it, label };
    });
  }

  /** The kept item nearest to a tap (within `slop` pixels of its icon's edge), or null. */
  function pick(items, sx, sy, slop) {
    let best = null;
    let bd = Infinity;
    items.forEach(function (it) {
      const d = Math.hypot(it.x - sx, it.y - sy) - it.r;
      if (d <= slop && d < bd) {
        best = it;
        bd = d;
      }
    });
    return best;
  }

  /** Group points {x, z} into grid cells of `cell` metres; cells holding at least `min` points give their centre. */
  function clusterGrid(points, cell, min) {
    const cells = {};
    points.forEach(function (p) {
      const key = Math.floor(p.x / cell) + "," + Math.floor(p.z / cell);
      const c = cells[key] || (cells[key] = { x: 0, z: 0, n: 0 });
      c.x += p.x;
      c.z += p.z;
      c.n += 1;
    });
    return Object.keys(cells)
      .map((k) => ({ x: cells[k].x / cells[k].n, z: cells[k].z / cells[k].n, n: cells[k].n }))
      .filter((c) => c.n >= min)
      .sort((a, b) => a.x - b.x || a.z - b.z);
  }

  /** Has the hero arrived at a go-here target (within ARRIVE_M metres, or `r`)? */
  function arrived(hx, hz, tx, tz, r) {
    return Math.hypot(hx - tx, hz - tz) <= (r == null ? ARRIVE_M : r);
  }

  Sim.MapView = {
    ZOOM_MAX,
    ZOOM_STEP,
    ARRIVE_M,
    create,
    fit,
    level,
    toScreen,
    toWorld,
    zoomAt,
    panBy,
    centreOn,
    resize,
    inside,
    layout,
    pick,
    clusterGrid,
    arrived,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
