/* ============================================================================
 * FILE: util.js
 * PURPOSE: Small shared helpers for the Kampung Quest game layer (KQ.Game.U):
 *          maths, a seeded RNG, and the one DOM builder every UI file uses.
 * BUSINESS CONTEXT: PLAY-013. Risk rule (requirements NFR): every string reaches the DOM
 *   through textContent only - U.el never sets innerHTML for text.
 * DEPENDENCIES: none (loads first in js/game).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = (G.U = {});
  const SVG_NS = "http://www.w3.org/2000/svg";

  U.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  /** Frame-rate independent smoothing: move `cur` toward `target` with rate k (1/s). */
  U.damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
  U.pad2 = (n) => (n < 10 ? "0" + n : String(n));

  /** Shortest signed difference b - a in radians, in (-PI, PI]. */
  U.angleDiff = function angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  U.dampAngle = (cur, target, k, dt) => cur + U.angleDiff(cur, target) * (1 - Math.exp(-k * dt));

  /** Small deterministic RNG (mulberry32): the same seed gives the same walk every run. */
  U.rng = function rng(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  function applyProps(node, props) {
    Object.keys(props).forEach(function (key) {
      const val = props[key];
      if (val === undefined || val === null || val === false) return;
      if (key === "cls") node.className = val;
      else if (key === "text") node.textContent = val;
      else if (key === "on") Object.keys(val).forEach((ev) => node.addEventListener(ev, val[ev]));
      else if (key === "style") node.style.cssText = val;
      else node.setAttribute(key, val === true ? "" : String(val));
    });
  }

  /** el("button", { cls, text, type, on: { click } }, child, child...) -> HTMLElement. */
  U.el = function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    if (props) applyProps(node, props);
    kids.flat().forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  };

  /** Build an inline SVG from a markup string made of OUR constants (never player text). */
  U.svgFrom = function svgFrom(markup, cls, label) {
    const tpl = document.createElementNS(SVG_NS, "svg");
    tpl.setAttribute("viewBox", "0 0 24 24");
    tpl.setAttribute("class", "kq-ic " + (cls || ""));
    if (label) tpl.setAttribute("role", "img");
    else tpl.setAttribute("aria-hidden", "true");
    if (label) tpl.setAttribute("aria-label", label);
    tpl.innerHTML = markup;
    return tpl;
  };

  U.clear = function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  U.dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
  U.dist = (ax, az, bx, bz) => Math.sqrt(U.dist2(ax, az, bx, bz));
})((window.KQ = window.KQ || {}));
