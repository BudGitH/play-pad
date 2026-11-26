/* ============================================================================
 * FILE: hud-layout.js
 * PURPOSE: Keeps the HUD pieces from landing on each other on any screen: measures the top HUD
 *          (CSS variables the toast lane and the portrait minimap hang from), moves the coins chip
 *          into the status card on a portrait phone, and nudges the floating Talk button out of the
 *          card, dock, controls, azan card and toast lane that surround it.
 * BUSINESS CONTEXT: AC-15 (everything reachable by touch on a phone, portrait and landscape) and
 *   QA findings A11Y-01..04 (dock over coins, toast over Talk, "Walk closer" over the cards).
 * DEPENDENCIES: hud.js (refs). Pure DOM geometry; no THREE, no sim.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const GAP = 4;
  const L = { root: null, vars: {}, portraitMq: null, observer: null };

  const px = (n) => Math.round(n) + "px";
  const isPortraitPhone = () => Boolean(L.portraitMq && L.portraitMq.matches);

  function setVar(name, value) {
    if (L.vars[name] === value) return;
    L.vars[name] = value;
    L.root.style.setProperty(name, value);
  }

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
    const list = [R.status, R.mission, R.coins, R.mute, R.ring, R.dock, R.joy, R.run];
    list.push(azan, R.lane, R.portraitChip, keys);
    L.root.querySelectorAll(".kq-needchip").forEach((c) => list.push(c));
    return list.map(rectOf).filter(Boolean);
  }

  const touches = (a, b) =>
    a.left < b.right + GAP &&
    a.right > b.left - GAP &&
    a.top < b.bottom + GAP &&
    a.bottom > b.top - GAP;

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

  /** Where the azan pill ends when it sits in the top lane (the toast lane starts under it). */
  function laneTop() {
    const top = parseFloat(getComputedStyle(L.root).getPropertyValue("--kq-top")) || 12;
    const pill = document.getElementById("kqAzan");
    const r = pill && pill.classList.contains("is-bar") ? rectOf(pill) : null;
    return r && !isPortraitPhone() ? Math.max(top, r.bottom + 6) : top;
  }

  /** Publish the measured sizes the CSS hangs from (status card height, top HUD end, lane top). */
  function measure() {
    const R = G.Hud.refs;
    if (!L.root || !R.status || R.status.offsetHeight === 0) return;
    setVar("--kq-status-h", px(R.status.offsetHeight));
    const bottoms = [R.tl, R.topright].map((e) => e.getBoundingClientRect().bottom);
    setVar("--kq-top-end", px(Math.max.apply(null, bottoms)));
    setVar("--kq-lane-top", px(laneTop()));
  }

  /** On a portrait phone the coins chip lives in the status card's clock row; elsewhere top right. */
  function placeCoins() {
    const R = G.Hud.refs;
    if (isPortraitPhone()) R.clockrow.appendChild(R.coins);
    else R.topright.insertBefore(R.coins, R.topright.firstChild);
    measure();
  }

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
    if (L.portraitMq.addEventListener) L.portraitMq.addEventListener("change", placeCoins);
    window.addEventListener("resize", measure);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(measure);
      [R.tl, R.topright, R.status].forEach((e) => ro.observe(e));
    }
    L.observer = new MutationObserver(fitTalk);
    L.observer.observe(R.talk, { attributes: true, attributeFilter: ["style", "hidden"] });
    placeCoins();
    setTimeout(dismissTurn, 12000);
  }

  G.HudLayout = { init, measure, fitTalk, dismissTurn };
})((window.KQ = window.KQ || {}));
