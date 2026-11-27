/* ============================================================================
 * FILE: ui-menus.js
 * PURPOSE: The service menus as picture-tile sheets: hawker stall, mini-mart, barber chair,
 *          clinic card and library story card.
 * BUSINESS CONTEXT: AC-10 (>= 8 halal dishes with prices, mini-mart, barber changes the hair piece,
 *   clinic check-up, library story), edge case "coins exactly 0 -> 'You need 2 more coins - try
 *   helping Pakcik Rahman!'" (disabled-looking "too dear" tile that explains instead of scolding).
 * DEPENDENCIES: ui-core.js, pictures.js, names.js. Handlers come from services.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;

  /** A row of coin icons showing a price at a glance (no reading needed). */
  function pips(n) {
    const row = U.el("span", { cls: "kq-pips", "aria-hidden": "true" });
    for (let i = 0; i < n; i += 1) row.appendChild(G.Pictures.icon("coin"));
    return row;
  }

  /**
   * Build one shop tile: picture, names, price coins, what it gives (food, energy or errands), and
   * a mission tag; dim when too dear.
   */
  function itemTile(item, coins, tag, onPick) {
    const dear = coins < item.price;
    const gain =
      item.hunger > 0
        ? "+" + item.hunger + " food"
        : item.energy > 0
          ? "+" + item.energy + " energy"
          : "for errands";
    const kids = [
      G.Pictures.dish(item.id, 56),
      U.el("b", { text: item.name }),
      U.el("span", { cls: "kq-small", text: item.nameMs }),
      pips(item.price),
      U.el("span", { cls: "kq-small", text: gain }),
    ];
    if (tag) kids.push(U.el("i", { cls: "kq-tag", text: tag }));
    return U.el(
      "button",
      {
        type: "button",
        cls: "kq-tile" + (dear ? " is-dear" : ""),
        "aria-label":
          item.name + ", " + item.price + " coins, " + gain + (dear ? ", you need more coins" : ""),
        on: { click: () => onPick(item) },
      },
      kids,
    );
  }

  /**
   * Build the coins chip for a shop sheet; its update() re-reads the live coin count after a
   * purchase.
   */
  function coinChip(o) {
    const num = U.el("b", { text: String(o.coins()) });
    const chip = U.el(
      "span",
      { cls: "kq-chip kq-coins" },
      G.Pictures.icon("coin"),
      num,
      U.el("span", { text: "coins" }),
    );
    chip.update = () => (num.textContent = String(o.coins()));
    return chip;
  }

  /** (Re)draw a shop grid for the current coins and refresh the coin chip. */
  function fillItems(grid, o, chip, pick) {
    U.clear(grid);
    o.items.forEach((it) =>
      grid.appendChild(itemTile(it, o.coins(), o.tagFor ? o.tagFor(it) : "", pick)),
    );
    chip.update();
  }

  /**
   * Item sheet for a stall / shop. o: { title, items, coins(), tagFor(item), onBuy(item) -> result, onClose }
   * result = { ok, hint }. A failed buy shows the hint in the note and keeps the sheet open.
   */
  function itemSheet(o) {
    const intro = o.intro || "Tap a picture to buy it.";
    const note = U.el("p", { cls: "kq-note", role: "status", text: intro });
    const chip = coinChip(o);
    const grid = U.el("div", { cls: "kq-grid" });
    const state = {};
    const pick = (item) => {
      const res = o.onBuy(item);
      note.textContent = res.hint;
      G.UI.announce(res.hint);
      if (res.ok) state.handle.close("bought");
      else fillItems(grid, o, chip, pick);
    };
    fillItems(grid, o, chip, pick);
    const halal = U.el("span", { cls: "kq-chip kq-halal" }, G.Pictures.icon("check"), "Halal");
    const extras = [o.halal === false ? null : halal, chip].filter(Boolean);
    const box = U.el("div", { cls: "kq-menu" }, G.UI.header(o.title, { extras }), grid, note);
    state.handle = G.UI.openSheet({
      el: box,
      label: o.title,
      onClose: o.onClose,
      focus: ".kq-tile",
    });
    return state.handle;
  }

  const LOOKS = [
    { id: "classic", hair: "classic", hat: "none", name: "Matching cap", hairC: "#1d4fc6" },
    { id: "crew", hair: "crew", hat: "none", name: "Crew cut", hairC: "#2a1c14" },
    { id: "curly", hair: "curly", hat: "none", name: "Curly top", hairC: "#3a2416" },
    { id: "side_part", hair: "side_part", hat: "none", name: "Side part", hairC: "#6b4423" },
    { id: "buzz", hair: "buzz", hat: "none", name: "Buzz cut", hairC: "#7a6048" },
    { id: "songkok", hair: "classic", hat: "songkok", name: "Songkok", hairC: "#1c1c22" },
    { id: "cap", hair: "classic", hat: "cap", name: "Sunny cap", hairC: "#f2b134" },
  ];

  /** A small face SVG drawn in a look's hair colour, used as the barber's picture for that look. */
  function headPicture(look) {
    const inner =
      '<circle cx="24" cy="26" r="14" fill="#e3a97c"/><circle cx="19" cy="26" r="2" fill="#2a1a10"/><circle cx="29" cy="26" r="2" fill="#2a1a10"/>' +
      '<path d="M9 24a15 15 0 0 1 30 0q-15-7-30 0z" fill="' +
      look.hairC +
      '"/>';
    const el = U.svgFrom(inner, "kq-pic");
    el.setAttribute("viewBox", "0 0 48 48");
    el.setAttribute("width", "88");
    el.setAttribute("height", "88");
    return el;
  }

  /** One barber style tile (preview, name, price pips or a "Now" tag); `here` marks the current look. */
  function lookTile(look, price, here, onPick) {
    return U.el(
      "button",
      {
        type: "button",
        cls: "kq-tile" + (here ? " is-now" : ""),
        "aria-label": look.name + (here ? ", your look now" : ", " + price + " coins"),
        on: { click: () => onPick(look) },
      },
      headPicture(look),
      U.el("b", { text: look.name }),
      here ? U.el("i", { cls: "kq-tag", text: "Now" }) : pips(price),
    );
  }

  /** Barber sheet. o: { price, current: {hair, hat}, coins(), onPick(look) -> {ok,hint}, onClose } */
  function barber(o) {
    const note = U.el("p", {
      cls: "kq-note",
      role: "status",
      text: "Pick a style. Each haircut is " + o.price + " coins.",
    });
    const grid = U.el("div", { cls: "kq-grid kq-grid-looks" });
    const isCurrent = (l) => l.hair === o.current().hair && l.hat === o.current().hat;
    const fill = () => {
      U.clear(grid);
      LOOKS.forEach((look) => grid.appendChild(lookTile(look, o.price, isCurrent(look), pick)));
    };
    const pick = (look) => {
      const res = o.onPick(look);
      note.textContent = res.hint;
      G.UI.announce(res.hint);
      fill();
    };
    fill();
    const head = G.UI.header("Barber Raju's chair");
    const box = U.el("div", { cls: "kq-menu kq-menu-looks" }, head, grid, note);
    return G.UI.openSheet({ el: box, label: "Barber", onClose: o.onClose, focus: ".kq-tile" });
  }

  /** A simple card: title, paragraphs, buttons [{label, primary, onClick}]. */
  function card(o) {
    const paras = o.paragraphs.map((t) => U.el("p", { cls: "kq-story", text: t }));
    const read = G.UI.readButton(() => o.paragraphs.join(" "));
    const acts = U.el("div", { cls: "kq-bubble-actions" });
    (o.buttons || [{ label: "Close", primary: true }]).forEach(function (b) {
      acts.appendChild(
        G.UI.btn(b.label, {
          cls: b.primary ? "primary" : "",
          icon: b.icon,
          onClick: () => (h.close("choice"), b.onClick && b.onClick()),
        }),
      );
    });
    const box = U.el(
      "div",
      { cls: "kq-menu kq-card" },
      G.UI.header(o.title, { extras: [read] }),
      U.el("div", { cls: "kq-story-body" }, paras),
      acts,
    );
    const h = G.UI.openSheet({
      el: box,
      label: o.title,
      onClose: o.onClose,
      focus: ".kq-bubble-actions button",
    });
    return h;
  }

  G.Menus = { itemSheet, barber, card, LOOKS };
})((window.KQ = window.KQ || {}));
