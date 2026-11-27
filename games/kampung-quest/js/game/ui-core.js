/* ============================================================================
 * FILE: ui-core.js
 * PURPOSE: UI plumbing shared by every screen: the single modal "sheet" with a focus trap that
 *          returns focus to the opener, toasts, a polite live region, buttons and the
 *          read-to-me button.
 * BUSINESS CONTEXT: AC-15 (keyboard-playable, focus rings, >= 48 px targets, captions) and the
 *   chosen design D ("Every dialog traps focus and returns it to the control that opened it").
 *   All text enters the DOM through textContent (U.el).
 * DEPENDENCIES: util.js, pictures.js, speech.js. Needs the #kq root from index.html.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const UI = {
    root: null,
    layer: null,
    toasts: null,
    live: null,
    liveCaption: null,
    sheet: null,
    handle: null,
    queued: null,
  };

  /**
   * Look up the layer, toast and live-region elements in the game root; call once at boot before
   * any sheet opens.
   */
  function init(root) {
    UI.root = root;
    UI.layer = root.querySelector("#kqSheetLayer");
    UI.toasts = root.querySelector("#kqToasts");
    UI.live = root.querySelector("#kqLive");
    UI.liveCaption = root.querySelector("#kqLiveCaption");
  }

  /** Keyboard focus goes to the 3D view (not a control) so the next Tab starts at the HUD's first item. */
  function focusHome() {
    const a = document.activeElement;
    if (a && a !== document.body && a.offsetParent !== null) return false;
    const stage = UI.root && UI.root.querySelector("#kqStage");
    if (stage) stage.focus({ preventScroll: true });
    return true;
  }

  /** The visible, tabbable elements inside a container (the candidates for the focus trap). */
  function focusables(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
  }

  /** The box Tab is kept inside: the open sheet, else the title card while it is up. */
  function trapScope() {
    if (UI.sheet) return UI.sheet;
    const title = UI.root && UI.root.querySelector("#kqTitle");
    return title && !title.hidden ? title : null;
  }

  /**
   * Keep Tab / Shift+Tab inside the open sheet (or the title card), wrapping from last to first and
   * back.
   */
  function trap(e) {
    const scope = trapScope();
    if (e.key !== "Tab" || !scope) return;
    const list = focusables(scope);
    if (!list.length) {
      e.preventDefault();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !scope.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !scope.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  /**
   * Show one modal sheet. `opts`: { el, label, variant: "center"|"bottom"|"bubble", onClose,
   * dismissible (default true: a tap on the dimmed backdrop closes it, like Esc), scrim (default
   * true), focus (selector to focus first) }. Returns a handle { close() }. Opening a second
   * sheet closes the first.
   */
  function openSheet(opts) {
    if (UI.handle) UI.handle.close("replaced");
    const opener = document.activeElement;
    const { wrap, box } = buildSheet(opts);
    UI.layer.appendChild(wrap);
    UI.sheet = box;
    UI.root.classList.add("kq-modal");
    UI.root.classList.toggle("kq-modal-side", opts.variant === "side");
    if (opts.scrim === false) UI.root.classList.add("kq-modal-clear");
    const handle = { opts, wrap, opener, close: (reason) => closeHandle(handle, reason) };
    UI.handle = handle;
    const first = opts.focus ? box.querySelector(opts.focus) : focusables(box)[0];
    if (first) first.focus({ preventScroll: true });
    return handle;
  }

  /** The backdrop wrapper and the dialog box around `opts.el`. */
  function buildSheet(opts) {
    const wrap = U.el("div", { cls: "kq-sheet kq-sheet-" + (opts.variant || "center") });
    if (opts.scrim === false) wrap.classList.add("kq-noscrim");
    else if (opts.dismissible !== false) wrap.addEventListener("click", onBackdropTap);
    const box = U.el("div", {
      cls: "kq-sheet-box",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": opts.label || "Dialog",
    });
    box.appendChild(opts.el);
    wrap.appendChild(box);
    return { wrap, box };
  }

  /**
   * Tear down a sheet: run its onClose, cancel speech, release held toasts and give focus back to
   * the opener.
   */
  function closeHandle(handle, reason) {
    if (UI.handle !== handle) return;
    UI.handle = null;
    UI.sheet = null;
    UI.root.classList.remove("kq-modal", "kq-modal-clear", "kq-modal-side");
    handle.wrap.remove();
    G.Speech.cancel();
    if (handle.opts.onClose) handle.opts.onClose(reason || "closed");
    if (reason === "replaced") return;
    releaseToasts();
    const opener = handle.opener;
    if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    focusHome();
  }

  /** Close the open sheet (if any) with a reason string that is passed to its onClose. */
  function closeSheet(reason) {
    if (UI.handle) UI.handle.close(reason);
  }

  /** A tap on the dimmed backdrop (not on the sheet itself) closes a dismissible sheet (A11Y2-02). */
  function onBackdropTap(e) {
    if (e.target === e.currentTarget) closeSheet("scrim");
  }

  /** A sheet with a dimmed backdrop covers the toast lane; the walking-view sheets (dialogue, prayer) do not.
   *  On a portrait phone the open azan card needs the room under the minimap, so it holds toasts back too. */
  function toastsBlocked() {
    if (UI.handle && UI.handle.opts.scrim !== false) return true;
    return (
      UI.root.classList.contains("kq-azan-full") &&
      window.matchMedia("(orientation: portrait) and (max-width: 700px)").matches
    );
  }

  /** Show the toast that was held back (the latest one), if nothing blocks the lane any more. */
  function releaseToasts() {
    const q = UI.queued;
    if (!q || toastsBlocked()) return;
    UI.queued = null;
    showToast(q.text, q.kind, q.ms, q.tag);
  }

  /** How many toasts the reserved lane holds: two when it is wide enough for one line each, else one
   *  (two wrapped toasts would not fit its height and the lower one would be clipped). */
  function toastCap() {
    return UI.toasts.clientWidth >= 480 && window.innerHeight > 520 ? 2 : 1;
  }

  /** Show a short toast (capped in number, removed after ms) of a kind: hint, good or gold. */
  function showToast(text, kind, ms, tag) {
    const node = U.el("div", { cls: "kq-toast " + (kind || ""), text });
    if (tag) node.setAttribute("data-tag", tag);
    UI.toasts.appendChild(node);
    while (UI.toasts.children.length > toastCap()) UI.toasts.firstChild.remove();
    setTimeout(() => node.remove(), ms || 3600);
  }

  /** A transient message chip in the reserved toast lane. kind: "" | "good" | "gold" | "hint".
   *  Screen readers hear it through the polite live region (the chip itself has no role).
   *  While a backdrop sheet is open the chip is held back (the latest one wins) and shown when it
   *  closes, so it never hides sheet content (A11Y2-05); the announcement is not delayed. An optional
   *  `tag` lets the caller retire the toast early with dismissToast(tag). */
  function toast(text, kind, ms, tag) {
    announce(text);
    if (toastsBlocked()) UI.queued = { text, kind, ms, tag };
    else showToast(text, kind, ms, tag);
  }

  /** Retire a tagged toast (shown or still held back) once what it said is no longer true. */
  function dismissToast(tag) {
    if (UI.queued && UI.queued.tag === tag) UI.queued = null;
    Array.from(UI.toasts.children).forEach((n) => n.getAttribute("data-tag") === tag && n.remove());
    announce("");
  }

  /** How long a spoken message stays in the live region before it is cleared (so it never goes stale). */
  const LIVE_CLEAR_MS = 6000;

  /**
   * Polite screen-reader message. channel "caption" uses its own region (azan and prayer text). The
   * text is cleared after a few seconds, or at once by announce("") (e.g. when the step it
   * described is done), so a reader browsing the page never meets an out-of-date sentence.
   */
  function announce(text, channel) {
    const region = channel === "caption" ? UI.liveCaption : UI.live;
    if (!region) return;
    clearTimeout(region.sayTimer);
    clearTimeout(region.clearTimer);
    region.textContent = "";
    if (!text) return;
    region.sayTimer = setTimeout(() => (region.textContent = text), 30);
    region.clearTimer = setTimeout(() => (region.textContent = ""), LIVE_CLEAR_MS);
  }

  /** A button: btn("Label", { icon, cls, onClick, label, disabled, type }). */
  function btn(text, o) {
    const opts = o || {};
    const kids = [];
    if (opts.icon) kids.push(G.Pictures.icon(opts.icon, opts.iconCls || ""));
    if (text) kids.push(U.el("span", { text }));
    const b = U.el(
      "button",
      {
        type: "button",
        cls: "kq-btn " + (opts.cls || ""),
        "aria-label": opts.label,
        disabled: opts.disabled,
        on: {
          click(e) {
            G.Audio.play("tap");
            if (opts.onClick) opts.onClick(e);
          },
        },
      },
      kids,
    );
    return b;
  }

  /** Read-to-me button (hidden when speech is unavailable). getText() returns the text. */
  function readButton(getText) {
    const b = U.el(
      "button",
      {
        type: "button",
        cls: "kq-btn kq-icon-btn kq-read",
        "aria-label": "Read to me",
        on: { click: () => G.Speech.speak(getText()) },
      },
      G.Pictures.icon("speaker"),
    );
    if (!G.Speech.available()) b.hidden = true;
    return b;
  }

  /** Header row for a sheet: title, optional extras (chips) and a close button. On a narrow screen the
   *  extras drop to their own row so the Close button always stays on screen (A11Y2-02). */
  function header(title, opts) {
    const o = opts || {};
    const kids = [U.el("h2", { cls: "kq-sheet-title", text: title })];
    const extras = U.el("div", { cls: "kq-row kq-sheet-extras" });
    (o.extras || []).forEach((x) => extras.appendChild(x));
    if (extras.childNodes.length) kids.push(extras);
    if (o.close !== false) {
      kids.push(
        btn("", {
          icon: "close",
          cls: "kq-icon-btn kq-sheet-close",
          label: "Close",
          onClick: () => closeSheet("button"),
        }),
      );
    }
    return U.el("div", { cls: "kq-sheet-head" }, kids);
  }

  /** Is a modal sheet open? Gameplay input and the azan card wait while one is. */
  function modalOpen() {
    return Boolean(UI.handle);
  }

  G.UI = {
    state: UI,
    init,
    openSheet,
    closeSheet,
    toast,
    dismissToast,
    releaseToasts,
    announce,
    btn,
    readButton,
    header,
    modalOpen,
    focusHome,
    trap,
    focusables,
    current: () => UI.handle,
  };
})((window.KQ = window.KQ || {}));
