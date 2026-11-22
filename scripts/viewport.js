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
     the game could not be played. visualViewport.height is the browser's own
     answer to "how much is visible right now", so the shell is sized to it.
     See docs/LEARNINGS.md (viewport row) and docs/DECISIONS.md.

   OPT-IN FOR GAME PAGES (one line in <head>, next to theme.js, classic script):
       <script src="../../scripts/viewport.js"></script>
   and size the shell with `height: var(--pp-app-h, 100%)` instead of `inset: 0`.

   MODULE CONTRACT:
     RESPONSIBILITIES:
       - Set --pp-app-h (px) on <html> before first paint and keep it current on
         visualViewport / window resize, orientation change and bfcache restore.
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
    return Math.round(h);
  }

  function update() {
    var h = visibleHeight();
    if (h > 0 && h !== last) {
      last = h;
      root.style.setProperty("--pp-app-h", h + "px");
    }
  }

  update();
  if (window.visualViewport) window.visualViewport.addEventListener("resize", update);
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  window.addEventListener("pageshow", update);
})();
