/* ============================================================================
 * FILE: actions.js
 * PURPOSE: Routes every button and shortcut to what it does: interact (E), the dock (Missions,
 *          Map, Pray, Bag, Pause), mute, run, number keys for picture tiles, Escape.
 * BUSINESS CONTEXT: AC-15 (fully keyboard-playable; shortcuts E, 1-4, M, J, P, B, Esc; pause and
 *   mute always available), AC-16 (pause dialog stops the sim and all sound).
 * DEPENDENCIES: ui-screens.js, prayer-flow.js, interact.js, loop.js, audio.js, settings.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;

  /** Build the context passed to a screen: the sim, plus an onClose that marks the HUD dirty. */
  function ctxFor(extra) {
    return Object.assign({ sim: S().sim, onClose: () => (S().hudDirty = true) }, extra || {});
  }

  /** Open the map screen with a live map view from the loop. */
  function openMap() {
    const h = G.Screens.map(
      ctxFor({
        mapView: () => G.Loop.mapView(150),
      }),
    );
    return h;
  }

  /** Open the bag screen showing what the hero is carrying and the current outfit name. */
  function openBag() {
    const look = G.Menus.LOOKS.find(
      (l) => l.hair === S().sim.outfit.hair && l.hat === S().sim.outfit.hat,
    );
    G.Screens.bag(
      ctxFor({ carrying: G.MissionFlow.carrying(), outfitName: look ? look.name : "Blue cap" }),
    );
  }

  /** Mute / unmute sound, keep the saved setting and the HUD in step, and say so politely. */
  function setMuted(v) {
    G.Audio.setMuted(v);
    S().sim.settings.muted = Boolean(v);
    S().hudDirty = true;
    G.UI.announce(v ? "Sound off" : "Sound on");
  }

  /**
   * Apply the Pause-menu quality choice ('auto' re-enables the auto tier drop), save it and set the
   * tier.
   */
  function setQualityChoice(choice) {
    G.Settings.prefs.autoQuality = choice === "auto";
    S().autoQ = choice === "auto";
    G.Settings.save(S().storage);
    G.Loop.setQuality(choice === "auto" ? S().quality : choice);
  }

  /**
   * Build the Pause screen's context: save status plus getters / setters for sound, captions,
   * read-to-me and quality.
   */
  function pauseCtx() {
    const status = S().storage
      ? "Day " + S().sim.clock.day + " · " + S().sim.clock.hhmm() + ". Your game saves by itself."
      : "Saving is off in this browser.";
    return {
      status,
      getMuted: () => G.Audio.isMuted(),
      setMuted,
      setCaption: (v) => ((G.Settings.prefs.captionSize = v), G.Settings.save(S().storage)),
      setRead: (v) => (
        (G.Settings.prefs.readToMe = v), G.Settings.save(S().storage), G.Speech.cancel()
      ),
      getQuality: () => (G.Settings.prefs.autoQuality ? "auto" : S().quality),
      setQuality: setQualityChoice,
      setMotion: (v) => (
        (G.Settings.prefs.lessMotion = v),
        G.Settings.save(S().storage),
        document.body.classList.toggle("kq-less-motion", G.Settings.reduced())
      ),
      onHowTo: () => G.Screens.howTo({ onClose: openPause }),
      onSaveExit() {
        G.Loop.save();
        location.href = "../../index.html";
      },
      onStartOver: confirmStartOver,
      onClose: () => G.Loop.setPaused(false),
    };
  }

  /** Ask before clearing the saved game; confirming restarts at 07:00 on day 1. */
  function confirmStartOver() {
    G.Menus.card({
      title: "Start over?",
      paragraphs: [
        "This clears your saved game and begins a new day at 07:00. Your stickers and coins start again too.",
      ],
      buttons: [
        {
          label: "Yes, start over",
          primary: true,
          icon: "refresh",
          onClick: () => G.Boot.startOver(),
        },
        { label: "Keep playing", onClick: openPause },
      ],
      onClose: () => G.Loop.setPaused(false),
    });
  }

  /** Pause the game loop and open the Pause screen. */
  function openPause() {
    G.Loop.setPaused(true);
    G.Screens.pause(pauseCtx());
  }

  /**
   * Put keyboard focus on a dock button before its sheet opens (a shortcut key opens the sheet with
   * focus elsewhere), so closing the sheet with Esc returns focus to the button that opened it.
   */
  function focusDockButton(id) {
    const b = G.Hud.refs.dockBtns && G.Hud.refs.dockBtns[id];
    if (b && document.activeElement !== b) b.focus({ preventScroll: true });
  }

  /**
   * Handle a dock button: close whatever sheet is open (except for Pause) and open the matching
   * screen.
   */
  function dock(id) {
    if (G.UI.modalOpen() && id !== "pause") {
      G.UI.closeSheet("replaced-by-dock");
    }
    focusDockButton(id);
    if (id === "missions") G.Screens.missions(ctxFor());
    else if (id === "map") openMap();
    else if (id === "pray") G.PrayerFlow.openDayCard();
    else if (id === "bag") openBag();
    else if (id === "pause") openPause();
  }

  /** Escape closes the open sheet, otherwise pauses a running game. */
  function onEscape() {
    if (G.UI.modalOpen()) return G.UI.closeSheet("escape");
    if (!S().started) return;
    openPause();
  }

  /**
   * Number keys 1-4 press the matching picture tile, on a prayer screen first, then on any open
   * sheet.
   */
  function tileKey(n) {
    if (G.PrayerFlow.pickTile(n)) return;
    const tiles = G.UI.state.sheet && G.UI.state.sheet.querySelectorAll(".kq-tile");
    if (tiles && tiles[n]) tiles[n].click();
  }

  /** Handle a named action from a button, shortcut or test hook. */
  function handle(name) {
    if (!S() || !S().started) return;
    if (name === "escape") return onEscape();
    if (name === "pause") return dock("pause");
    if (name.indexOf("tile") === 0) return tileKey(Number(name.slice(4)) - 1);
    if (name === "camLeft" || name === "camRight") return nudgeCamera(name === "camLeft" ? -1 : 1);
    if (G.UI.modalOpen() && name !== "mute") return;
    if (name === "interact") return G.Interact.activate(S().target);
    if (name === "mute") return setMuted(!G.Audio.isMuted());
    if (name === "run") return toggleRun();
    if (name === "jump") return canJump() && G.Player.jump(S().player, G.Audio);
    if (["missions", "map", "pray", "bag"].indexOf(name) !== -1) dock(name);
  }

  /** Can the hero jump now: in play, no sheet or prayer screen open, not held by a flow. */
  function canJump() {
    const s = S();
    return Boolean(
      s &&
        s.started &&
        !s.paused &&
        !s.hidden &&
        !G.UI.modalOpen() &&
        !G.PrayerFlow.screenOpen() &&
        !s.player.locked,
    );
  }

  /** Turn the camera a step left or right (keyboard look) and reset its idle timer. */
  function nudgeCamera(dir) {
    G.Camera.state.yaw += dir * 0.35;
    G.Camera.state.idle = 0;
  }

  /** Flip run mode and mirror it on the Run button (pressed state and style). */
  function toggleRun() {
    const on = G.Input.toggleRun();
    const b = G.Hud.refs.run;
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("is-on", on);
  }

  G.Actions = { handle, dock, openPause, setMuted, toggleRun, canJump };
})((window.KQ = window.KQ || {}));
