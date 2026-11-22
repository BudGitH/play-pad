/* =============================================================================
   FILE: scripts/viewport.js
   PURPOSE: Publishes the height the player can ACTUALLY see as the CSS custom
            property --pp-app-h on <html>, so full-screen game shells fit it and
            their bottom controls (Start, Submit, Clear) are never cut off.

   OWNER: PlayPad maintainers (see CONTRIBUTING.md)
   LAST REVIEWED: 2026-11-22 by the viewport-fit bug fix

   BUSINESS CONTEXT:
     Every game locks the page with `body { position: fixed }` and pins its
     Start bar / guess deck to the bottom of that box. On Android the fixed box
     can be taller than the visible screen (Chrome draws edge-to-edge from
     v135, its toolbar and "chin" come and go, installed PWAs draw behind the
     system bars), so the bottom 50-80px — Start, Submit — sat off-screen and
     the game could not be played. Confirmed cause: base.css's body
     `min-height: 100dvh` lifted the shell past `height: 100%`. Suspected
     (unverified on the device): the Android viewport/dvh sizing. The shell is
     sized to min(its own fixed box, visualViewport.height) so it follows the
     visible area whichever way the browser reports it.
     See docs/LEARNINGS.md (viewport row) and docs/DECISIONS.md.

   DIAGNOSTIC: open any game with ?vpdebug in the URL to show the measured
   heights in a corner overlay (for on-device bug reports; no effect otherwise).

   OPT-IN FOR GAME PAGES (one line in <head>, next to theme.js, classic script):
       <script src="../../scripts/viewport.js"></script>
   and size the shell with `height: min(100%, var(--pp-app-h, 100%));
   min-height: 0` instead of `inset: 0`.

   MODULE CONTRACT:
     RESPONSIBILITIES:
       - Set --pp-app-h (px) on <html> before first paint and keep it current on
         visualViewport / window resize, orientation change and bfcache restore.
       - When the value changes, fire a window "resize" so games that measure
         their canvas on resize (Colour Rush, Sunset Stride) re-measure too.
     GUARANTEES:
       - Never throws; with no visualViewport it falls back to innerHeight.
       - Ignores pinch-zoom (scale > 1), so zooming in never shrinks the game.
       - Never reports more than the window height.
     DOES NOT:
       - Touch layout itself — each page decides what to size with the value.
   ============================================================================= */
(function () {
  "use strict";

  var root = document.documentElement;
  var last = 0;

  /** The visible height in CSS px: the smaller of the window and the visual viewport. */
  function visibleHeight() {
    var h = window.innerHeight;
    var vv = window.visualViewport;
    // A pinch-zoomed visual viewport is smaller on purpose; the layout should not chase it.
    if (vv && vv.height > 0 && vv.scale <= 1.01) h = Math.min(h, vv.height);
    return Math.floor(h);
  }

  function update() {
    var h = visibleHeight();
    if (h > 0 && h !== last) {
      last = h;
      root.style.setProperty("--pp-app-h", h + "px");
      // Re-entrant call from this event sees the same height and stops (no loop).
      window.dispatchEvent(new Event("resize"));
    }
    if (debugEl) showDebug();
  }

  /* ---- ?vpdebug: on-device readout of every height that could disagree ---- */
  var debugEl = null;

  function probeHeight(css) {
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;top:0;left:0;width:1px;visibility:hidden;" + css;
    document.body.appendChild(d);
    var h = Math.round(d.getBoundingClientRect().height);
    d.remove();
    return h;
  }

  function showDebug() {
    var vv = window.visualViewport;
    var standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    debugEl.textContent = [
      "innerHeight " + window.innerHeight + " · outer " + window.outerHeight,
      "visualViewport " + (vv ? Math.round(vv.height) + " (scale " + vv.scale + ")" : "none"),
      "screen " + screen.width + "x" + screen.height + " · DPR " + window.devicePixelRatio,
      "100vh " + probeHeight("height:100vh") + " · dvh " + probeHeight("height:100dvh"),
      "svh " + probeHeight("height:100svh") + " · lvh " + probeHeight("height:100lvh"),
      "fixed inset:0 " + probeHeight("bottom:0"),
      "safe-area top " +
        probeHeight("height:env(safe-area-inset-top)") +
        " · bottom " +
        probeHeight("height:env(safe-area-inset-bottom)"),
      "--pp-app-h " + last + " · body " + Math.round(document.body.getBoundingClientRect().height),
      "standalone " + standalone,
    ].join("\n");
  }

  function startDebug() {
    debugEl = document.createElement("pre");
    debugEl.setAttribute("aria-hidden", "true");
    debugEl.style.cssText =
      "position:fixed;top:40%;left:4px;z-index:2147483647;margin:0;padding:6px 8px;" +
      "font:11px/1.35 monospace;color:#fff;background:rgba(0,0,0,.8);border-radius:6px;" +
      "pointer-events:none;white-space:pre";
    document.body.appendChild(debugEl);
    showDebug();
  }

  update();
  if (window.visualViewport) window.visualViewport.addEventListener("resize", update);
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  window.addEventListener("pageshow", update);

  if (/[?&]vpdebug\b/.test(location.search)) {
    if (document.body) startDebug();
    else document.addEventListener("DOMContentLoaded", startDebug);
  }
})();
