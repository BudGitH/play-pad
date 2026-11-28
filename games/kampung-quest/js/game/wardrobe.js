/* ============================================================================
 * FILE: wardrobe.js
 * PURPOSE: The tailor's wardrobe sheet (Butik in the kampung, the tailor's stall in Makkah and
 *          Madinah): choose Boy or Girl, pick an outfit and a colour (and, for the girl, a hair or
 *          hijab style and a scarf colour), watch the hero wear it live, Save or Cancel. The choice
 *          is saved with the game and worn in every region.
 * BUSINESS CONTEXT: owner feedback "customise the character"; AC-P8 / AC-P9 (the hero can be
 *   changed between boy and girl here, both have outfits x colours, the girl has hair / hijab
 *   styles). Free, child-friendly (no price, no wrong choice), every outfit modest. In ihram the
 *   tailor politely waits: the ihram clothes stay on until the rites are done (ritual-look.js).
 * DEPENDENCIES: KQ.Sim.Wardrobe + KQ.Sim.Hero (rules), hero.js (pictures), player.js (applyOutfit),
 *   ui-core.js, ui-menus.js (card), ritual-ui.js (side panel / bottom sheet variant and camera
 *   shift), camera.js, shots.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const Hero = () => KQ.Sim.Hero;
  /** The open sheet: handle, the choice being tried on (clothes and hero), whether Save was pressed, the live elements. */
  const W = { handle: null, draft: null, hero: null, committed: false, ui: null };
  /** The wardrobe rules of the hero being tried on (the boy's or the girl's). */
  const Rules = () => Hero().wardrobeFor(W.hero ? W.hero.gender : G.Hero.current().gender);

  /** Garment outlines (24 x 24, our own constants) the outfit tiles are drawn from. */
  const SHAPES = {
    tee: "M8.5 3 3 6l2 4.2 2-1V21h10V9.2l2 1L21 6l-5.5-3a3.6 3.6 0 0 1-7 0z",
    tunic:
      "M8.5 2.5 3 5l-.6 11.5 3 .5.8-7.6L7 22h10l.8-12.6.8 7.6 3-.5L21 5l-5.5-2.5a3.6 3.6 0 0 1-7 0z",
    robe: "M9 2.5 3.5 5 3 17l3 .5.5-8L6 22h12l-.5-12.5.5 8 3-.5-.5-12-5.5-2.5a3.6 3.6 0 0 1-6 0z",
    jacket:
      "M8.5 2.5 3 5l-.6 11.5 3 .5.8-7.6L7 20h10l.8-10.6.8 7.6 3-.5L21 5l-5.5-2.5a3.6 3.6 0 0 1-7 0zM11.5 6h1v14h-1z",
    dress:
      "M9 2.5 4 5l-1 11 3 .4.9-6.4.6 2.6L5 22.5h14l-2.5-9.9.6-2.6.9 6.4 3-.4-1-11-5-2.5a3.4 3.4 0 0 1-6 0z",
  };
  const SHAPE_OF = {
    classic: "jacket",
    baju_melayu: "tunic",
    tee: "tee",
    kurta: "tunic",
    thobe: "robe",
    jubah: "robe",
    raincoat: "jacket",
    sporty: "tee",
    kurung: "dress",
    dress: "dress",
    abaya: "robe",
    tracksuit: "jacket",
  };

  /** A garment picture in a colour (the colours are the tailor's own constants, never player text). */
  function garment(outfitId, hex) {
    const shape = SHAPES[SHAPE_OF[outfitId] || "tee"];
    const markup =
      '<path fill="' +
      hex +
      '" stroke="rgba(255,255,255,0.75)" stroke-width="0.7" d="' +
      shape +
      '"/>';
    const el = U.svgFrom(markup, "kq-wd-pic");
    el.setAttribute("width", "44");
    el.setAttribute("height", "44");
    return el;
  }

  /** Try the draft choice on the hero (the barber's hair / hat and the ritual look stay as they are). */
  function preview() {
    G.Player.applyOutfit(S().player, S().sim.outfit, null, W.draft, W.hero);
  }

  /** The colour an outfit tile shows: the colour it would have with the current choice. */
  function tileColour(outfit) {
    return Rules().swatchOf(Rules().choose(W.draft, outfit.id)).hex;
  }

  /** Mark a toggle button on or off (pressed state and class). */
  function press(btn, on, cls) {
    btn.classList.toggle(cls || "is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  }

  /** Refresh one outfit tile (pressed state, label and picture colour) in place, so focus stays put. */
  function updateTile(tile, outfit) {
    press(tile, Rules().outfitOf(W.draft).id === outfit.id, "is-now");
    tile.replaceChild(garment(outfit.id, tileColour(outfit)), tile.firstChild);
  }

  /** Refresh one colour disc (pressed state and tick). */
  function updateDisc(btn, on) {
    press(btn, on);
    U.clear(btn);
    if (on) btn.appendChild(G.Pictures.icon("check", "kq-wd-tick"));
  }

  /** "Rose pink plain hijab, Teal Baju kurung" for the girl, "Teal Baju Melayu" for the boy. */
  function wearingName() {
    const clothes = Rules().nameOf(W.draft);
    return W.hero.gender === "girl" ? Hero().styleName(W.hero) + ", " + clothes : clothes;
  }

  /** Update every button and the "Wearing" line to match the draft. */
  function refresh() {
    const ui = W.ui;
    ui.who.forEach((c) => press(c.el, c.gender === W.hero.gender));
    ui.tiles.forEach((t) => updateTile(t.el, t.outfit));
    ui.swatches.forEach((s) => updateDisc(s.el, Rules().swatchOf(W.draft).id === s.colour.id));
    ui.styles.forEach((s) => press(s.el, W.hero.style === s.style.id));
    ui.scarves.forEach((s) => updateDisc(s.el, W.hero.scarf === s.colour.id));
    ui.girlOnly.forEach((n) => (n.hidden = W.hero.gender !== "girl"));
    const name = wearingName();
    ui.status.textContent = "Wearing: " + name;
    G.UI.announce("Wearing " + name);
  }

  /** Rebuild the parts that depend on the gender and the outfit, refresh, and preview. */
  function redraw() {
    fillHead();
    fillOutfits();
    fillSwatches();
    refresh();
    preview();
  }

  /** Boy or Girl: the other hero in their own default clothes (a favourite colour carries over when it can). */
  function pickGender(gender) {
    if (W.hero.gender === gender) return;
    const next = Hero().start(gender, W.hero);
    W.hero = next.hero;
    W.draft = Rules().choose(next.wardrobe, next.wardrobe.wear);
    redraw();
  }

  /** Choose an outfit (the colour carries over when the outfit comes in it), rebuild the swatches, preview. */
  function pickOutfit(id) {
    W.draft = Rules().choose(W.draft, id);
    fillSwatches();
    refresh();
    preview();
  }

  /** Choose a colour for the current outfit and preview it. */
  function pickTone(id) {
    W.draft = Rules().recolour(W.draft, id);
    refresh();
    preview();
  }

  /** The girl's hair / hijab style or scarf colour. */
  function pickHead(key, id) {
    W.hero = Hero().sanitize(Object.assign({}, W.hero, { [key]: id }));
    refresh();
    preview();
  }

  /** One outfit tile button. */
  function outfitTile(outfit) {
    const el = U.el(
      "button",
      {
        type: "button",
        cls: "kq-tile kq-wd-tile",
        "aria-pressed": "false",
        "aria-label": outfit.name + ". " + outfit.blurb,
        "data-outfit": outfit.id,
        on: { click: () => pickOutfit(outfit.id) },
      },
      garment(outfit.id, outfit.palette[0].hex),
      U.el("b", { text: outfit.name }),
    );
    return { el, outfit };
  }

  /** One colour disc button (48 px): an outfit colour, or (cls "kq-wd-scarf") a scarf colour. */
  function disc(colour, cls, data, onPick) {
    const el = U.el("button", {
      type: "button",
      cls,
      "aria-pressed": "false",
      "aria-label": colour.name,
      title: colour.name,
      [data]: colour.id,
      style: "--sw:" + colour.hex + ";",
      on: { click: () => onPick(colour.id) },
    });
    return { el, colour };
  }

  /** Fill a row with fresh buttons. */
  function fillRow(row, items) {
    U.clear(row);
    items.forEach((s) => row.appendChild(s.el));
    return items;
  }

  /** (Re)build the outfit grid for the draft's hero. */
  function fillOutfits() {
    W.ui.tiles = fillRow(W.ui.grid, Rules().OUTFITS.map(outfitTile));
  }

  /** (Re)build the colour row for the draft's outfit. */
  function fillSwatches() {
    const list = Rules().outfitOf(W.draft).palette;
    W.ui.swatches = fillRow(
      W.ui.swatchRow,
      list.map((c) => disc(c, "kq-wd-swatch", "data-tone", pickTone)),
    );
  }

  /** The Boy / Girl switch at the top of the sheet. */
  function whoRow(ui) {
    ui.who = ["boy", "girl"].map((gender) => {
      const el = U.el(
        "button",
        {
          type: "button",
          cls: "kq-hero-card kq-wd-gender",
          "aria-pressed": "false",
          "data-hero": gender,
          on: { click: () => pickGender(gender) },
        },
        U.svgFrom(G.Hero.PICTURES[gender], "kq-hero-pic"),
        U.el("b", { text: gender === "girl" ? "Girl" : "Boy" }),
      );
      return { el, gender };
    });
    const row = U.el("div", { cls: "kq-wd-who", role: "group", "aria-label": "Hero" });
    fillRow(row, ui.who);
    return row;
  }

  /** The girl's hair / hijab styles and scarf colours (hidden for the boy). */
  function headRows(ui, h3) {
    ui.styleRow = U.el("div", {
      cls: "kq-wd-styles",
      role: "group",
      "aria-label": "Hair or hijab",
    });
    ui.scarfRow = U.el("div", { cls: "kq-wd-swatches", role: "group", "aria-label": "Scarf" });
    ui.girlOnly = [h3("Hair or hijab"), ui.styleRow, h3("Scarf and ribbon colour"), ui.scarfRow];
    return ui.girlOnly;
  }

  /** One hair / hijab style button. */
  function styleButton(style) {
    const el = U.el("button", {
      type: "button",
      cls: "kq-btn kq-wd-style",
      "aria-pressed": "false",
      "data-style": style.id,
      text: style.name,
      on: { click: () => pickHead("style", style.id) },
    });
    return { el, style };
  }

  /** (Re)build the girl's style and scarf buttons; the boy has none (no hidden buttons in the sheet). */
  function fillHead() {
    const girl = W.hero.gender === "girl";
    const pickScarf = (id) => pickHead("scarf", id);
    const scarves = girl ? Hero().SCARVES : [];
    W.ui.styles = fillRow(W.ui.styleRow, (girl ? Hero().STYLES : []).map(styleButton));
    W.ui.scarves = fillRow(
      W.ui.scarfRow,
      scarves.map((c) => disc(c, "kq-wd-scarf", "data-scarf", pickScarf)),
    );
  }

  /** The sheet's content: the "Wearing" line, Boy / Girl, outfits, colours, the girl's styles, Save / Cancel. */
  function build() {
    const h3 = (text) => U.el("h3", { cls: "kq-h3", text });
    const ui = {
      status: U.el("p", { cls: "kq-note", role: "status" }),
      grid: U.el("div", { cls: "kq-wd-outfits", role: "group", "aria-label": "Outfits" }),
      swatchRow: U.el("div", { cls: "kq-wd-swatches", role: "group", "aria-label": "Colours" }),
    };
    W.ui = ui;
    const who = whoRow(ui);
    const head = headRows(ui, h3);
    fillHead();
    fillOutfits();
    fillSwatches();
    const acts = U.el(
      "div",
      { cls: "kq-bubble-actions kq-wd-actions" },
      G.UI.btn("Save", { cls: "primary", icon: "check", onClick: save }),
      G.UI.btn("Cancel", { icon: "close", onClick: () => G.UI.closeSheet("cancel") }),
    );
    const parts = [G.UI.header("Wardrobe"), ui.status, h3("Who are you?"), who];
    parts.push(h3("Outfit"), ui.grid, h3("Colour"), ui.swatchRow);
    return U.el("div", { cls: "kq-menu kq-wd" }, parts.concat(head, [acts]));
  }

  /** Save: keep the draft as the hero (boy / girl, style) and clothes, write the game, close. */
  function save() {
    const sim = S().sim;
    sim.hero = Hero().sanitize(W.hero);
    sim.wardrobe = Rules().sanitize(W.draft);
    W.committed = true;
    G.Player.applyOutfit(S().player, sim.outfit);
    G.Audio.play("good");
    const saved = G.Loop.save();
    S().hudDirty = true;
    G.UI.closeSheet("save");
    if (saved) G.UI.toast("Looking good in your " + Rules().nameOf(sim.wardrobe) + "!", "good");
    else
      G.UI.toast(
        "Your new clothes are on, but this game could not keep them for next time.",
        "hint",
        5000,
      );
  }

  /** The sheet closed (any way): undo an unsaved preview, give the hero and the camera back. */
  function finish() {
    if (!W.committed) G.Player.applyOutfit(S().player, S().sim.outfit);
    G.Player.release(S().player);
    G.Camera.clearShot();
    G.Camera.setShift(0, 0);
    W.handle = null;
    W.ui = null;
    W.hero = null;
  }

  /** Frame the hero from the front so the new clothes show, beside the open panel. */
  function frameHero() {
    const P = S().player;
    const spot = { x: P.pos.x, y: P.pos.y, z: P.pos.z, heading: P.heading };
    G.Camera.shot(G.Shots.frame("front", spot, "qiyam"));
    G.RitualUI.fitShift();
  }

  /** In ihram the tailor waits: a gentle card instead of the wardrobe. */
  function ihramCard() {
    const clothes = G.Hero.isGirl()
      ? "your plain white clothes and white hijab"
      : "the two plain white cloths";
    G.Menus.card({
      title: "Tailor",
      paragraphs: [
        "Assalamualaikum! You are wearing your ihram, " + clothes + ".",
        "Come back after your Umrah or Hajj and we will find you something lovely to wear.",
      ],
      buttons: [{ label: "OK", primary: true, icon: "check" }],
    });
  }

  /**
   * Open the wardrobe: the hero stands still, the camera shows the front, the sheet offers Boy /
   * Girl, outfits and colours (and the girl's styles) with a live preview. Nothing changes until Save.
   */
  function open() {
    if (W.handle) return W.handle;
    if (S().sim.umrah.ihram) return ihramCard();
    W.hero = Hero().sanitize(G.Hero.current());
    W.draft = Rules().sanitize(S().sim.wardrobe);
    W.committed = false;
    const box = build();
    refresh(); // before the sheet opens, so focus lands on the current hero (the top of the sheet)
    G.Player.lock(S().player, null, null);
    W.handle = G.UI.openSheet({
      el: box,
      label: "Tailor's wardrobe",
      variant: G.RitualUI.variant(),
      scrim: false,
      onClose: finish,
      focus: ".kq-wd-gender.is-on",
    });
    frameHero();
    return W.handle;
  }

  /** The colour of the hero's torso as painted now (a pixel of the atlas), for tests. */
  function torsoColour(rig) {
    const mat = rig.dressId ? rig.dressMat : rig.material;
    const ctx = mat.map.image.getContext("2d");
    const d = ctx.getImageData(4, 128, 1, 1).data;
    return "#" + ((1 << 24) | (d[0] << 16) | (d[1] << 8) | d[2]).toString(16).slice(1);
  }

  /** What a test can see: is the sheet open, the choice being tried, and how the hero is painted. */
  function debug() {
    const P = S() && S().player;
    return {
      open: Boolean(W.handle),
      draft: W.draft ? Object.assign({}, W.draft) : null,
      hero: W.hero ? Object.assign({}, W.hero) : null,
      dressed: Boolean(P && P.rig.dressId),
      gender: P ? P.gender || "boy" : null,
      torso: P ? torsoColour(P.rig) : null,
    };
  }

  G.Wardrobe = { open, debug };
})((window.KQ = window.KQ || {}));
