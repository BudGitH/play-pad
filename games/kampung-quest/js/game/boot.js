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
  /** The title backdrop draws on one rAF in this many: a software-GL frame there is a long task,
   *  and the player is waiting to press Start (notes-ipad.md). The orbit speed compensates. */
  const ORBIT_EVERY = 6;
  /** A new game starts in the void deck of Block 118, a few steps from Nenek (and clear of the lift). */
  const KAMPUNG_START = { x: -42.6, z: 22.4 };
  /** Where a new game starts: the void deck (kampung) or the hotel forecourt (Haramain). */
  const startSpot = () => (KQ.region === "haramain" ? KQ.HOLY.spawn : KAMPUNG_START);

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
    renderer.toneMappingExposure = 1.0; // AC-P20: a touch brighter (no clipped white, measured)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    s.renderer = renderer;
    s.scene = new THREE.Scene();
    s.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
    G.Camera.init(s.camera);
    return renderer;
  }

  /**
   * Choose the quality tier: the ?q= flag, else the save, else low on touch (phones and tablets,
   * iPads included even with a keyboard: an iPad gen 7 has a weaker GPU than the phones that
   * already start low; AC-P21) and on software GL, and high elsewhere.
   */
  function pickTier(saved) {
    const q = params.get("q");
    if (q === "low" || q === "med" || q === "high") return q;
    if (saved.status === "loaded") return saved.state.settings.quality;
    return G.Env.coarse || G.Env.softwareGL ? "low" : "high";
  }

  /** Build the neighbourhood behind the loading screen (step 1). */
  async function buildWorld(s, tier) {
    BU().setStep(0, "now");
    BU().setProgress(0.04);
    await nextFrame();
    G.BootPerf.worldBudget(tier);
    s.world = KQ.World.build(s.scene, {
      quality: tier,
      renderer: s.renderer,
      assetBase: KQ.ASSET_BASE,
    });
    s.quality = tier;
    G.Loop.resize();
    BU().setStep(0, "done");
    BU().setProgress(0.4);
    G.BootPerf.mark("world");
  }

  /** Create the hero, NPCs, markers and collectibles (step 2). */
  async function buildActors(s) {
    BU().setStep(1, "now");
    await nextFrame();
    s.player = G.Player.create(s.scene);
    s.player.group.visible = false;
    s.npcs = G.Npcs.create(s.scene, s.world, null);
    s.crowd = G.Crowd.create(s.scene, s.world, s.npcs, s.renderer, s.camera);
    s.markers = G.Markers.create(s.scene);
    s.collect = G.Collectibles.create(s.scene, s.world);
    G.Vehicles.prepare(G.Defer); // queued, drained behind the loading bar (before the crowd's first prune)
    G.Defer.add(() => G.Crowd.prune(s.crowd), "crowd prune"); // after every vehicle job above
    G.Loop.studioShine(s);
    BU().setStep(1, "done");
    BU().setProgress(0.5, "Waking up the neighbours...");
    G.BootPerf.mark("actors");
  }

  /**
   * Build one quality tier's shader variants: the world's look and light count, the figures that
   * cast shadows on that tier, a compile of everything, and one tiny render that also builds the
   * shadow-depth programs (renderer.compile does not). Leaves the scene on that tier.
   */
  function compileTier(s, tier) {
    s.quality = tier;
    s.world.setQuality(tier);
    G.Loop.figureShadows(s);
    s.world.setShadowTarget(startSpot());
    G.Crowd.showAll(s.crowd, true);
    s.renderer.compile(s.scene, s.camera);
    G.BootPerf.mark("compile-" + tier);
    G.BootPerf.drawEverything(s.scene, () => s.renderer.render(s.scene, s.camera));
    G.BootPerf.mark("render-" + tier);
    G.Crowd.showAll(s.crowd, false);
  }

  /**
   * Compile the shader programs the auto-downgrade can reach behind the loading screen: the start
   * tier and every tier BELOW it (Loop.monitor only ever drops tiers), so Start, the first walk to
   * a new area and a downgrade never freeze on a compile (PERF-08, R2-PERF-01, R2-PERF-04). Higher
   * tiers are only reached by a manual settings change and are built later by compileAbove, which
   * keeps the loader short (R3-PERF-01: compiling all three tiers tripled the load time). The
   * canvas is shrunk while doing it (programs do not depend on size) and the hero, hidden until
   * Start, is shown so its meshes are drawn too. One frame is yielded between tiers so the loading
   * screen keeps painting; the start tier goes last so it is the state the game begins in.
   */
  async function precompile(s) {
    BU().setProgress(0.86, "Making everything shiny...");
    await nextFrame();
    const start = s.quality;
    const heroShown = s.player.group.visible;
    s.player.group.visible = true;
    s.renderer.setSize(2, 2, false);
    const order = TIERS.slice(0, TIERS.indexOf(start)).concat(start);
    for (const tier of order) {
      compileTier(s, tier);
      await nextFrame();
    }
    s.player.group.visible = heroShown;
    G.Loop.resize();
    G.BootPerf.mark("shaders");
  }

  /**
   * Compile one tier that the loader skipped, then put the scene back on the tier in play. Runs
   * between frames, so no half-set state is ever drawn: the tier, the figures' shadows and the
   * renderer size are restored before the next rAF.
   */
  function compileOther(s, tier) {
    const keep = s.quality;
    s.renderer.setSize(2, 2, false);
    compileTier(s, tier);
    s.quality = keep;
    s.world.setQuality(keep);
    G.Loop.figureShadows(s);
    G.Loop.resize();
  }

  /**
   * Build the tiers ABOVE the start tier after Start, one per tick, only while the Pause menu is
   * open (the game is stopped, so the one-off compile is hidden behind the menu) or never at all if
   * the player stays in the game. A manual upgrade made before that just compiles on the spot.
   * Stops by itself once every tier is built.
   */
  function compileAbove(s, start) {
    const todo = TIERS.slice(TIERS.indexOf(start) + 1);
    const timer = setInterval(function () {
      if (!todo.length) clearInterval(timer);
      else if (s.started && s.paused && !s.hidden) compileOther(s, todo.shift());
    }, 500);
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

  /**
   * Wait for the photo textures (over http) or note that they are drawn in code (file://), then
   * upload every texture a few per frame so the shader step does not do it in one long task.
   */
  async function loadTextures(s) {
    await fetchTextures();
    await G.BootPerf.uploadTextures(s.renderer, s.scene, (f) =>
      BU().setProgress(0.66 + 0.2 * f, "Painting the town..."),
    );
  }

  /** The photo downloads (bar 50 -> 66 %), or the file:// note. */
  async function fetchTextures() {
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
      BU().setProgress(0.5 + 0.16 * (loaded / Math.max(1, total)), "Painting the town...");
    await waitUntil(() => !mgr.isLoading, 20000);
    G.BootPerf.mark("textures-loaded");
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

  /**
   * Queue the posture pictures for the prayer screens on the time-sliced queue, one per frame,
   * after Start is enabled (the title screen is idle; a prayer screen opened first renders the rest
   * at once). Labels only if that fails.
   */
  function renderPictures(s) {
    BU().setStep(4, "now");
    try {
      G.Pictures.queuePostures(s.renderer, G.Defer);
      G.Defer.add(() => BU().setStep(4, "done"), "pictures done");
    } catch (err) {
      console.warn("[KQ] posture pictures skipped:", err && err.message);
      BU().setStep(4, "skip", "labels only");
    }
  }

  /* ------------------------------ title backdrop ------------------------------ */

  /**
   * Slowly orbit the camera around the town behind the title card until the game starts (frozen in
   * tests, throttled).
   */
  function titleOrbit(s) {
    let a = 0;
    // The backdrop is a wide view of the town behind a modal card, and the player is about to press
    // Start: it renders at half resolution (Loop.resize, while the game has not started) and its
    // shadow map, whose target never moves here, is drawn once (notes-ipad.md, the Start-tap round).
    G.Loop.resize();
    (function loop() {
      if (s.started) return;
      requestAnimationFrame(loop);
      if (s.frozen) return;
      s.orbitSkip = (s.orbitSkip || 0) + 1;
      if (s.orbitSkip % ORBIT_EVERY) return;
      a += 0.01 * ORBIT_EVERY * 0.33;
      const cam = G.Region.titleCamera(a);
      if (cam) {
        s.camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
        s.camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
      } else {
        s.camera.position.set(14 + Math.sin(a) * 34, 7.5, -16 + Math.cos(a) * 34);
        s.camera.lookAt(20, 2.2, -20);
      }
      s.world.update(0, { minute: 640 });
      s.world.setShadowTarget(cam ? cam.target : { x: 20, z: -20 });
      s.renderer.render(s.scene, s.camera);
      s.renderer.shadowMap.autoUpdate = false; // the target is fixed here; launch() turns it back on
    })();
  }

  /* ------------------------------ launch ------------------------------ */

  /**
   * Start a game from a state: build the sim, place hero and NPCs, hide the title, show the HUD and
   * start the loop.
   */
  function launch(s, state) {
    // Anything queued without a `when` gate (vehicles, the bus, traffic, the crowd's slot prune)
    // belongs to the world and must exist before the first frame: a test that drives game time
    // with __kq.step never waits for the queue's own animation frames (notes-ipad.md).
    G.Defer.flushUngated();
    s.sim = G.Sim.create(state);
    G.Audio.setMuted(state.settings.muted);
    G.Player.applyOutfit(s.player, s.sim.outfit);
    G.Npcs.attachSim(s.npcs, s.sim);
    const pos = s.sim.pos || startSpot();
    G.Player.place(s.player, pos.x, pos.z, s.sim.pos ? 0 : startHeading(), s.world.heightAt);
    s.player.group.visible = true;
    G.Camera.snapBehind(s.player.heading);
    s.sim.prayer.update(s.sim.clock.minute, s.sim.clock.day);
    G.Npcs.snapAll(s.npcs);
    G.Loop.setQuality(s.quality);
    s.started = true;
    s.renderer.shadowMap.autoUpdate = true; // the title backdrop drew its shadow map once
    G.Loop.resize(); // back to full resolution: the backdrop rendered at half (titleOrbit)
    document.body.classList.add("kq-playing");
    s.hudHost.hidden = false;
    BU().hideTitle();
    G.Loop.frame(0);
    G.PrayerFlow.restoreDue();
    G.PrayerFlow.resume();
    const welcome = G.Region.welcome(KQ.region === "haramain" ? KQ.Holy.cityOf(pos.x) : null);
    if (welcome) G.UI.toast(welcome, "good", 7000, "holy-welcome");
    else if (!s.sim.pos)
      G.UI.toast(
        "Nenek is waiting by your block. Walk to her and press Talk.",
        "good",
        7000,
        "nenek",
      );
    if (!s.loopStarted) {
      s.loopStarted = true;
      G.Loop.start();
    }
  }

  /** The way a new hero faces: west in the void deck (the qibla there), south toward the Haram's gate. */
  const startHeading = () => (KQ.region === "haramain" ? 0 : -Math.PI / 2);

  /**
   * Start or continue the game from a title button; New game also clears the save. A new game
   * wears the hero picked on the title card (boy or girl, in that hero's own default clothes).
   */
  function begin(s, saved, fresh) {
    G.Audio.unlock();
    G.Audio.loadAzan();
    if (fresh && s.storage) KQ.Sim.Save.clear(s.storage);
    const isNew = fresh || saved.status !== "loaded";
    const state = isNew ? KQ.Sim.Save.defaultState() : saved.state;
    if (fresh) state.settings.quality = s.quality;
    if (isNew) Object.assign(state, KQ.Sim.Hero.start(G.Hero.choice(), saved.state.hero));
    launch(s, state);
    G.HudLayout.armTurnHint();
  }

  /** The "Continue · day N, HH:MM" title-button text, empty for a new game. */
  function savedLabel(saved) {
    if (saved.status !== "loaded") return "";
    const c = saved.state.clock;
    return "Continue \u00b7 " + KQ.Sim.Clock.dayTimeLabel(c.day, c.minute);
  }

  /** The saved game (untrusted, cleaned by KQ.Sim.Save), or a fresh one when storage is blocked. */
  function loadSave(storage) {
    if (!storage) return { state: KQ.Sim.Save.defaultState(), status: "unavailable" };
    return KQ.Sim.Save.load(storage);
  }

  /** The boot sequence: bind the title, read prefs and save, build everything, then wait for Start. */
  async function run(root) {
    BU().bind();
    const storage = G.Settings.getStorage();
    G.Settings.load(storage);
    const saved = loadSave(storage);
    const s = (G.S = makeState(root));
    s.storage = storage;
    G.Hero.initPicker(saved.status !== "loaded", saved.state.hero && saved.state.hero.gender);
    G.BootPerf.applyDeviceClass(root);
    G.UI.init(root);
    G.Speech.init();
    createRenderer(s, pickTier(saved));
    G.BootPerf.watchContext(s);
    G.Hud.build(s.hudHost, G.Actions.handle);
    G.LifeChip.init(); // an empty status region from the start, so the first event hint is announced
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
    await loadTextures(s);
    await precompile(s);
    await loadAzan();
    renderPictures(s);
    if (!storage)
      BU().note("Saving is off in this browser, so your progress lasts until you close the tab.");
    BU().ready(savedLabel(saved));
    titleOrbit(s);
    const refs = BU().refs;
    refs.start.addEventListener("click", () => begin(s, saved, false));
    // New game with a save: the first press puts up "Who are you?", the next one starts
    refs.newGame.addEventListener("click", () => G.Hero.reveal() || begin(s, saved, true));
    compileAbove(s, s.quality);
    G.BootPerf.mark("ready");
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
