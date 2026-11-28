/* ============================================================================
 * FILE: hud-layout.js
 * PURPOSE: Keeps the HUD pieces from landing on each other on any screen: measures the top HUD
 *          (CSS variables the toast lane and the portrait radar column hang from), moves the coins
 *          chip into the status card on a portrait phone, and runs
 *          the phone's "lighter HUD" (the mission card folds to a one-line chip; a tap opens it for
 *          a few seconds. The status card is the Pray button and never folds).
 * BUSINESS CONTEXT: AC-15 (everything reachable by touch on a phone, portrait and landscape) and
 *   QA findings A11Y-01..04 (dock over coins, toast over the Action control),
 *   A11Y2-04 (the exploring HUD covered 25-40 % of a phone screen).
 * DEPENDENCIES: hud.js (refs). Pure DOM geometry; no THREE, no sim.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  /** Same query the stylesheet uses for the phone ("lite") HUD. */
  const COMPACT_QUERY = "(max-height: 520px), (orientation: portrait) and (max-width: 700px)";
  const OPEN_MS = 7000;
  const L = {
    root: null,
    vars: {},
    portraitMq: null,
    compactMq: null,
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

  /** The step chips (a minimised card, or the closed-rite chip) in the HUD. */
  const chipEls = () => Array.from(L.root.querySelectorAll(".kq-min-chip"));

  /** Where the azan pill or a step chip ends when it sits in the top lane (the toast lane starts under
   *  it). On a portrait phone they live above the controls instead, so the lane stays at the top. */
  function laneTop() {
    const top = parseFloat(getComputedStyle(L.root).getPropertyValue("--kq-top")) || 12;
    if (isPortraitPhone()) return top;
    const pill = document.getElementById("kqAzan");
    const boxes = [pill && pill.classList.contains("is-bar") ? rectOf(pill) : null];
    chipEls().forEach((c) => boxes.push(rectOf(c)));
    const inTop = boxes.filter((r) => r && r.top < window.innerHeight / 2);
    return inTop.reduce((low, r) => Math.max(low, r.bottom + 6), top);
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

  /**
   * Where the coins chip and the needs bars live. Portrait phone: coins in the status card's clock
   * row, the needs bars under the mission card (the radar column stays short). Phone landscape:
   * coins sit in the bottom dock (the top-right column stays narrow and short, clear of Jump).
   * Elsewhere: coins in the top-right row, the needs bars under the radar.
   */
  function placeCoins() {
    const R = G.Hud.refs;
    if (isPortraitPhone()) R.clockrow.appendChild(R.coins);
    else if (isCompact()) R.dock.appendChild(R.coins);
    else R.trRow.insertBefore(R.coins, R.trRow.firstChild);
    if (isPortraitPhone()) R.tl.appendChild(R.needs);
    else R.topright.appendChild(R.needs);
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
    if (L.compactMq.addEventListener) L.compactMq.addEventListener("change", placeCoins);
    window.addEventListener("resize", measure);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(measure);
      [R.tl, R.topright, R.status].forEach((e) => ro.observe(e));
    }
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

  G.HudLayout = { init, measure, dismissTurn, armTurnHint, toggle, peek };
})((window.KQ = window.KQ || {}));
