/* ============================================================================
 * FILE: hud-layout.js
 * PURPOSE: Keeps the HUD pieces from landing on each other on any screen: measures the top HUD
 *          (CSS variables the toast lane and the portrait radar column hang from), moves the coins
 *          chip into the status card on a portrait phone, nudges the floating Talk button out of
 *          the cards, dock, radar, controls, azan card and toast lane that surround it, and runs
 *          the phone's "lighter HUD" (the mission card folds to a one-line chip; a tap opens it for
 *          a few seconds. The status card is the Pray button and never folds).
 * BUSINESS CONTEXT: AC-15 (everything reachable by touch on a phone, portrait and landscape) and
 *   QA findings A11Y-01..04 (dock over coins, toast over Talk, "Walk closer" over the cards),
 *   A11Y2-04 (the exploring HUD covered 25-40 % of a phone screen).
 * DEPENDENCIES: hud.js (refs). Pure DOM geometry; no THREE, no sim.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const GAP = 4;
  /** Same query the stylesheet uses for the phone ("lite") HUD. */
  const COMPACT_QUERY = "(max-height: 520px), (orientation: portrait) and (max-width: 700px)";
  const OPEN_MS = 7000;
  const L = {
    root: null,
    vars: {},
    portraitMq: null,
    compactMq: null,
    observer: null,
    timers: {},
  };

  const px = (n) => Math.round(n) + "px";
  const isPortraitPhone = () => Boolean(L.portraitMq && L.portraitMq.matches);
  const isCompact = () => Boolean(L.compactMq && L.compactMq.matches);

  /** Set a CSS custom property on the HUD root only when its value changed. */
  function setVar(name, value) {
    if (L.vars[name] === value) return;
    L.vars[name] = value;
    L.root.style.setProperty(name, value);
  }

  /** A visible element's screen rectangle, or null when it is hidden or has no size. */
  function rectOf(el) {
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0
      ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      : null;
  }

  /** Everything the Talk button must stay clear of (live boxes; hidden ones have no box). */
  function keepOuts() {
    const R = G.Hud.refs;
    const azan = document.getElementById("kqAzan");
    const keys = L.root.querySelector(".kq-keys");
    const list = [R.status, R.mission, R.coins, R.mute, R.pause, R.radar, R.needs];
    list.push(R.dock, R.joy, R.jump, azan, R.lane, R.portraitChip, keys);
    return list.map(rectOf).filter(Boolean);
  }

  const touches = (a, b) =>
    a.left < b.right + GAP &&
    a.right > b.left - GAP &&
    a.top < b.bottom + GAP &&
    a.bottom > b.top - GAP;

  /** Build a rectangle {left, top, right, bottom} from a corner and a size. */
  function boxAt(left, top, w, h) {
    return { left, top, right: left + w, bottom: top + h };
  }

  const inside = (c, b) =>
    c.left >= b.left && c.right <= b.right && c.top >= b.top && c.bottom <= b.bottom;
  const shift = (a, b) => Math.abs(a.left - b.left) + Math.abs(a.top - b.top);

  /** Left / top values worth trying: the current one, and just beside every keep-out box. */
  function stops(r, outs, w, h) {
    const xs = [r.left];
    const ys = [r.top];
    outs.forEach(function (o) {
      xs.push(o.left - GAP - w, o.right + GAP);
      ys.push(o.top - GAP - h, o.bottom + GAP);
    });
    return { xs, ys };
  }

  /** The nearest spot to `r` that touches none of `outs` and stays inside `bounds` (or null). */
  function search(r, outs, bounds) {
    if (!outs.some((o) => touches(r, o))) return r;
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    const { xs, ys } = stops(r, outs, w, h);
    let best = null;
    xs.forEach(function (x) {
      ys.forEach(function (y) {
        const c = boxAt(x, y, w, h);
        if (!inside(c, bounds) || outs.some((o) => touches(c, o))) return;
        if (!best || shift(c, r) < shift(best, r)) best = c;
      });
    });
    return best;
  }

  /** Move the floating Talk / "Walk closer" button off anything it would cover. */
  function fitTalk() {
    const t = G.Hud.refs.talk;
    if (!t || t.hidden) return;
    const r = rectOf(t);
    const left = parseFloat(t.style.left);
    const top = parseFloat(t.style.top);
    if (!r || isNaN(left) || isNaN(top)) return;
    const bounds = {
      left: 4,
      top: 4,
      right: window.innerWidth - 4,
      bottom: window.innerHeight - 4,
    };
    const fit = search(r, keepOuts(), bounds);
    if (!fit) return;
    const dx = fit.left - r.left;
    const dy = fit.top - r.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    t.style.left = left + dx + "px";
    t.style.top = top + dy + "px";
  }

  /** Where the azan pill ends when it sits in the top lane (the toast lane starts under it). On a
   *  phone the pill lives above the dock instead, so the lane stays at the top. */
  function laneTop() {
    const top = parseFloat(getComputedStyle(L.root).getPropertyValue("--kq-top")) || 12;
    const pill = document.getElementById("kqAzan");
    const r = pill && pill.classList.contains("is-bar") ? rectOf(pill) : null;
    const inTopLane = r && r.top < window.innerHeight / 2;
    return inTopLane && !isPortraitPhone() ? Math.max(top, r.bottom + 6) : top;
  }

  /** Publish the measured sizes the CSS hangs from (status card height, top HUD end, lane top). */
  function measure() {
    const R = G.Hud.refs;
    if (!L.root || !R.status || R.status.offsetHeight === 0) return;
    setVar("--kq-status-h", px(R.status.offsetHeight));
    const bottoms = [R.tl, R.topright].map((e) => e.getBoundingClientRect().bottom);
    setVar("--kq-top-end", px(Math.max.apply(null, bottoms)));
    setVar("--kq-right-w", px(R.topright.offsetWidth));
    setVar("--kq-lane-top", px(laneTop()));
  }

  /** On a portrait phone the coins chip lives in the status card's clock row; elsewhere top right. */
  function placeCoins() {
    const R = G.Hud.refs;
    if (isPortraitPhone()) R.clockrow.appendChild(R.coins);
    else R.trRow.insertBefore(R.coins, R.trRow.firstChild);
    measure();
  }

  /* ----------------------- the phone's folded status card and mission card ----------------------- */

  const folding = () => ({
    mission: { box: G.Hud.refs.mission, toggle: G.Hud.refs.missionToggle },
  });

  /**
   * Open or fold the phone's mission card; an open card folds again by itself after a few seconds.
   * (The status card does not fold any more: the whole card is the Pray button.)
   */
  function setOpen(which, open) {
    const part = folding()[which];
    clearTimeout(L.timers[which]);
    part.box.classList.toggle("is-open", open);
    part.toggle.setAttribute("aria-expanded", String(open));
    if (open) L.timers[which] = setTimeout(() => setOpen(which, false), OPEN_MS);
    measure();
    fitTalk();
  }

  /** A tap on the folded mission card: open it for a few seconds, or fold it again. Ignored off a phone. */
  function toggle(which) {
    if (!isCompact()) return;
    setOpen(which, !folding()[which].box.classList.contains("is-open"));
  }

  /** Open a folded card briefly (a new mission step), so the player sees the whole thing once. */
  function peek(which) {
    if (isCompact()) setOpen(which, true);
  }

  /** Phones: the mission card is a button that folds and opens. Elsewhere it is a plain, always-open panel. */
  function syncCompact() {
    const compact = isCompact();
    const parts = folding();
    Object.keys(parts).forEach(function (which) {
      const t = parts[which].toggle;
      if (!compact) setOpen(which, false);
      t.removeAttribute("aria-expanded");
      if (compact) t.setAttribute("role", "button");
      else t.removeAttribute("role");
      if (!compact) t.removeAttribute("tabindex");
      if (G.HudView) G.HudView.nameMissionToggle();
      if (!compact) return;
      t.setAttribute("tabindex", "0");
      t.setAttribute("aria-expanded", String(parts[which].box.classList.contains("is-open")));
    });
  }

  /** Dismiss the 'turn sideways' hint for the rest of the session and re-measure the layout. */
  function dismissTurn() {
    const R = G.Hud.refs;
    R.portrait.hidden = true;
    L.root.classList.add("kq-no-turn");
    measure();
  }

  /** Wire everything once the HUD exists. `root` is the #kq element. */
  function init(root) {
    L.root = root;
    const R = G.Hud.refs;
    R.lane = root.querySelector("#kqToasts");
    L.portraitMq = window.matchMedia("(orientation: portrait) and (max-width: 700px)");
    L.compactMq = window.matchMedia(COMPACT_QUERY);
    if (L.portraitMq.addEventListener) L.portraitMq.addEventListener("change", placeCoins);
    if (L.compactMq.addEventListener) L.compactMq.addEventListener("change", syncCompact);
    window.addEventListener("resize", measure);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(measure);
      [R.tl, R.topright, R.status].forEach((e) => ro.observe(e));
    }
    L.observer = new MutationObserver(fitTalk);
    L.observer.observe(R.talk, { attributes: true, attributeFilter: ["style", "hidden"] });
    // a toast that lands where Talk is moves Talk out of its way too
    new MutationObserver(fitTalk).observe(R.lane, { childList: true });
    placeCoins();
    syncCompact();
  }

  /**
   * Show the 'turn sideways' hint for the first 12 s of play. Armed at Start, not at HUD build, so a
   * fast load does not use up the hint behind the loading screen.
   */
  function armTurnHint() {
    if (L.turnArmed) return;
    L.turnArmed = true;
    setTimeout(dismissTurn, 12000);
  }

  G.HudLayout = { init, measure, fitTalk, dismissTurn, armTurnHint, toggle, peek };
})((window.KQ = window.KQ || {}));
