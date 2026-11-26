/* ============================================================================
 * FILE: boot.js
 * PURPOSE: Boots Kampung Quest: checks WebGL and storage, builds the renderer, world, hero,
 *          NPCs, azan audio and posture pictures behind a progress screen, then starts (or
 *          continues) the game from the Start button.
 * BUSINESS CONTEXT: AC-1 (no console errors over http and file://; KQ.CAN_FETCH gates every
 *   fetched asset and each has a procedural stand-in), AC-13 (corrupt / missing save = new game,
 *   never a throw), AC-14 (quality tier from the save / device).
 * DEPENDENCIES: all of js/game, KQ.World, KQ.Figures, KQ.Sim.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const BU = () => G.BootUI;
  const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
  const params = new URLSearchParams(location.search);
  /** A new game starts in the void deck of Block 118, a few steps from Nenek (and clear of the lift). */
  const START_SPOT = { x: -42.6, z: 22.4 };

  function webglOk() {
    try {
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (err) {
      return false;
    }
  }

  function makeState(root) {
    return {
      root,
      stage: root.querySelector("#kqStage"),
      hudHost: root.querySelector("#kqHud"),
      started: false,
      paused: false,
      hidden: false,
      frozen: params.has("still"),
      t: 0,
      uiT: 0,
      saveT: 0,
      frames: 0,
      hudDirty: true,
      timers: [],
      size: { w: 1, h: 1 },
      avgDt: 1 / 60,
      slowT: 0,
      downgrades: 0,
      autoQ: params.get("autoq") !== "0",
      target: null,
      after(sec, fn) {
        this.timers.push({ at: this.t + sec, fn });
      },
    };
  }

  function createRenderer(s, tier) {
    const renderer = new THREE.WebGLRenderer({
      canvas: s.stage,
      antialias: tier !== "low",
      powerPreference: "high-performance",
    });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    s.renderer = renderer;
    s.scene = new THREE.Scene();
    s.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
    G.Camera.init(s.camera);
    return renderer;
  }

  function pickTier(saved) {
    const q = params.get("q");
    if (q === "low" || q === "med" || q === "high") return q;
    if (saved.status === "loaded") return saved.state.settings.quality;
    return G.Env.coarse ? "med" : "high";
  }

  async function buildWorld(s, tier) {
    BU().setStep(0, "now");
    await nextFrame();
    s.world = KQ.World.build(s.scene, {
      quality: tier,
      renderer: s.renderer,
      assetBase: KQ.ASSET_BASE,
    });
    s.quality = tier;
    G.Loop.resize();
    BU().setStep(0, "done");
    BU().setProgress(0.4);
  }

  async function buildActors(s) {
    BU().setStep(1, "now");
    await nextFrame();
    s.player = G.Player.create(s.scene);
    s.player.group.visible = false;
    s.npcs = G.Npcs.create(s.scene, s.world, null);
    s.markers = G.Markers.create(s.scene);
    s.collect = G.Collectibles.create(s.scene, s.world);
    G.Loop.studioShine(s);
    BU().setStep(1, "done");
    BU().setProgress(0.55);
  }

  function waitUntil(test, ms) {
    return new Promise(function (resolve) {
      const t0 = performance.now();
      (function poll() {
        if (test() || performance.now() - t0 > ms) resolve(test());
        else setTimeout(poll, 80);
      })();
    });
  }

  async function loadTextures() {
    if (!G.Env.canFetch) {
      BU().setStep(2, "skip", "drawn in code");
      BU().note(
        "On file:// the photo textures are skipped and drawn in code instead; nothing is wrong. Everything else works.",
      );
      return;
    }
    BU().setStep(2, "now");
    const mgr = THREE.DefaultLoadingManager;
    mgr.onProgress = (url, loaded, total) =>
      BU().setProgress(0.55 + 0.25 * (loaded / Math.max(1, total)), "Loading photo textures...");
    await waitUntil(() => !mgr.isLoading, 20000);
    BU().setStep(2, "done");
  }

  async function loadAzan() {
    BU().setStep(3, "now");
    const el = G.Audio.loadAzan();
    const ok = await waitUntil(() => el.readyState >= 3 || el.error, 7000);
    if (el.error || !ok) BU().setStep(3, "skip", "chime and captions instead");
    else BU().setStep(3, "done");
    BU().setProgress(0.9);
  }

  function renderPictures(s) {
    BU().setStep(4, "now");
    try {
      G.Pictures.renderPostures(s.renderer);
      BU().setStep(4, "done");
    } catch (err) {
      console.warn("[KQ] posture pictures skipped:", err && err.message);
      BU().setStep(4, "skip", "labels only");
    }
  }

  /* ------------------------------ title backdrop ------------------------------ */

  function titleOrbit(s) {
    let a = 0;
    (function loop() {
      if (s.started) return;
      requestAnimationFrame(loop);
      if (s.frozen) return;
      a += 0.0035;
      s.camera.position.set(14 + Math.sin(a) * 34, 7.5, -16 + Math.cos(a) * 34);
      s.camera.lookAt(20, 2.2, -20);
      s.world.update(0, { minute: 640 });
      s.world.setShadowTarget({ x: 20, z: -20 });
      s.renderer.render(s.scene, s.camera);
    })();
  }

  /* ------------------------------ launch ------------------------------ */

  function launch(s, state) {
    s.sim = G.Sim.create(state);
    G.Audio.setMuted(state.settings.muted);
    G.Player.applyOutfit(s.player, s.sim.outfit);
    G.Npcs.attachSim(s.npcs, s.sim);
    const pos = s.sim.pos || START_SPOT;
    G.Player.place(s.player, pos.x, pos.z, s.sim.pos ? 0 : -Math.PI / 2, s.world.heightAt);
    s.player.group.visible = true;
    G.Camera.snapBehind(s.player.heading);
    s.sim.prayer.update(s.sim.clock.minute, s.sim.clock.day);
    G.Npcs.snapAll(s.npcs);
    G.Loop.setQuality(s.quality);
    s.started = true;
    document.body.classList.add("kq-playing");
    s.hudHost.hidden = false;
    BU().hideTitle();
    G.Loop.frame(0);
    G.PrayerFlow.restoreDue();
    G.PrayerFlow.resume();
    if (!s.sim.pos)
      G.UI.toast("Nenek is waiting by your block. Walk to her and press Talk.", "good", 7000);
    document.getElementById("kqTalk").focus({ preventScroll: true });
    if (!s.loopStarted) {
      s.loopStarted = true;
      G.Loop.start();
    }
  }

  function begin(s, saved, fresh) {
    G.Audio.unlock();
    if (fresh && s.storage) KQ.Sim.Save.clear(s.storage);
    const state = fresh || saved.status !== "loaded" ? KQ.Sim.Save.defaultState() : saved.state;
    if (fresh) state.settings.quality = s.quality;
    launch(s, state);
  }

  function savedLabel(saved) {
    if (saved.status !== "loaded") return "";
    const c = saved.state.clock;
    return (
      "Continue: day " +
      c.day +
      ", " +
      KQ.Sim.Clock.pad2(Math.floor(c.minute / 60)) +
      ":" +
      KQ.Sim.Clock.pad2(Math.floor(c.minute % 60))
    );
  }

  async function run(root) {
    BU().bind();
    const storage = G.Settings.getStorage();
    G.Settings.load(storage);
    const saved = storage
      ? KQ.Sim.Save.load(storage)
      : { state: KQ.Sim.Save.defaultState(), status: "unavailable" };
    const s = (G.S = makeState(root));
    s.storage = storage;
    G.UI.init(root);
    G.Speech.init();
    createRenderer(s, pickTier(saved));
    G.Hud.build(s.hudHost, G.Actions.handle);
    G.Input.attach({ stage: s.stage, joystick: G.Hud.refs.joy, knob: G.Hud.refs.knob });
    G.Input.setHandler((name) => G.Actions.handle(name));
    window.addEventListener("keydown", G.UI.trap);
    document.body.classList.toggle("kq-less-motion", G.Settings.reduced());
    await buildWorld(s, pickTier(saved));
    await buildActors(s);
    await loadTextures();
    await loadAzan();
    renderPictures(s);
    if (!storage)
      BU().note("Saving is off in this browser, so your progress lasts until you close the tab.");
    BU().ready(savedLabel(saved));
    titleOrbit(s);
    const refs = BU().refs;
    refs.start.addEventListener("click", () => begin(s, saved, false));
    refs.newGame.addEventListener("click", () => begin(s, saved, true));
    G.Boot.ready = true;
  }

  function startOver() {
    const s = G.S;
    if (s.storage) KQ.Sim.Save.clear(s.storage);
    s.paused = false;
    location.reload();
  }

  function init() {
    const root = document.getElementById("kq");
    if (!webglOk()) {
      BU().bind();
      BU().showError(() => location.reload());
      return;
    }
    run(root).catch(function (err) {
      console.error("[KQ] boot failed:", err);
      BU().showError(() => location.reload());
    });
  }

  G.Boot = { init, startOver, ready: false };
})((window.KQ = window.KQ || {}));
