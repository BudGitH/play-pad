/* ============================================================================
 * FILE: boot-perf.js
 * PURPOSE: The loading-speed and device helpers boot.js uses (KQ.Game.BootPerf): boot stage
 *          timings, the touch-UI class for iPads that report a fine pointer, sliced texture
 *          uploads behind the loading bar, and the WebGL context-loss card.
 * BUSINESS CONTEXT: AC-P21 (an iPad is a touch tablet even with a Magic Keyboard), AC-P22 (boot
 *   work is sliced and the bar shows real progress), AC-P23 (no long stall; a lost WebGL context
 *   is recovered or shown as a friendly card). Numbers: features/kampung-quest-playability/notes-ipad.md.
 * DEPENDENCIES: defer.js (KQ.Game.Defer), boot-ui.js, settings.js (G.Env), loop.js (pause, save).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  /** Boot stage timings: [name, ms since navigation]. */
  const timings = [];

  /** Note that a boot stage finished (also a Performance mark, visible in Safari's Web Inspector). */
  function mark(name) {
    timings.push([name, Math.round(performance.now())]);
    try {
      performance.mark("kq:" + name);
    } catch (err) {
      timings.push(["mark-failed:" + name, 0]);
    }
  }

  /**
   * Show the touch controls whenever the device is touch-first (G.Env.coarse also covers an iPad
   * that reports `pointer: fine`); the stylesheet mirrors its `(pointer: coarse)` rules on this class.
   */
  function applyDeviceClass(root) {
    root.classList.toggle("kq-touch-ui", Boolean(G.Env.coarse));
    root.classList.toggle("kq-tablet", Boolean(G.Env.tablet));
  }

  /**
   * Before the world is built: on the low tier (phones, iPads, software GL) use the half-size copies
   * of the 1024 px photos and a 512 px occlusion field. A quarter of the texture memory for those
   * (iPad Safari's per-tab memory budget) and of the field's build time (AC-P22). The tier is
   * fixed at boot for these; a later tier change keeps them.
   */
  function worldBudget(tier) {
    const P = KQ.WorldParts || {};
    const lite = tier === "low";
    if (P.Tex) P.Tex.half = lite;
    if (P.AOField) P.AOField.res = lite ? 512 : 1024;
  }

  /** Every texture the scene's materials use (each once). */
  function sceneTextures(scene) {
    const seen = new Set();
    scene.traverse(function (o) {
      [].concat(o.material || []).forEach(function (m) {
        Object.keys(m).forEach((k) => m[k] && m[k].isTexture && seen.add(m[k]));
      });
    });
    return Array.from(seen);
  }

  /**
   * Upload the scene's textures to the GPU one per job, several per frame, before the shader
   * compile (which otherwise uploads all of them inside its one long task). `onStep(fraction)`
   * moves the loading bar. Textures still waiting for their image are left to three (they upload
   * when they arrive).
   */
  async function uploadTextures(renderer, scene, onStep) {
    const list = sceneTextures(scene).filter((t) => t.image && t.version > 0);
    list.forEach((t) => G.Defer.add(() => renderer.initTexture(t), "texture upload"));
    await G.Defer.drain((done, total) => onStep(done / Math.max(1, total)), 30);
    mark("textures-uploaded");
    return list.length;
  }

  /**
   * Run `draw` (the loader's warm-up render) with frustum culling off, so every mesh's buffers
   * reach the GPU behind the loading screen instead of on the first frames after Start, when the
   * camera first sees them (AC-P23). Culling is restored afterwards.
   */
  function drawEverything(scene, draw) {
    const culled = [];
    scene.traverse(function (o) {
      if (o.frustumCulled && (o.isMesh || o.isPoints || o.isLine)) {
        culled.push(o);
        o.frustumCulled = false;
      }
    });
    try {
      draw();
    } finally {
      culled.forEach((o) => (o.frustumCulled = true));
    }
  }

  /* ------------------------------ WebGL context loss ------------------------------ */

  /** The card shown while the GPU context is gone; Reload saves first. */
  function lostCard(show) {
    const card = document.getElementById("kqLost");
    if (card) card.hidden = !show;
  }

  /**
   * iPad Safari drops the WebGL context under memory pressure (or after a long time in the
   * background). On loss: stop the game, save, and show a friendly card with a Reload button.
   * three r147 rebuilds its GL state on restore; then the card closes and the game carries on
   * from the pause it was in.
   */
  function watchContext(s) {
    const reload = document.getElementById("kqLostReload");
    if (reload)
      reload.addEventListener("click", function () {
        if (s.started) G.Loop.save();
        location.reload();
      });
    s.stage.addEventListener("webglcontextlost", function (e) {
      e.preventDefault(); // allows the browser to restore it
      s.contextLost = true;
      if (s.started) {
        G.Loop.save();
        s.lostPaused = !s.paused;
        G.Loop.setPaused(true);
      }
      lostCard(true);
    });
    s.stage.addEventListener("webglcontextrestored", function () {
      s.contextLost = false;
      lostCard(false);
      if (s.started && s.lostPaused) G.Loop.setPaused(false);
      s.lostPaused = false;
    });
  }

  G.BootPerf = {
    mark,
    timings,
    applyDeviceClass,
    drawEverything,
    worldBudget,
    sceneTextures,
    uploadTextures,
    watchContext,
  };
})((window.KQ = window.KQ || {}));
