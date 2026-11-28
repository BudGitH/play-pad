/* ============================================================================
 * FILE: action-bar.js
 * PURPOSE: The ONE Action control: a big picture and one word in a fixed place (above Jump on
 *          touch, bottom right on a desktop; element id `kqTalk`, kept from the old floating Talk
 *          button). When two or more actions are in reach the extra ones appear as picture tiles
 *          beside it (up to 3 in all): the nearest is the big button (key E, or 1), the others are
 *          keys 2 and 3 or a tap. In the world only a non-clickable bobbing arrow marks the target.
 * BUSINESS CONTEXT: playability round AC-P24 (the owner: seven-year-olds were confused by a button
 *   that hovered over heads, changed its word and silently chose between things). Words, pictures
 *   and spoken hints come from action-words.js; the order from KQ.Sim.Actions.
 * DEPENDENCIES: hud.js (refs), action-words.js, say.js, pictures.js, interact.js (activate).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const tmp = new THREE.Vector3();
  /** Game seconds between two tries of a hint that could not be said yet. */
  const RETRY = 0.6;
  const B = { sig: "", words: [], tryAt: -99 };

  /** A picture + one word, as the content of a tile or the big button. */
  function fill(node, info, aria, keyText, showKey) {
    U.clear(node);
    node.appendChild(G.Pictures.icon(info.icon, "kq-ic-xl"));
    const word = U.el("span", { cls: "kq-talk-label", text: info.word });
    const key = U.el("kbd", { text: keyText });
    key.hidden = !showKey;
    node.appendChild(U.el("span", { cls: "kq-talk-row" }, word, key));
    node.setAttribute("aria-label", aria);
  }

  /** Build the Action control, its tray and the world pointer; `on(action)` is the HUD's click handler. */
  function build(on) {
    const R = G.Hud.refs;
    R.talk = U.el("button", {
      type: "button",
      cls: "kq-talk",
      id: "kqTalk",
      hidden: true,
      on: { click: () => on("interact") },
    });
    R.tray = U.el("div", {
      cls: "kq-tray",
      id: "kqTray",
      role: "group",
      "aria-label": "More things to do",
    });
    R.action = U.el("div", { cls: "kq-action", id: "kqAction" }, R.talk, R.tray);
    R.pointer = U.el(
      "span",
      { cls: "kq-pointer", id: "kqPointer", "aria-hidden": "true", hidden: true },
      G.Pictures.icon("arrow"),
    );
    R.talkIconName = "";
    return R.action;
  }

  /** One extra tile for the tray (numbered 2 or 3); a tap runs that action. */
  function tileFor(t, n) {
    const info = G.ActionWords.info(t);
    const b = U.el("button", {
      type: "button",
      cls: "kq-talk-more",
      "data-n": String(n),
      on: { click: () => G.Interact.activate(t) },
    });
    fill(b, info, t.aria || info.word, String(n), !G.Env.coarse);
    return b;
  }

  /** A signature of what is on show, so the DOM is only touched when it changes. */
  function sigOf(list) {
    return list.map((t) => t.id + "|" + t.label + "|" + G.ActionWords.keyOf(t)).join("~");
  }

  /** Draw the big button and the tray for `list` (the arranged targets, first = the big one). */
  function paint(list) {
    const R = G.Hud.refs;
    const first = list[0];
    fill(R.talk, G.ActionWords.info(first), first.aria || first.label, "E", !G.Env.coarse);
    U.clear(R.tray);
    list.slice(1).forEach((t, i) => R.tray.appendChild(tileFor(t, i + 2)));
    R.tray.hidden = list.length < 2;
    R.action.classList.toggle("has-tray", list.length > 1);
    R.talk.classList.toggle("has-tray", list.length > 1);
    S().root.classList.toggle("kq-tray-on", list.length > 1);
    B.words = list.map((t) => G.ActionWords.info(t).word);
  }

  /**
   * Speak the big button's hint once per kind (G.Say applies every voice gate). A hint that could not
   * be said yet (another line is being spoken, a gate is closed) is tried again every RETRY seconds.
   */
  function hintFor(first) {
    const info = G.ActionWords.info(first);
    if (!info.say || G.Say.heard(info.key) || S().t - B.tryAt < RETRY) return;
    B.tryAt = S().t;
    G.Say(info.key, info.say);
  }

  /**
   * Show the arranged targets: the big button, the tray, and the spoken hint. Called every frame;
   * the DOM is written only when the list changed. `list` empty hides the whole control (its place
   * never moves: it is plain CSS).
   */
  function render(list) {
    const R = G.Hud.refs;
    const sig = list.length ? sigOf(list) : "";
    if (sig !== B.sig) {
      B.sig = sig;
      R.talk.hidden = list.length === 0;
      R.talk.disabled = false;
      if (list.length) paint(list);
      else {
        R.tray.hidden = true;
        U.clear(R.tray);
        R.action.classList.remove("has-tray");
        S().root.classList.remove("kq-tray-on");
      }
    }
    if (list.length) hintFor(list[0]);
  }

  /** Number key `n` (1-3): run that action (1 = the big button). Returns whether anything ran. */
  function pick(n) {
    const list = S().targets || [];
    const t = list[n - 1];
    return Boolean(t) && G.Interact.activate(t);
  }

  /**
   * Put the bobbing arrow over the target's head (a non-clickable marker; hidden when the target is
   * behind the camera or off screen). `t` may be a neighbour a few steps away: the arrow is the only
   * sign that she can be walked to.
   */
  function point(t, camera, w, h) {
    const el = G.Hud.refs.pointer;
    if (!t) {
      el.hidden = true;
      return;
    }
    tmp.set(t.x, S().world.heightAt(t.x, t.z) + t.h + 0.35, t.z).project(camera);
    const x = (tmp.x * 0.5 + 0.5) * w;
    const y = (-tmp.y * 0.5 + 0.5) * h;
    const off = tmp.z > 1 || x < 24 || x > w - 24 || y < 24 || y > h - 24;
    el.hidden = off;
    el.classList.toggle("is-near", Boolean(t.enabled));
    if (!off) el.style.transform = "translate(" + Math.round(x) + "px, " + Math.round(y) + "px)";
  }

  G.ActionBar = {
    build,
    render,
    pick,
    point,
    debug: () => ({ words: B.words.slice(), sig: B.sig }),
  };
})((window.KQ = window.KQ || {}));
