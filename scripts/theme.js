/* =============================================================================
   FILE: scripts/theme.js
   PURPOSE: Applies the player's saved light/dark choice to <html data-theme>
            BEFORE first paint (no flash) and exposes a tiny toggle API.

   OWNER: PlayPad maintainers (see CONTRIBUTING.md)
   LAST REVIEWED: 2026-11-21 by PLAY-006 hub implementation

   BUSINESS CONTEXT:
     The hub follows the system light/dark preference by default (tokens.css).
     Players on a phone that is stuck on one scheme still want the other, so the
     hub gets a manual toggle (PLAY-006, features/playpad-revamp/design-hub.md
     D6). There is no third "system" state: no stored choice = follow the system;
     the first press stores an explicit choice.

   OPT-IN FOR GAME PAGES (one line, anywhere inside <head>, as a plain classic
   script, no defer/async/module; the path is relative to the page, and games
   live at games/<slug>/index.html):
       <script src="../../scripts/theme.js"></script>
   Games that are always dark on purpose should NOT include it (Sunset Stride does include it: its
   3D stage is always bright, but its setup / results / shop chrome follows the theme).
   It is safe to include from any page depth: it loads nothing by URL.

   MODULE CONTRACT:
     RESPONSIBILITIES:
       - Read the stored choice and set <html data-theme="light|dark">.
       - Keep every <meta name="theme-color"> in step with an explicit choice.
       - Expose window.PlayPadTheme { current, toggle } and fire a
         "playpad-themechange" event on document when the effective theme changes.
     PRECONDITIONS (caller ensures):
       - Loaded as a classic <script> (no module, no defer) in <head> so the
         attribute is set before the first paint.
     GUARANTEES:
       - Never throws: storage that is blocked, full or corrupted is ignored and
         the page keeps following the system.
       - Only the exact strings "light" and "dark" are ever applied.
       - Loads nothing, fetches nothing, touches nothing outside <html> and the
         theme-color metas. Same-origin script, so it passes the site CSP.
     DOES NOT:
       - Render the toggle button (each page owns its own control).
       - Persist anything except the single key below.

   STORAGE: key "playpad.theme" = "light" | "dark". Absent = follow the system.
            Clearing site data resets it.

   DEPENDENCIES: styles/tokens.css ([data-theme] overrides). No external deps.

   HOW TO TEST: npm run smoke (the hub test flips the theme and reloads).
                Manual: localStorage.setItem("playpad.theme","light"); reload.

   KNOWN ISSUES: none.

   CHANGELOG (last 3 significant changes):
     2026-11-21 - Created for the hub revamp (PLAY-006).
   ============================================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "playpad.theme";
  var EVENT_NAME = "playpad-themechange";
  // Browser-chrome colours. They MUST equal the surface role in tokens.css.
  var CHROME_COLOR = { light: "#fff8f7", dark: "#08080c" };

  var root = document.documentElement;
  var systemLightQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null;

  /**
   * Validate a raw stored value.
   * @param {*} value Anything read from storage (untrusted).
   * @returns {"light"|"dark"|null} The theme, or null when absent or unknown.
   */
  function sanitizeTheme(value) {
    return value === "light" || value === "dark" ? value : null;
  }

  /**
   * Read the saved choice. Fail-soft: blocked storage reads as "no choice".
   * @returns {"light"|"dark"|null}
   */
  function readStoredTheme() {
    try {
      return sanitizeTheme(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return null; // storage blocked (private mode, disabled cookies): follow the system
    }
  }

  /**
   * Save the choice. Fail-soft: the toggle still works for this page view.
   * @param {"light"|"dark"} theme Already-validated theme.
   * @returns {boolean} true when saved, false when storage refused (the choice
   *   then lasts for this page view only).
   */
  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
      return true;
    } catch (error) {
      return false; // private mode or quota
    }
  }

  /**
   * The theme currently on screen: the explicit choice, else the system's.
   * @returns {"light"|"dark"}
   */
  function current() {
    var explicit = sanitizeTheme(root.dataset.theme);
    if (explicit) return explicit;
    return systemLightQuery && systemLightQuery.matches ? "light" : "dark";
  }

  /**
   * Point every <meta name="theme-color"> at the chosen theme. Only called for
   * an explicit choice: with no choice the page's own media-aware metas already
   * follow the system, and we must not override a game's own colour.
   * @param {"light"|"dark"} theme
   */
  function syncChromeColor(theme) {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var index = 0; index < metas.length; index++) {
      metas[index].setAttribute("content", CHROME_COLOR[theme]);
    }
  }

  /** Tell the page the effective theme changed (so it can repaint its toggle). */
  function announce() {
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { theme: current() } }));
  }

  /**
   * Apply an explicit theme to the document and the browser chrome.
   * @param {"light"|"dark"} theme
   */
  function applyTheme(theme) {
    root.dataset.theme = theme;
    syncChromeColor(theme);
  }

  /**
   * Flip between light and dark and remember the choice.
   * @returns {"light"|"dark"} The theme now showing.
   * Debug hint: stuck on one theme? Check localStorage "playpad.theme" holds
   * exactly "light" or "dark", and that tokens.css has the [data-theme] blocks.
   */
  function toggle() {
    var next = current() === "dark" ? "light" : "dark";
    applyTheme(next);
    writeStoredTheme(next);
    announce();
    return next;
  }

  // ── STEP 1: apply the stored choice immediately (runs in <head>, pre-paint) ──
  var stored = readStoredTheme();
  if (stored) root.dataset.theme = stored;

  // ── STEP 2: the metas below this script are not parsed yet, so sync again ──
  document.addEventListener("DOMContentLoaded", function () {
    if (stored) syncChromeColor(stored);
  });

  // ── STEP 3: keep multiple tabs and system changes consistent ──
  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY) return;
    var next = sanitizeTheme(event.newValue);
    if (next) {
      applyTheme(next);
    } else {
      delete root.dataset.theme; // another tab cleared the choice: follow the system
      syncChromeColor(current());
    }
    announce();
  });
  if (systemLightQuery && systemLightQuery.addEventListener) {
    systemLightQuery.addEventListener("change", function () {
      if (!sanitizeTheme(root.dataset.theme)) announce(); // only matters with no explicit choice
    });
  }

  window.PlayPadTheme = { current: current, toggle: toggle };
})();
