/* ============================================================================
 * FILE: defer.js
 * PURPOSE: A time-sliced work queue (KQ.Game.Defer). Heavy one-off work (texture uploads, posture
 *          pictures, a far part of the world, a crowd fill) is queued as small jobs and run a few
 *          milliseconds per animation frame, so neither the loading screen nor play ever freezes
 *          on one long main-thread task.
 * BUSINESS CONTEXT: AC-P22 (boot work deferred / streamed, the loading bar moves), AC-P23 (no main-
 *   thread stall over 200 ms after Start on an iPad-class device);
 *   features/kampung-quest-playability/notes-ipad.md describes how to use it for new content.
 * USAGE:
 *   Defer.add(fn, label, opts)  queue a job; `fn()` returning true means "not finished, call again";
 *                               opts.when() = only run while it is true (e.g. Defer.notPlaying)
 *   await Defer.drain(onStep)   run everything now, sliced, yielding a frame between slices
 *                               (onStep(done, total) drives a progress bar)
 *   Defer.flush()               run every queued job at once (tests, or work needed this instant)
 *   Defer.stats()               { pending, done, longestMs, label of the longest job }
 * Jobs run in the order added. The queue starts itself when a job is added and stops when empty.
 * DEPENDENCIES: none (game layer; loads before boot.js).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  /** Milliseconds of queued work per frame: half a 60 fps frame, leaving room for the frame itself. */
  const BUDGET_MS = 8;
  const queue = [];
  const counters = { done: 0, added: 0, longestMs: 0, longest: "" };
  let scheduled = false;
  let draining = 0;

  /** Run one job; it stays at the head of the queue while it returns true. Notes the slowest. */
  function runOne() {
    const job = queue[0];
    const t0 = performance.now();
    let again = false;
    try {
      again = job.fn() === true;
    } catch (err) {
      console.warn("[KQ] deferred job failed:", job.label, err && err.message);
    }
    const ms = performance.now() - t0;
    if (ms > counters.longestMs) {
      counters.longestMs = ms;
      counters.longest = job.label;
    }
    if (!again) {
      queue.shift();
      counters.done += 1;
    }
  }

  /** May the head job run now? A job with a `when` test waits (in order) until it passes. */
  const headReady = (forced) => forced || !queue[0].when || queue[0].when();

  /**
   * Run jobs until the frame budget is spent, the queue is empty or the head job is waiting for
   * its `when`; true when work remains. `forced` (drain) ignores `when`.
   */
  function slice(budget, forced) {
    const t0 = performance.now();
    while (queue.length && headReady(forced) && performance.now() - t0 < budget) runOne();
    return queue.length > 0;
  }

  /** Next frame, then a macrotask: the work lands after the frame has been drawn. */
  function afterFrame(fn) {
    const raf = window.requestAnimationFrame || ((f) => setTimeout(f, 16));
    raf(() => setTimeout(fn, 0));
  }

  /** The background pump: one slice per frame while there is work (and no drain is running it). */
  function pump() {
    scheduled = false;
    if (draining || !slice(BUDGET_MS)) return;
    schedule();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    afterFrame(pump);
  }

  /**
   * Queue a job. `fn()` returns true to be called again (a job that does its work in pieces).
   * `opts.when()`: run only while it returns true (e.g. "not during play": the title screen or the
   * pause menu); jobs behind it wait too, so order is kept.
   */
  function add(fn, label, opts) {
    queue.push({ fn, label: label || "job", when: opts && opts.when });
    counters.added += 1;
    schedule();
  }

  /**
   * Run the whole queue now in frame-sized slices; resolves when it is empty. `onStep(done, total)`
   * is called after each slice (the loading bar). `budget` defaults to BUDGET_MS; the loading screen
   * may use a larger one since nothing else is moving.
   */
  async function drain(onStep, budget) {
    draining += 1;
    const total = queue.length;
    const start = counters.done;
    try {
      while (slice(budget || BUDGET_MS, true)) {
        if (onStep) onStep(counters.done - start, total);
        await new Promise((res) => afterFrame(res));
      }
    } finally {
      draining -= 1;
    }
    if (onStep) onStep(total, total);
  }

  /** Run everything queued immediately (tests; or when the result is needed this instant). */
  function flush() {
    while (queue.length) runOne();
  }

  /** Counters for the probes and tests. */
  function stats() {
    return {
      pending: queue.length,
      done: counters.done,
      added: counters.added,
      longestMs: Math.round(counters.longestMs),
      longest: counters.longest,
    };
  }

  /** A `when` for work that must not hitch play: the title screen, the pause menu or a hidden tab. */
  function notPlaying() {
    const s = G.S;
    return !s || !s.started || s.paused || s.hidden;
  }

  G.Defer = { add, drain, flush, stats, notPlaying, BUDGET_MS };
})((window.KQ = window.KQ || {}));
