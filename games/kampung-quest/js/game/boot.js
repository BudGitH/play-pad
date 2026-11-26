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
  const TIERS = ["low", "med", "high"];
  /** A new game starts in the void deck of Block 118, a few steps from Nenek (and clear of the lift). */
  const START_SPOT = { x: -42.6, z: 22.4 };

  /** True when WebGL works; also notes a software renderer (SwiftShader / llvmpipe) in G.Env. */
  function webglOk() {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) return false;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
      G.Env.softwareGL = /swiftshader|llvmpipe|software/i.test(name);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Create the single game-state object (KQ.Game.S) with its flags, timers and the after() helper. */
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
      graceT: 0,
      downgrades: 0,
      autoQ: params.get("autoq") !== "0",
      target: null,
      after(sec, fn) {
        this.timers.push({ at: this.t + sec, fn });
      },
    };
  }

  /** Create the WebGL renderer, scene and camera with the contract's colour and shadow settings. */
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

  /** Choose the quality tier: the ?q= flag, else the save, else low on touch / software GL and high elsewhere. */
  function pickTier(saved) {
    const q = params.get("q");
    if (q === "low" || q === "med" || q === "high") return q;
    if (saved.status === "loaded") return saved.state.settings.quality;
    return G.Env.coarse || G.Env.softwareGL ? "low" : "high";
  }

  /** Build the neighbourhood behind the loading screen (step 1). */
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

  /** Create the hero, NPCs, markers and collectibles (step 2). */
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

  /**
   * Build one quality tier's shader variants: the world's look and light count, the figures that
   * cast shadows on that tier, a compile of everything, and one tiny render that also builds the
   * shadow-depth programs (renderer.compile does not).
   */
  function compileTier(s, tier) {
    s.quality = tier;
    s.world.setQuality(tier);
    G.Loop.figureShadows(s);
    s.world.setShadowTarget(START_SPOT);
    s.renderer.compile(s.scene, s.camera);
    s.renderer.render(s.scene, s.camera);
  }

  /**
   * Compile every shader program of EVERY tier behind the loading screen (hero, NPCs, markers and
   * the world's variants, depth programs included), so Start, the first walk to a new area, an
   * auto-downgrade and a manual upgrade in the settings never freeze on a compile (PERF-08,
   * R2-PERF-01, R2-PERF-04). The start tier goes last so it is the state the game begins in. The
   * canvas is shrunk while doing it (programs do not depend on size) and the hero, hidden until
   * Start, is shown so its meshes are drawn too.
   */
  async function precompile(s) {
    BU().setProgress(0.82, "Getting the shaders ready...");
    await nextFrame();
    const start = s.quality;
    const heroShown = s.player.group.visible;
    s.player.group.visible = true;
    s.renderer.setSize(2, 2, false);
    TIERS.filter((t) => t !== start)
      .concat(start)
      .forEach((tier) => compileTier(s, tier));
    s.player.group.visible = heroShown;
    G.Loop.resize();
  }

  /** Poll a condition every 80 ms until it holds or the time runs out; resolves with the final answer. */
  function waitUntil(test, ms) {
    return new Promise(function (resolve) {
      const t0 = performance.now();
      (function poll() {
        if (test() || performance.now() - t0 > ms) resolve(test());
        else setTimeout(poll, 80);
      })();
    });
  }

  /** Wait for the photo textures (over http) or note that they are drawn in code (file://). */
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

  /** Check the azan recording loads; if not, the chime and captions stand in. */
  async function loadAzan() {
    BU().setStep(3, "now");
    const ok = await G.Audio.probeAzan();
    if (ok) BU().setStep(3, "done");
    else BU().setStep(3, "skip", "chime and captions instead");
    BU().setProgress(0.9);
  }

  /** Draw the posture pictures for the prayer screens; labels only if that fails. */
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
      s.orbitSkip = (s.orbitSkip || 0) + 1;
      if (s.orbitSkip % 3) return;
      a += 0.01;
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

  /** Start or continue the game from a title button; New game also clears the save. */
  function begin(s, saved, fresh) {
    G.Audio.unlock();
    G.Audio.loadAzan();
    if (fresh && s.storage) KQ.Sim.Save.clear(s.storage);
    const state = fresh || saved.status !== "loaded" ? KQ.Sim.Save.defaultState() : saved.state;
    if (fresh) state.settings.quality = s.quality;
    launch(s, state);
  }

  /** The "Continue: day N, HH:MM" text for the title screen, empty for a new game. */
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

  /** The boot sequence: bind the title, read prefs and save, build everything, then wait for Start. */
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
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    ["pointerdown", "touchend", "keydown"].forEach((ev) =>
      window.addEventListener(ev, () => s.started && G.Audio.unlock(), { passive: true }),
    );
    await buildWorld(s, pickTier(saved));
    await buildActors(s);
    await loadTextures();
    await precompile(s);
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

  /** Clear the save and reload for a brand-new game (pause menu). */
  function startOver() {
    const s = G.S;
    if (s.storage) KQ.Sim.Save.clear(s.storage);
    s.paused = false;
    location.reload();
  }

  /** Entry point: show the friendly card when WebGL is missing, else run the boot sequence. */
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
