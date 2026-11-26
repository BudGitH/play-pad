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

  function ctxFor(extra) {
    return Object.assign({ sim: S().sim, onClose: () => (S().hudDirty = true) }, extra || {});
  }

  function openMap() {
    const h = G.Screens.map(
      ctxFor({
        mapView: () => G.Loop.mapView(150),
      }),
    );
    return h;
  }

  function openBag() {
    const look = G.Menus.LOOKS.find(
      (l) => l.hair === S().sim.outfit.hair && l.hat === S().sim.outfit.hat,
    );
    G.Screens.bag(
      ctxFor({ carrying: G.MissionFlow.carrying(), outfitName: look ? look.name : "Blue cap" }),
    );
  }

  function setMuted(v) {
    G.Audio.setMuted(v);
    S().sim.settings.muted = Boolean(v);
    S().hudDirty = true;
  }

  function setQualityChoice(choice) {
    G.Settings.prefs.autoQuality = choice === "auto";
    S().autoQ = choice === "auto";
    G.Settings.save(S().storage);
    G.Loop.setQuality(choice === "auto" ? S().quality : choice);
  }

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

  function openPause() {
    G.Loop.setPaused(true);
    G.Screens.pause(pauseCtx());
  }

  function dock(id) {
    if (G.UI.modalOpen() && id !== "pause") {
      G.UI.closeSheet("replaced-by-dock");
    }
    if (id === "missions") G.Screens.missions(ctxFor());
    else if (id === "map") openMap();
    else if (id === "pray") G.PrayerFlow.openDayCard();
    else if (id === "bag") openBag();
    else if (id === "pause") openPause();
  }

  function onEscape() {
    if (G.UI.modalOpen()) return G.UI.closeSheet("escape");
    if (!S().started) return;
    openPause();
  }

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
    if (["missions", "map", "pray", "bag"].indexOf(name) !== -1) dock(name);
  }

  function nudgeCamera(dir) {
    G.Camera.state.yaw += dir * 0.35;
    G.Camera.state.idle = 0;
  }

  function toggleRun() {
    const on = G.Input.toggleRun();
    const b = G.Hud.refs.run;
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("is-on", on);
  }

  G.Actions = { handle, dock, openPause, setMuted, toggleRun };
})((window.KQ = window.KQ || {}));
