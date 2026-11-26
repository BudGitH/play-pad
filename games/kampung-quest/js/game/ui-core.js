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
    sheet: null,
    handle: null,
  };

  function init(root) {
    UI.root = root;
    UI.layer = root.querySelector("#kqSheetLayer");
    UI.toasts = root.querySelector("#kqToasts");
    UI.live = root.querySelector("#kqLive");
  }

  function focusables(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
  }

  function trap(e) {
    if (e.key !== "Tab" || !UI.sheet) return;
    const list = focusables(UI.sheet);
    if (!list.length) {
      e.preventDefault();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !UI.sheet.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !UI.sheet.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  /**
   * Show one modal sheet. `opts`: { el, label, variant: "center"|"bottom"|"bubble", onClose,
   * dismissible (default true), scrim (default true), focus (selector to focus first) }.
   * Returns a handle { close() }. Opening a second sheet closes the first.
   */
  function openSheet(opts) {
    if (UI.handle) UI.handle.close("replaced");
    const opener = document.activeElement;
    const wrap = U.el("div", { cls: "kq-sheet kq-sheet-" + (opts.variant || "center") });
    if (opts.scrim === false) wrap.classList.add("kq-noscrim");
    const box = U.el("div", {
      cls: "kq-sheet-box",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": opts.label || "Dialog",
    });
    box.appendChild(opts.el);
    wrap.appendChild(box);
    UI.layer.appendChild(wrap);
    UI.sheet = box;
    UI.root.classList.add("kq-modal");
    if (opts.scrim === false) UI.root.classList.add("kq-modal-clear");
    const handle = {
      opts,
      wrap,
      opener,
      close(reason) {
        if (UI.handle !== handle) return;
        UI.handle = null;
        UI.sheet = null;
        UI.root.classList.remove("kq-modal", "kq-modal-clear");
        wrap.remove();
        G.Speech.cancel();
        if (opts.onClose) opts.onClose(reason || "closed");
        if (reason !== "replaced" && opener && opener.isConnected && opener.focus) {
          opener.focus({ preventScroll: true });
        }
      },
    };
    UI.handle = handle;
    const first = opts.focus ? box.querySelector(opts.focus) : focusables(box)[0];
    if (first) first.focus({ preventScroll: true });
    return handle;
  }

  function closeSheet(reason) {
    if (UI.handle) UI.handle.close(reason);
  }

  /** A transient message chip (top centre). kind: "" | "good" | "gold" | "hint". */
  function toast(text, kind, ms) {
    const node = U.el("div", { cls: "kq-toast " + (kind || ""), role: "status", text });
    UI.toasts.appendChild(node);
    while (UI.toasts.children.length > 3) UI.toasts.firstChild.remove();
    const life = ms || 3600;
    setTimeout(() => node.remove(), life);
    announce(text);
    return node;
  }

  function announce(text) {
    if (!UI.live) return;
    UI.live.textContent = "";
    setTimeout(() => (UI.live.textContent = text), 30);
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

  /** Header row for a sheet: title + optional extras + a close button. */
  function header(title, opts) {
    const o = opts || {};
    const kids = [U.el("h2", { cls: "kq-sheet-title", text: title })];
    const right = U.el("div", { cls: "kq-row" });
    (o.extras || []).forEach((x) => right.appendChild(x));
    if (o.close !== false) {
      right.appendChild(
        btn("", {
          icon: "close",
          cls: "kq-icon-btn",
          label: "Close",
          onClick: () => closeSheet("button"),
        }),
      );
    }
    kids.push(right);
    return U.el("div", { cls: "kq-sheet-head" }, kids);
  }

  function modalOpen() {
    return Boolean(UI.handle);
  }

  G.UI = {
    state: UI,
    init,
    openSheet,
    closeSheet,
    toast,
    announce,
    btn,
    readButton,
    header,
    modalOpen,
    trap,
    focusables,
    current: () => UI.handle,
  };
})((window.KQ = window.KQ || {}));
