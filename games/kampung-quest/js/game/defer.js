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
 *   Defer.flushUngated()        run every job that has no `when` gate now (launch does this, so the
 *                               world is complete the instant the game starts)
 *   Defer.stats()               { pending, done, longestMs, label of the longest job }
 * Jobs run in the order added. The queue starts itself when a job is added and stops when empty.
 * DEPENDENCIES: none (game layer; loads before boot.js).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  /** Milliseconds of queued work per frame: half a 60 fps frame, leaving room for the frame itself. */
  const BUDGET_MS = 8;
  /** How often (ms) the pump looks again while the head job is waiting for its `when` (not every frame). */
  const WAIT_POLL_MS = 500;
  const queue = [];
  const counters = { done: 0, added: 0, longestMs: 0, longest: "" };
  let scheduled = false;
  let draining = 0;

  /** Run one slice of a job; true means it asked to be called again. Notes the slowest. */
  function runJob(job) {
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
    if (!again) counters.done += 1;
    return again;
  }

  /** Run one job; it stays at the head of the queue while it returns true. */
  function runOne() {
    if (!runJob(queue[0])) queue.shift();
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

  /**
   * The background pump: one slice per frame while there is work (and no drain is running it); while the
   * head job waits for its `when` (e.g. play is on), it only looks again every WAIT_POLL_MS.
   */
  function pump() {
    scheduled = false;
    if (draining || !slice(BUDGET_MS)) return;
    schedule(headReady(false) ? 0 : WAIT_POLL_MS);
  }

  /** Arrange the next pump: after the next frame, or after `delayMs` when the queue is only waiting. */
  function schedule(delayMs) {
    if (scheduled) return;
    scheduled = true;
    if (delayMs) setTimeout(pump, delayMs);
    else afterFrame(pump);
  }

  /**
   * Queue a job. `fn()` returns true to be called again (a job that does its work in pieces).
   * `opts.when()`: run only while it returns true (e.g. "not during play": the title screen or the
   * pause menu); jobs behind it wait too, so order is kept.
   */
  function add(fn, label, opts) {
    queue.push({ fn, label: label || "job", when: opts && opts.when });
    counters.added += 1;
    schedule(0);
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

  /**
   * Run every queued job that has no `when` gate, now, leaving the gated ones (the posture
   * pictures) for their own moment. `launch` calls it, so anything the world needs is placed and
   * running the instant the game starts — a spec that drives game time with `__kq.step` never
   * waits on a real-time rAF queue (notes-ipad.md).
   */
  function flushUngated() {
    const gated = [];
    while (queue.length) {
      const job = queue.shift();
      if (job.when) gated.push(job);
      else {
        while (runJob(job));
      }
    }
    gated.forEach((job) => queue.push(job));
    if (queue.length) schedule();
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

  /**
   * A `when` for work that must not hitch play OR the title screen: the pause menu and a hidden
   * tab only. The title screen looks idle but is not — it orbits the town and the player is about
   * to press Start, and a long job there delays that press (notes-ipad.md, the Start-tap round).
   */
  function whileIdle() {
    const s = G.S;
    return Boolean(s && s.started && (s.paused || s.hidden));
  }

  G.Defer = { add, drain, flush, flushUngated, stats, notPlaying, whileIdle, BUDGET_MS };
})((window.KQ = window.KQ || {}));
