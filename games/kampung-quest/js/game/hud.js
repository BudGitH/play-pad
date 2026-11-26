/* ============================================================================
 * FILE: hud.js
 * PURPOSE: The in-game HUD of design option D ("Kid dock and needs ring"): clock + five-prayer
 *          strip, picture mission card, dock (Missions, Map, Pray, Bag, Pause), coins, mute,
 *          minimap wrapped in the food / energy ring, joystick + Run, and the floating Talk button.
 * BUSINESS CONTEXT: AC-10 (needs meters), AC-11 (tracker, minimap), AC-12 (context prompt within
 *   2 m), AC-15 (>= 48 px targets, DOM order = the keyboard focus order of the design: nearest
 *   action, clock and prayers, mission card, dock, mute, needs ring).
 * DEPENDENCIES: util.js, pictures.js, ui-core.js, minimap.js. The build is DOM only.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const P = () => G.Pictures;
  const PRAYERS = ["subuh", "zohor", "asar", "maghrib", "isyak"];
  const R = {};
  const cache = {};

  /** Write a value to the DOM only when it changed (cheap per-frame updates). */
  function setText(key, node, text) {
    if (cache[key] === text) return;
    cache[key] = text;
    node.textContent = text;
  }

  function setClass(key, node, cls) {
    if (cache[key] === cls) return;
    cache[key] = cls;
    node.className = cls;
  }

  function prayerItem(name) {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const ic = U.el("span", { cls: "kq-pi-ic" }, P().icon("mosque"));
    const item = U.el(
      "span",
      { cls: "kq-prayer", "data-p": name },
      ic,
      U.el("span", { text: label }),
    );
    R.prayers[name] = { item, ic };
    return item;
  }

  function buildStatus() {
    R.prayers = {};
    R.clock = U.el(
      "span",
      { cls: "kq-clock" },
      P().icon("clock"),
      (R.clockText = U.el("b", { text: "07:00" })),
    );
    R.nextp = U.el("span", { cls: "kq-nextp", text: "" });
    R.clockrow = U.el("div", { cls: "kq-clockrow" }, R.clock, R.nextp);
    const strip = U.el("div", { cls: "kq-prayers" }, PRAYERS.map(prayerItem));
    R.status = U.el(
      "div",
      {
        cls: "kq-glass kq-status",
        id: "kqStatus",
        tabindex: "0",
        role: "group",
        "aria-label": "Clock and prayers",
      },
      R.clockrow,
      strip,
    );
    return R.status;
  }

  function buildMission(h) {
    R.missionBody = U.el("div", { cls: "kq-mission-body" });
    R.missionRead = G.UI.readButton(() => (R.missionText || "").toString());
    R.mission = U.el(
      "div",
      { cls: "kq-glass kq-mission", id: "kqMission" },
      U.el(
        "div",
        { cls: "kq-mission-head" },
        (R.missionTitle = U.el("b", { text: "" })),
        R.missionRead,
      ),
      R.missionBody,
    );
    h.missionHandler = null;
    return R.mission;
  }

  function dockButton(id, label, icon, on) {
    const b = U.el(
      "button",
      {
        type: "button",
        cls: "kq-dock-btn",
        id: "kqDock-" + id,
        "aria-label": label,
        on: { click: () => on(id) },
      },
      P().icon(icon, "kq-ic-lg"),
      U.el("span", { text: label }),
    );
    R.dockBtns[id] = b;
    return b;
  }

  function buildDock(on) {
    R.dockBtns = {};
    R.badge = U.el("i", { cls: "kq-badge", hidden: true, text: "" });
    const mis = dockButton("missions", "Missions", "star", on);
    mis.appendChild(R.badge);
    R.dock = U.el(
      "div",
      { cls: "kq-dock", role: "group", "aria-label": "Menu" },
      mis,
      dockButton("map", "Map", "map", on),
      dockButton("pray", "Pray", "mosque", on),
      dockButton("bag", "Bag", "bag", on),
      dockButton("pause", "Pause", "pause", on),
    );
    return R.dock;
  }

  function ringPath(side) {
    const cx = 70;
    const r = 62;
    const a0 = side === "left" ? 105 : 75;
    const a1 = side === "left" ? 255 : -75;
    const pt = (a) => [
      cx + r * Math.cos((a * Math.PI) / 180),
      cx + r * Math.sin((a * Math.PI) / 180),
    ];
    const s = pt(a0);
    const e = pt(a1);
    const sweep = side === "left" ? 1 : 0;
    return "M" + s[0] + " " + s[1] + " A" + r + " " + r + " 0 0 " + sweep + " " + e[0] + " " + e[1];
  }

  function ringSvg() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 140 140");
    svg.setAttribute("class", "kq-ring");
    svg.setAttribute("aria-hidden", "true");
    ["left", "right"].forEach(function (side) {
      const track = document.createElementNS(ns, "path");
      track.setAttribute("d", ringPath(side));
      track.setAttribute("class", "kq-ring-track");
      const val = document.createElementNS(ns, "path");
      val.setAttribute("d", ringPath(side));
      val.setAttribute("class", "kq-ring-val kq-ring-" + (side === "left" ? "food" : "energy"));
      val.setAttribute("pathLength", "100");
      val.setAttribute("stroke-dasharray", "0 100");
      svg.appendChild(track);
      svg.appendChild(val);
      R["arc" + side] = val;
    });
    return svg;
  }

  function buildMap(on) {
    R.canvas = U.el("canvas", { cls: "kq-minimap", width: "200", height: "200" });
    R.foodChip = U.el(
      "span",
      { cls: "kq-needchip kq-food" },
      P().icon("bowl"),
      (R.foodNum = U.el("b", { text: "85" })),
    );
    R.energyChip = U.el(
      "span",
      { cls: "kq-needchip kq-energy" },
      P().icon("bolt"),
      (R.energyNum = U.el("b", { text: "90" })),
    );
    R.ring = U.el(
      "div",
      {
        cls: "kq-mapwrap",
        id: "kqNeeds",
        tabindex: "0",
        role: "img",
        "aria-label": "Food 85, energy 90",
      },
      ringSvg(),
      R.canvas,
      R.foodChip,
      R.energyChip,
    );
    R.north = U.el("span", { cls: "kq-north", "aria-hidden": "true", text: "N" });
    R.ring.appendChild(R.north);
    R.ring.addEventListener("click", () => on("map"));
    return R.ring;
  }

  function buildTopRight(on) {
    R.coins = U.el(
      "span",
      { cls: "kq-chip kq-coins", id: "kqCoins", role: "status", "aria-label": "10 coins" },
      P().icon("coin"),
      (R.coinNum = U.el("b", { text: "10" })),
      U.el("span", { cls: "kq-coins-word", text: "coins" }),
    );
    R.mute = U.el(
      "button",
      {
        type: "button",
        cls: "kq-round",
        id: "kqMute",
        "aria-label": "Mute sound",
        "aria-pressed": "false",
        on: { click: () => on("mute") },
      },
      P().icon("sound"),
    );
    R.topright = U.el("div", { cls: "kq-topright" }, R.coins, R.mute, buildMap(on));
    return R.topright;
  }

  function buildTouch(on) {
    R.knob = U.el("span", { cls: "kq-knob" });
    R.joy = U.el("div", { cls: "kq-joy", id: "kqJoy", "aria-hidden": "true" }, R.knob);
    R.run = U.el(
      "button",
      {
        type: "button",
        cls: "kq-runbtn",
        id: "kqRun",
        "aria-pressed": "false",
        "aria-label": "Run",
        on: { click: () => on("run") },
      },
      P().icon("run", "kq-ic-lg"),
      U.el("span", { text: "Run" }),
    );
    return U.el("div", { cls: "kq-touch" }, R.joy, R.run);
  }

  function buildHints() {
    const k = (t) => U.el("kbd", { text: t });
    return U.el(
      "div",
      { cls: "kq-glass kq-keys", "aria-hidden": "true" },
      U.el("span", {}, k("W"), k("A"), k("S"), k("D"), " move"),
      U.el("span", {}, k("Shift"), " run"),
      U.el("span", {}, k("E"), " interact"),
      U.el("span", {}, k("Drag"), " look"),
      U.el("span", {}, k("Esc"), " pause"),
    );
  }

  function buildTalk(on) {
    R.talkLabel = U.el("span", { cls: "kq-talk-label", text: "Talk" });
    R.talkKey = U.el("kbd", { text: "E" });
    R.talk = U.el(
      "button",
      {
        type: "button",
        cls: "kq-talk",
        id: "kqTalk",
        hidden: true,
        on: { click: () => on("interact") },
      },
      P().icon("talk", "kq-ic-xl"),
      U.el("span", { cls: "kq-talk-row" }, R.talkLabel, R.talkKey),
    );
    return R.talk;
  }

  /** Build the HUD into `host`. on(action) receives dock / button actions. */
  function build(host, on) {
    const h = {};
    host.appendChild(buildTalk(on));
    R.tl = U.el("div", { cls: "kq-tl" }, buildStatus(), buildMission(h));
    host.appendChild(R.tl);
    host.appendChild(buildDock(on));
    host.appendChild(buildTopRight(on));
    host.appendChild(buildTouch(on));
    host.appendChild(buildHints());
    host.appendChild((R.portrait = U.el("div", { cls: "kq-portrait" })));
    buildPortraitChip();
    watchShown(host);
    G.HudLayout.init(host.parentElement);
    return R;
  }

  function buildPortraitChip() {
    const chip = U.el(
      "button",
      { type: "button", cls: "kq-chip kq-turn", on: { click: () => G.HudLayout.dismissTurn() } },
      "Turn sideways for a wider view",
      P().icon("close"),
    );
    R.portraitChip = chip;
    R.portrait.appendChild(chip);
  }

  /** When the HUD is revealed (the title card is gone) put keyboard focus somewhere sensible. */
  function watchShown(host) {
    new MutationObserver(function () {
      if (!host.hidden) setTimeout(() => G.UI.focusHome(), 0);
    }).observe(host, { attributes: true, attributeFilter: ["hidden"] });
  }

  G.Hud = { build, refs: R, setText, setClass, PRAYERS };
})((window.KQ = window.KQ || {}));
