/* ============================================================================
 * FILE: bigmap.js
 * PURPOSE: The full map screen (KQ.Game.BigMap): a near-full-screen sheet that shows the WHOLE region
 *          (the kampung, or Makkah / Madinah with a switch) on a canvas. Drag to move, pinch / wheel /
 *          the + and - buttons to zoom (clamped to the world), "centre on me", a Places list that is also the
 *          legend, a name card with a "Go here" button for the place you tap, and the walking route to
 *          it. Keyboard: arrows / WASD move, + and - zoom, 0 shows everything, C centres on you; Esc,
 *          the Close button or a tap on the backdrop close it. Opening it opens the usual modal sheet, so
 *          the hero cannot be steered while it is up (the same pattern as every other screen).
 * BUSINESS CONTEXT: playability round AC-P2 / P3 / P4 (features/kampung-quest-playability). Controls are
 *   >= 48 px; text enters the DOM through textContent only (U.el); the picture is map-base.js (painted
 *   once per city) plus bigmap-draw.js (the overlay, painted only while open).
 * DEPENDENCIES: ui-core.js (openSheet, btn, header), map-places.js, map-target.js, map-base.js,
 *   bigmap-draw.js, pictures.js, KQ.Sim.MapView.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const MV = () => KQ.Sim.MapView;
  const CITY_NAME = { kampung: "the kampung", makkah: "Makkah", madinah: "Madinah" };
  const KEY_PAN = 90;
  const TAP_SLOP = 6;
  const FOCUS_LEVEL = 4;
  const B = { open: false, refs: {}, ptrs: new Map() };

  /** The place being shown on the card, or null. */
  const selected = () => (B.sel ? G.MapPlaces.find(G.S, B.city, B.sel) : null);

  /** Draw now (taps, buttons, keys) ... */
  function render() {
    B.raf = 0;
    if (!B.open || !B.view) return;
    const c = B.refs.ctx;
    c.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
    G.MapBase.draw(c, B.view, G.S, B.city);
    const out = G.BigMapDraw.render(c, B.view, G.S, B.city, {
      sel: B.sel,
      showHero: B.city === B.heroCity,
    });
    B.hits = out.hits;
    B.sig = signature();
    showMore(out.hidden);
  }

  /** The "+N more" hint: some places in the window wait for a closer zoom (or the Places list). */
  function showMore(n) {
    const more = B.refs.more;
    if (!more) return;
    more.hidden = !(n > 0);
    more.textContent = n > 0 ? "+" + n + " more: zoom in or open Places" : "";
  }

  /** ... or at the next frame (a drag or a wheel fires many events per frame). */
  function schedule() {
    if (B.open && !B.raf) B.raf = requestAnimationFrame(render);
  }

  /** What changes the picture besides the view: the hero's spot and heading, the target, the mission. */
  function signature() {
    const P = G.S.player;
    const t = G.MapTarget.active();
    const m = G.MissionFlow.targetPos();
    return [P.pos.x.toFixed(1), P.pos.z.toFixed(1), P.heading.toFixed(2), t && t.id, m && m.x].join(
      "|",
    );
  }

  /** Make the canvas match the stage (and the screen's pixel density) and keep the zoom through a resize. */
  function measure() {
    const r = B.refs.stage.getBoundingClientRect();
    const w = Math.max(120, Math.floor(r.width));
    const h = Math.max(120, Math.floor(r.height));
    if (B.view && B.view.w === w && B.view.h === h) return false;
    B.dpr = Math.min(window.devicePixelRatio || 1, 2);
    B.refs.canvas.width = Math.round(w * B.dpr);
    B.refs.canvas.height = Math.round(h * B.dpr);
    const bounds = G.MapPlaces.bounds(B.city);
    B.view = B.view ? MV().resize(B.view, w, h) : MV().create(bounds, w, h);
    return true;
  }

  /** The window changed size (rotation, the Places panel): refit and redraw. */
  function onResize() {
    if (B.open && measure()) render();
  }

  /** Replace the view and draw. */
  function setView(v) {
    B.view = v;
    render();
  }

  const zoomBy = (f) => setView(MV().zoomAt(B.view, f, B.view.w / 2, B.view.h / 2));
  const reset = () => setView(MV().create(B.view.bounds, B.view.w, B.view.h));

  /** Show the city the hero is in and put the view on the hero (the "centre on me" button). */
  function centreMe() {
    if (B.city !== B.heroCity) setCity(B.heroCity);
    const P = G.S.player;
    setView(MV().centreOn(B.view, P.pos.x, P.pos.z));
  }

  /** Switch the city shown (Haramain only): a fresh whole-city view, nothing selected. */
  function setCity(city) {
    B.city = city;
    B.sel = null;
    B.view = MV().create(G.MapPlaces.bounds(city), B.view.w, B.view.h);
    buildList();
    refreshCard();
    markCityButtons();
    render();
  }

  /** Select a place (null = none): its card shows; the screen reader hears its name. */
  function select(id) {
    B.sel = id;
    refreshCard();
    const p = selected();
    if (p) G.UI.announce(p.label + ". " + infoText(p));
    render();
  }

  /** Zoom to a place and select it (a Places list row, and the tests' way to reveal one). */
  function focus(id) {
    const p = G.MapPlaces.find(G.S, B.city, id);
    if (!p) return false;
    const lv = Math.max(MV().level(B.view), FOCUS_LEVEL);
    const base = MV().create(B.view.bounds, B.view.w, B.view.h);
    B.view = MV().centreOn(
      Object.assign({}, base, { scale: Math.min(base.max, base.min * lv) }),
      p.x,
      p.z,
    );
    select(id);
    return true;
  }

  /** The line under a place's name on its card: how far, or that it is in the other city. */
  function infoText(p) {
    if (p.city !== B.heroCity)
      return "This is in " + CITY_NAME[p.city] + ". Take the bus to get there.";
    const h = G.S.player.pos;
    const d = Math.hypot(p.x - h.x, p.z - h.z);
    if (d <= p.reach) return "You are here!";
    return "About " + Math.max(10, Math.round(d / 10) * 10) + " m away.";
  }

  /** A kind's chip colours: its colour, and its own ink for the icon when the kind has one (contrast). */
  const chipStyle = (k) => "background:" + k.color + (k.ink ? ";color:" + k.ink : "");

  /** The name card: a colour chip with the icon, the name, how far, and Go here / Stop going here. */
  function refreshCard() {
    const card = B.refs.card;
    const p = selected();
    card.hidden = !p;
    U.clear(card);
    if (!p) return;
    const k = KQ.PLACES.KINDS[p.kind];
    B.refs.dist = U.el("p", { cls: "kq-small kq-bm-dist", text: infoText(p) });
    const chip = U.el("span", { cls: "kq-bm-chip", style: chipStyle(k) }, G.Pictures.icon(k.icon));
    const close = G.UI.btn("", {
      icon: "close",
      cls: "kq-icon-btn",
      label: "Close name card",
      onClick: () => select(null),
    });
    const head = U.el(
      "div",
      { cls: "kq-bm-cardhead" },
      chip,
      U.el("h3", { cls: "kq-h3", text: p.label }),
      close,
    );
    card.appendChild(head);
    card.appendChild(B.refs.dist);
    B.refs.goBtn = p.city === B.heroCity ? goButton(p) : null;
    if (B.refs.goBtn) card.appendChild(B.refs.goBtn);
  }

  /** The Go here / Stop going here button of the card. */
  function goButton(p) {
    const on = G.MapTarget.is(p);
    return G.UI.btn(on ? "Stop going here" : "Go here", {
      cls: on ? "" : "primary",
      icon: "pin",
      onClick() {
        G.MapTarget.toggle(p);
        refreshCard();
        render();
        if (B.refs.goBtn) B.refs.goBtn.focus({ preventScroll: true }); // the card was rebuilt: keep focus on its toggle
      },
    });
  }

  /** The Places list (also the legend): one big button per place; tapping one zooms to it. */
  function buildList() {
    const list = B.refs.list;
    U.clear(list);
    list.appendChild(U.el("h3", { cls: "kq-h3", text: "Places" }));
    list.appendChild(
      U.el("p", {
        cls: "kq-small",
        text: "Blue arrow: you. Pink pin: your mission. Blue ring: where you are going. Tap a place to find it.",
      }),
    );
    G.MapPlaces.list(G.S, B.city)
      .slice()
      .sort((a, b) => KQ.PLACES.KINDS[a.kind].prio - KQ.PLACES.KINDS[b.kind].prio)
      .forEach((p) => list.appendChild(listRow(p)));
  }

  /** One row of the Places list. */
  function listRow(p) {
    const k = KQ.PLACES.KINDS[p.kind];
    return U.el(
      "button",
      { type: "button", cls: "kq-bm-item", "data-place": p.id, on: { click: () => focus(p.id) } },
      U.el("span", { cls: "kq-bm-chip", style: chipStyle(k) }, G.Pictures.icon(k.icon)),
      U.el("span", { text: p.label }),
    );
  }

  /** Open or fold the Places panel (open by default when the screen is wide). */
  function toggleList(on) {
    B.listOpen = on == null ? !B.listOpen : on;
    B.refs.list.classList.toggle("is-open", B.listOpen);
    B.refs.listBtn.setAttribute("aria-expanded", String(B.listOpen));
    onResize();
  }

  /** A tap on the map: the nearest icon is selected; a tap on the selected target again stops going there. */
  function onTap(x, y) {
    const hit = MV().pick(B.hits, x, y, 10);
    const p = hit ? hit.place : null;
    if (p && B.sel === p.id && G.MapTarget.is(p)) G.MapTarget.clear();
    select(p ? p.id : null);
  }

  /** Pointer position in the canvas's own pixels. */
  function localXY(e) {
    const r = B.refs.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  const pair = () => Array.from(B.ptrs.values());
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  /** A finger or the mouse went down on the map. */
  function onDown(e) {
    try {
      B.refs.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      B.captureFailed = true; // a synthetic pointer: the move events still arrive on the canvas
    }
    const p = localXY(e);
    B.ptrs.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false });
    if (B.ptrs.size === 2) {
      const [a, b] = pair();
      B.pinch = { d: gap(a, b), m: mid(a, b) };
      pair().forEach((q) => (q.moved = true));
    }
  }

  /** Two fingers: zoom by how their gap changed, and follow their middle. */
  function pinchMove() {
    const [a, b] = pair();
    const d = Math.max(1, gap(a, b));
    const m = mid(a, b);
    let v = MV().zoomAt(B.view, d / B.pinch.d, m.x, m.y);
    v = MV().panBy(v, m.x - B.pinch.m.x, m.y - B.pinch.m.y);
    B.pinch = { d, m };
    B.view = v;
  }

  /** A finger or the mouse moved: one pointer drags the map, two pinch it. */
  function onMove(e) {
    const q = B.ptrs.get(e.pointerId);
    if (!q) return;
    const p = localXY(e);
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    q.x = p.x;
    q.y = p.y;
    if (B.ptrs.size >= 2) pinchMove();
    else {
      if (!q.moved && Math.hypot(p.x - q.sx, p.y - q.sy) > TAP_SLOP) q.moved = true;
      if (q.moved) B.view = MV().panBy(B.view, dx, dy);
    }
    schedule();
  }

  /** A finger or the mouse lifted: a short press that did not move is a tap. */
  function onUp(e) {
    const q = B.ptrs.get(e.pointerId);
    B.ptrs.delete(e.pointerId);
    if (!q) return;
    if (B.ptrs.size === 1) pair()[0].moved = true; // one finger left after a pinch: it pans, never taps
    if (!q.moved && e.type === "pointerup" && B.ptrs.size === 0) onTap(q.x, q.y);
  }

  /** The mouse wheel zooms about the pointer. */
  function onWheel(e) {
    e.preventDefault();
    const p = localXY(e);
    const k = e.deltaMode === 1 ? 0.05 : 0.0016;
    B.view = MV().zoomAt(B.view, Math.exp(-e.deltaY * k), p.x, p.y);
    schedule();
  }

  /** Keyboard: arrows / WASD move the map, + / - zoom, 0 shows everything, C centres on you. */
  function onKey(e) {
    const moves = {
      ArrowLeft: [1, 0],
      a: [1, 0],
      ArrowRight: [-1, 0],
      d: [-1, 0],
      ArrowUp: [0, 1],
      w: [0, 1],
      ArrowDown: [0, -1],
      s: [0, -1],
    };
    const m = moves[e.key];
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (m) setView(MV().panBy(B.view, m[0] * KEY_PAN, m[1] * KEY_PAN));
    else if (e.key === "+" || e.key === "=") zoomBy(MV().ZOOM_STEP);
    else if (e.key === "-" || e.key === "_") zoomBy(1 / MV().ZOOM_STEP);
    else if (e.key === "0") reset();
    else if (e.key === "c" || e.key === "C") centreMe();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  /** The zoom and centre buttons, stacked at the bottom right of the map. */
  function controls() {
    const b = (icon, label, fn) =>
      G.UI.btn("", { icon, cls: "kq-icon-btn kq-bm-btn", label, onClick: fn });
    return U.el(
      "div",
      { cls: "kq-bm-ctl" },
      b("plus", "Zoom in", () => zoomBy(MV().ZOOM_STEP)),
      b("minus", "Zoom out", () => zoomBy(1 / MV().ZOOM_STEP)),
      b("locate", "Centre on me", centreMe),
    );
  }

  /** The canvas with its pointer, wheel and keyboard handling. */
  function makeCanvas() {
    const canvas = U.el("canvas", {
      cls: "kq-bm-canvas",
      tabindex: "0",
      role: "application",
      "aria-roledescription": "map",
      "aria-label":
        "Map. Drag to move, pinch or use plus and minus to zoom, arrow keys move, 0 shows everything, C centres on you.",
    });
    ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((t) =>
      canvas.addEventListener(
        t,
        t === "pointerdown" ? onDown : t === "pointermove" ? onMove : onUp,
      ),
    );
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return canvas;
  }

  /** The Makkah / Madinah switch (Haramain only) and the Places toggle in the header. */
  function headerExtras() {
    const extras = [];
    B.refs.cityBtns = {};
    if (G.MapPlaces.cities(G.S).length > 1) {
      G.MapPlaces.cities(G.S).forEach(function (c) {
        const btn = G.UI.btn(c === "makkah" ? "Makkah" : "Madinah", {
          onClick: () => B.city !== c && setCity(c),
        });
        B.refs.cityBtns[c] = btn;
        extras.push(btn);
      });
    }
    B.refs.listBtn = G.UI.btn("Places", { icon: "list", onClick: () => toggleList() });
    B.refs.listBtn.setAttribute("aria-expanded", "false");
    extras.push(B.refs.listBtn);
    return extras;
  }

  /** Show which city is on screen on the switch (aria-pressed and a filled look). */
  function markCityButtons() {
    Object.keys(B.refs.cityBtns).forEach(function (c) {
      B.refs.cityBtns[c].setAttribute("aria-pressed", String(c === B.city));
      B.refs.cityBtns[c].classList.toggle("primary", c === B.city);
    });
  }

  /** Build the screen: header, the map with its controls and name card, and the Places panel. */
  function build() {
    const canvas = makeCanvas();
    B.refs.canvas = canvas;
    B.refs.ctx = canvas.getContext("2d");
    B.refs.card = U.el("div", {
      cls: "kq-bm-card",
      hidden: true,
      role: "group",
      "aria-label": "Place",
    });
    B.refs.more = U.el("p", { cls: "kq-bm-more", hidden: true });
    B.refs.stage = U.el(
      "div",
      { cls: "kq-bm-stage" },
      canvas,
      controls(),
      B.refs.card,
      B.refs.more,
    );
    B.refs.list = U.el("aside", { cls: "kq-bm-list", "aria-label": "Places" });
    const body = U.el("div", { cls: "kq-bm-body" }, B.refs.stage, B.refs.list);
    const root = U.el(
      "div",
      { cls: "kq-menu kq-bm" },
      G.UI.header("Map", { extras: headerExtras() }),
      body,
    );
    root.addEventListener("keydown", onKey);
    return root;
  }

  /** Stop listening and forget the screen (the sheet closed). */
  function teardown() {
    B.open = false;
    B.ptrs.clear();
    if (B.raf) cancelAnimationFrame(B.raf);
    B.raf = 0;
    window.removeEventListener("resize", onResize);
    if (B.ro) B.ro.disconnect();
    B.ro = null;
  }

  /**
   * Open the full map. ctx: { onClose }. The map starts on the city the hero is in, showing the whole of it;
   * the Places panel starts open when there is room beside the map.
   */
  function open(ctx) {
    B.heroCity = G.MapPlaces.cityNow(G.S);
    Object.assign(B, {
      city: B.heroCity,
      sel: null,
      view: null,
      hits: [],
      pinch: null,
      listOpen: false,
    });
    const root = build();
    const handle = G.UI.openSheet({
      el: root,
      label: "Map",
      variant: "full",
      focus: ".kq-bm-canvas",
      onClose(reason) {
        teardown();
        if (ctx && ctx.onClose) ctx.onClose(reason);
      },
    });
    B.open = true;
    measure();
    buildList();
    markCityButtons();
    window.addEventListener("resize", onResize);
    if (window.ResizeObserver) {
      B.ro = new ResizeObserver(onResize);
      B.ro.observe(B.refs.stage);
    }
    toggleList(window.innerWidth >= 900 && window.innerHeight >= 520);
    return handle;
  }

  /** From the loop's tick: redraw when the hero moved or the target changed; keep the card's distance fresh. */
  function refresh() {
    if (!B.open || !B.view || signature() === B.sig) return;
    render();
    if (selected()) B.refs.dist.textContent = infoText(selected());
    if (B.cardTarget !== Boolean(G.MapTarget.active())) refreshCard();
    B.cardTarget = Boolean(G.MapTarget.active());
  }

  /** For tests: the state of the screen and every place of the city shown, with whether its icon is on screen. */
  function debug() {
    if (!B.open) return { open: false };
    render();
    const v = B.view;
    const shown = new Set(B.hits.map((h) => h.id));
    const t = G.MapTarget.active();
    return {
      open: true,
      city: B.city,
      heroCity: B.heroCity,
      level: Number(MV().level(v).toFixed(3)),
      scale: Number(v.scale.toFixed(4)),
      cx: Number(v.cx.toFixed(2)),
      cz: Number(v.cz.toFixed(2)),
      size: { w: v.w, h: v.h },
      selected: B.sel,
      target: t ? t.id : null,
      places: G.MapPlaces.list(G.S, B.city).map((p) => ({
        id: p.id,
        kind: p.kind,
        label: p.label,
        x: p.x,
        z: p.z,
        visible: shown.has(p.id),
      })),
      listOpen: B.listOpen,
      hits: B.hits.map((h) => ({ id: h.id, x: h.x, y: h.y, r: h.r })), // the drawn icons, as tapped
    };
  }

  G.BigMap = { open, refresh, focus, debug, close: () => G.UI.closeSheet("bigmap") };
})((window.KQ = window.KQ || {}));
