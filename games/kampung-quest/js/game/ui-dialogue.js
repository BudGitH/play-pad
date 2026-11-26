/* ============================================================================
 * FILE: ui-dialogue.js
 * PURPOSE: The speech-bubble dialogue: name tag, one line at a time with Next, and reply buttons
 *          ("Waalaikumsalam! Yes" / "Later"). Text goes in through textContent only.
 * BUSINESS CONTEXT: AC-12 (speech bubbles with polite Malay / English greetings, Assalamualaikum /
 *   Waalaikumsalam), design D (read-to-me on every text card).
 * DEPENDENCIES: ui-core.js, util.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;

  function replyLabelFor(name, line, muslim) {
    const first = String(line).toLowerCase();
    if (first.indexOf("waalaikumsalam") === 0) return "Assalamualaikum!";
    if (first.indexOf("assalamualaikum") === 0) return "Waalaikumsalam!";
    return muslim ? "Assalamualaikum!" : "Hello!";
  }

  /** Render the current page: a Next button, or the reply choices on the last page. */
  function showPage(d) {
    const o = d.o;
    U.clear(d.actions);
    d.text.textContent = d.lines[d.page];
    if (d.page < d.lines.length - 1) {
      const next = () => ((d.page += 1), showPage(d));
      d.actions.appendChild(G.UI.btn("Next", { cls: "primary", icon: "arrow", onClick: next }));
    } else {
      const reply = replyLabelFor(o.name, d.lines[0], o.muslim);
      const choices = o.choices || [{ label: reply, primary: true }];
      choices.forEach((c) => d.actions.appendChild(choiceButton(d, c)));
    }
    const first = d.actions.querySelector("button");
    if (first) first.focus({ preventScroll: true });
  }

  function choiceButton(d, c) {
    return G.UI.btn(c.label, {
      cls: c.primary ? "primary" : "",
      icon: c.primary ? "check" : "close",
      onClick() {
        d.handle.close("choice");
        if (c.onPick) c.onPick();
      },
    });
  }

  /**
   * Open a dialogue.
   * o: { name, muslim, lines: string[], choices?: [{label, primary, onPick}], onClose }
   * With no choices a single reply button (a greeting) closes it.
   */
  function open(o) {
    const d = { o, lines: o.lines.length ? o.lines : ["..."], page: 0 };
    d.text = U.el("p", { cls: "kq-bubble-text", text: d.lines[0], "aria-live": "polite" });
    d.actions = U.el("div", { cls: "kq-bubble-actions" });
    const read = G.UI.readButton(() => d.lines[d.page]);
    const head = U.el("div", { cls: "kq-bubble-head" }, U.el("b", { text: o.name }), read);
    d.handle = G.UI.openSheet({
      el: U.el("div", { cls: "kq-bubble" }, head, d.text, d.actions),
      label: "Talking to " + o.name,
      variant: "bubble",
      scrim: false,
      onClose: o.onClose,
    });
    showPage(d);
    return d.handle;
  }

  G.Dialogue = { open };
})((window.KQ = window.KQ || {}));
