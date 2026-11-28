/* ============================================================================
 * FILE: hud.js
 * PURPOSE: The in-game HUD of design option D ("Kid dock"), with the radar redesign: clock +
 *          five-prayer strip (icons only on a phone; the whole card is the Pray button), picture
 *          mission card (a one-line chip on a phone), a two-button dock (Missions, Bag), coins,
 *          sound and Pause (top-right corner), a GTA-style round radar (a tap opens the full Map)
 *          with the food / energy bars hanging under it (the Tired bar is a Rest button), joystick
 *          (push to the rim to run) + Jump, and the Action control (action-bar.js, id kqTalk) in
 *          its fixed place above Jump.
 *          One control per action: Map = the radar, Pray = the prayer-time card, Pause = the corner
 *          button, so the dock holds only the two menus that have no other home; there is no Run
 *          button; the keyboard hints do not repeat the Pause button (shortcuts M, P, J, B, Esc).
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

  /** Write a className to the DOM only when it changed (cheap per-frame updates). */
  function setClass(key, node, cls) {
    if (cache[key] === cls) return;
    cache[key] = cls;
    node.className = cls;
  }

  /**
   * Build one prayer chip (icon + name) in the status strip and register it in the refs for
   * updates.
   */
  function prayerItem(name) {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const ic = U.el("span", { cls: "kq-pi-ic" }, P().icon("mosque"));
    const item = U.el(
      "span",
      { cls: "kq-prayer", "data-p": name },
      ic,
      U.el("span", { cls: "kq-pl", text: label }),
    );
    R.prayers[name] = { item, ic };
    return item;
  }

  /**
   * Build the clock + five-prayer status card (the first stop in the keyboard focus order after
   * Talk). The whole card is a button: a tap, Enter or Space opens today's prayers (the Pray
   * action), and a small "Pray >" chip says so.
   */
  function buildStatus(on) {
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
    R.prayGo = U.el(
      "span",
      { cls: "kq-pray-go", "aria-hidden": "true" },
      P().icon("mosque"),
      U.el("b", { text: "Pray" }),
      P().icon("chevron"),
    );
    R.status = U.el(
      "div",
      {
        cls: "kq-glass kq-status",
        id: "kqStatus",
        tabindex: "0",
        role: "button",
        title: "Open today's prayers (P)",
        "aria-label": "Clock and prayers",
      },
      R.clockrow,
      strip,
      R.prayGo,
    );
    bindPress(R.status, () => on("pray"));
    return R.status;
  }

  /** A tap, Enter or Space on a div-button runs `go` (the same keys a real button answers to). */
  function bindPress(node, go) {
    node.addEventListener("click", go);
    node.addEventListener("keydown", function (e) {
      if (e.target !== node || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      go();
    });
  }

  /** On a phone a tap on the mission card (or Enter / Space on its toggle) opens / folds it; the read-to-me button is left alone. */
  function bindToggle(card, toggle, which) {
    const go = () => G.HudLayout.toggle(which);
    card.addEventListener("click", function (e) {
      if (!e.target.closest(".kq-read")) go();
    });
    toggle.addEventListener("keydown", function (e) {
      if (e.target !== toggle || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      go();
    });
  }

  /** The mission card: a toggle row (the one-line chip on a phone, the title when open) + the steps. */
  function buildMission() {
    R.missionBody = U.el("div", { cls: "kq-mission-body" });
    R.missionRead = G.UI.readButton(() => (R.missionText || "").toString());
    R.missionTitle = U.el("b", { cls: "kq-mtitle", text: "" });
    R.chipIc = U.el("span", { cls: "kq-mchip-ic" });
    R.chipText = U.el("span", { cls: "kq-mchip-text", text: "" });
    R.missionToggle = U.el(
      "div",
      { cls: "kq-mtoggle" },
      R.chipIc,
      R.chipText,
      R.missionTitle,
      U.el("i", { cls: "kq-caret", "aria-hidden": "true" }),
    );
    R.mission = U.el(
      "div",
      { cls: "kq-glass kq-mission", id: "kqMission" },
      U.el("div", { cls: "kq-mission-head" }, R.missionToggle, R.missionRead),
      R.missionBody,
    );
    bindToggle(R.mission, R.missionToggle, "mission");
    return R.mission;
  }

  /** Build one big dock button (icon + label) that reports its id to the click handler. */
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

  /**
   * Build the bottom dock: Missions (with its count badge) and Bag. Map, Pray and Pause have their
   * own homes (the radar, the prayer-time card, the corner button), so the dock stays two big,
   * labelled buttons.
   */
  function buildDock(on) {
    R.dockBtns = {};
    R.badge = U.el("i", { cls: "kq-badge", hidden: true, text: "" });
    const mis = dockButton("missions", "Missions", "missions", on);
    if (mis) mis.appendChild(R.badge);
    // Umrah, Hajj and Ziarah live in one dock button, only in Makkah and Madinah
    const rites = KQ.region === "haramain" ? [dockButton("rites", "Umrah", "hand", on)] : [];
    R.dock = U.el(
      "div",
      { cls: "kq-dock", role: "group", "aria-label": "Menu" },
      mis,
      rites,
      dockButton("bag", "Bag", "backpack", on),
    );
    return R.dock;
  }

  /**
   * Build the round radar: a canvas the loop redraws (minimap.js) inside a button, so a tap or
   * Enter opens the full map. A small map badge on the rim says it can be tapped.
   */
  function buildRadar(on) {
    R.canvas = U.el("canvas", {
      cls: "kq-minimap",
      width: "256",
      height: "256",
      "aria-hidden": "true",
    });
    R.mapGo = U.el("span", { cls: "kq-map-go", "aria-hidden": "true" }, P().icon("map"));
    R.radar = U.el(
      "button",
      {
        type: "button",
        cls: "kq-radar",
        id: "kqMap",
        title: "Open the map (M)",
        "aria-label": "Map",
        on: { click: () => on("map") },
      },
      R.canvas,
      R.mapGo,
    );
    R.dockBtns.map = R.radar;
    return R.radar;
  }

  /** One need row: icon, a coloured bar that drains, and its word (Food / Hungry, Energy / Tired). */
  function needRow(kind, iconName, word) {
    R[kind + "Fill"] = U.el("i", { cls: "kq-need-fill" });
    R[kind + "Word"] = U.el("b", { cls: "kq-need-word", text: word });
    R[kind + "Row"] = U.el(
      "span",
      { cls: "kq-need kq-" + kind },
      P().icon(iconName),
      U.el("span", { cls: "kq-need-bar" }, R[kind + "Fill"]),
      R[kind + "Word"],
    );
    return R[kind + "Row"];
  }

  /**
   * Build the food and energy bars that hang under the radar. One element, one spoken label (the
   * numbers and the low notes), so a screen reader gets a sentence, not four fragments.
   */
  function buildNeeds(on) {
    R.needs = U.el(
      "div",
      {
        cls: "kq-glass kq-needs",
        id: "kqNeeds",
        tabindex: "0",
        role: "img",
        "aria-label": "Food 85 of 100, energy 90 of 100.",
      },
      needRow("food", "bowl", "Food"),
      needRow("energy", "bolt", "Energy"),
    );
    bindPress(R.needs, () => R.needs.classList.contains("is-rest") && on("rest"));
    return R.needs;
  }

  /** Build the top-right column: a row of coins, sound and Pause, the radar, then the needs bars. */
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
        "aria-label": "Sound",
        "aria-pressed": "true",
        on: { click: () => on("mute") },
      },
      P().icon("sound"),
    );
    R.pause = U.el(
      "button",
      {
        type: "button",
        cls: "kq-round kq-pause",
        id: "kqDock-pause", // id kept from the dock days: tests and focus return use it
        title: "Pause (Esc)",
        "aria-label": "Pause",
        on: { click: () => on("pause") },
      },
      P().icon("pause"),
    );
    R.dockBtns.pause = R.pause;
    R.trRow = U.el("div", { cls: "kq-tr-row" }, R.coins, R.mute, R.pause);
    R.topright = U.el("div", { cls: "kq-topright" }, R.trRow, buildRadar(on), buildNeeds(on));
    return R.topright;
  }

  /**
   * Build the touch controls: the joystick with its knob and the Jump button. Jump fires on
   * pointer-down (not on click) so a tap with the right thumb is instant and never waits on, or
   * interrupts, the left thumb steering; a keyboard "click" (detail 0) still works.
   */
  function buildTouch(on) {
    R.knob = U.el("span", { cls: "kq-knob" });
    R.joy = U.el("div", { cls: "kq-joy", id: "kqJoy", "aria-hidden": "true" }, R.knob);
    R.jump = U.el(
      "button",
      {
        type: "button",
        cls: "kq-jumpbtn",
        id: "kqJump",
        "aria-label": "Jump",
        on: {
          pointerdown: (e) => (e.preventDefault(), on("jump")),
          click: (e) => e.detail === 0 && on("jump"),
        },
      },
      P().icon("jump", "kq-ic-lg"),
      U.el("span", { text: "Jump" }),
    );
    return U.el("div", { cls: "kq-touch" }, R.joy, R.jump);
  }

  /** Build the keyboard hint strip (WASD, Shift, Space, E, drag) shown to keyboard players. */
  function buildHints() {
    const k = (t) => U.el("kbd", { text: t });
    return U.el(
      "div",
      { cls: "kq-glass kq-keys", "aria-hidden": "true" },
      U.el("span", {}, k("W"), k("A"), k("S"), k("D"), " move"),
      U.el("span", {}, k("Shift"), " run"),
      U.el("span", {}, k("Space"), " jump"),
      U.el("span", {}, k("E"), " interact"),
      U.el("span", {}, k("Drag"), " look"),
    );
  }

  /** Build the HUD into `host`. on(action) receives dock / button actions. */
  function build(host, on) {
    host.appendChild(G.ActionBar.build(on));
    host.appendChild(G.Hud.refs.pointer);
    R.tl = U.el("div", { cls: "kq-tl" }, buildStatus(on), buildMission());
    host.appendChild(R.tl);
    host.appendChild(buildDock(on));
    host.appendChild(buildTopRight(on));
    R.dockBtns.pray = R.status; // the Pray action's focus home (focus returns here after a sheet)
    host.appendChild(buildTouch(on));
    host.appendChild(buildHints());
    host.appendChild((R.portrait = U.el("div", { cls: "kq-portrait" })));
    buildPortraitChip();
    watchShown(host);
    G.HudLayout.init(host.parentElement);
    return R;
  }

  /** Build the dismissible 'Turn sideways for a wider view' chip shown in portrait. */
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
