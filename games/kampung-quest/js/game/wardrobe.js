/* ============================================================================
 * FILE: wardrobe.js
 * PURPOSE: The tailor's wardrobe sheet (Butik in the kampung, the tailor's stall in Makkah and
 *          Madinah): pick an outfit and a colour, watch the hero wear it live, Save or Cancel. The
 *          choice is saved with the game and worn in every region.
 * BUSINESS CONTEXT: owner feedback "customise the character". Free, child-friendly (no price, no
 *   wrong choice), every outfit modest. In ihram the tailor politely waits: the plain white cloths
 *   stay on until the rites are done (ritual-look.js owns that).
 * DEPENDENCIES: KQ.Sim.Wardrobe (rules), player.js (applyOutfit), ui-core.js, ui-menus.js (card),
 *   ritual-ui.js (side panel / bottom sheet variant and camera shift), camera.js, shots.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const Rules = () => KQ.Sim.Wardrobe;
  /** The open sheet: handle, the choice being tried on, whether Save was pressed, and the live elements. */
  const W = { handle: null, draft: null, committed: false, ui: null };

  /** Four garment outlines (24 x 24, our own constants) the outfit tiles are drawn from. */
  const SHAPES = {
    tee: "M8.5 3 3 6l2 4.2 2-1V21h10V9.2l2 1L21 6l-5.5-3a3.6 3.6 0 0 1-7 0z",
    tunic:
      "M8.5 2.5 3 5l-.6 11.5 3 .5.8-7.6L7 22h10l.8-12.6.8 7.6 3-.5L21 5l-5.5-2.5a3.6 3.6 0 0 1-7 0z",
    robe: "M9 2.5 3.5 5 3 17l3 .5.5-8L6 22h12l-.5-12.5.5 8 3-.5-.5-12-5.5-2.5a3.6 3.6 0 0 1-6 0z",
    jacket:
      "M8.5 2.5 3 5l-.6 11.5 3 .5.8-7.6L7 20h10l.8-10.6.8 7.6 3-.5L21 5l-5.5-2.5a3.6 3.6 0 0 1-7 0zM11.5 6h1v14h-1z",
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
    G.Player.applyOutfit(S().player, S().sim.outfit, null, W.draft);
  }

  /** The colour an outfit tile shows: the colour it would have with the current choice. */
  function tileColour(outfit) {
    return Rules().swatchOf(Rules().choose(W.draft, outfit.id)).hex;
  }

  /** Refresh one outfit tile (pressed state, label and picture colour) in place, so focus stays put. */
  function updateTile(tile, outfit) {
    const on = Rules().outfitOf(W.draft).id === outfit.id;
    tile.classList.toggle("is-now", on);
    tile.setAttribute("aria-pressed", String(on));
    tile.replaceChild(garment(outfit.id, tileColour(outfit)), tile.firstChild);
  }

  /** Refresh one colour swatch (pressed state and tick). */
  function updateSwatch(btn, colour) {
    const on = Rules().swatchOf(W.draft).id === colour.id;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
    U.clear(btn);
    if (on) btn.appendChild(G.Pictures.icon("check", "kq-wd-tick"));
  }

  /** Update every tile, swatch and the "Wearing" line to match the draft. */
  function refresh() {
    const R = Rules();
    W.ui.tiles.forEach((t) => updateTile(t.el, t.outfit));
    W.ui.swatches.forEach((s) => updateSwatch(s.el, s.colour));
    const name = R.nameOf(W.draft);
    W.ui.status.textContent = "Wearing: " + name;
    G.UI.announce("Wearing " + name);
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

  /** One colour swatch button (a coloured disc, 48 px). */
  function swatchButton(colour) {
    const el = U.el("button", {
      type: "button",
      cls: "kq-wd-swatch",
      "aria-pressed": "false",
      "aria-label": colour.name,
      title: colour.name,
      "data-tone": colour.id,
      style: "--sw:" + colour.hex + ";",
      on: { click: () => pickTone(colour.id) },
    });
    return { el, colour };
  }

  /** (Re)build the colour row for the draft's outfit. */
  function fillSwatches() {
    const row = W.ui.swatchRow;
    U.clear(row);
    W.ui.swatches = Rules().outfitOf(W.draft).palette.map(swatchButton);
    W.ui.swatches.forEach((s) => row.appendChild(s.el));
  }

  /** The sheet's content: the "Wearing" line, the outfit grid, the colour row and Save / Cancel. */
  function build() {
    const ui = {
      status: U.el("p", { cls: "kq-note", role: "status" }),
      grid: U.el("div", { cls: "kq-wd-outfits", role: "group", "aria-label": "Outfits" }),
      swatchRow: U.el("div", { cls: "kq-wd-swatches", role: "group", "aria-label": "Colours" }),
    };
    ui.tiles = Rules().OUTFITS.map(outfitTile);
    ui.tiles.forEach((t) => ui.grid.appendChild(t.el));
    W.ui = ui;
    fillSwatches();
    const acts = U.el(
      "div",
      { cls: "kq-bubble-actions kq-wd-actions" },
      G.UI.btn("Save", { cls: "primary", icon: "check", onClick: save }),
      G.UI.btn("Cancel", { icon: "close", onClick: () => G.UI.closeSheet("cancel") }),
    );
    const h3 = (text) => U.el("h3", { cls: "kq-h3", text });
    return U.el(
      "div",
      { cls: "kq-menu kq-wd" },
      G.UI.header("Wardrobe"),
      ui.status,
      h3("Outfit"),
      ui.grid,
      h3("Colour"),
      ui.swatchRow,
      acts,
    );
  }

  /** Save: keep the draft as the hero's clothes, write the game, close. */
  function save() {
    const sim = S().sim;
    sim.wardrobe = Rules().sanitize(W.draft);
    W.committed = true;
    G.Player.applyOutfit(S().player, sim.outfit);
    G.Audio.play("good");
    G.Loop.save();
    S().hudDirty = true;
    G.UI.closeSheet("save");
    G.UI.toast("Looking good in your " + Rules().nameOf(sim.wardrobe) + "!", "good");
  }

  /** The sheet closed (any way): undo an unsaved preview, give the hero and the camera back. */
  function finish() {
    if (!W.committed) G.Player.applyOutfit(S().player, S().sim.outfit);
    G.Player.release(S().player);
    G.Camera.clearShot();
    G.Camera.setShift(0, 0);
    W.handle = null;
    W.ui = null;
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
    G.Menus.card({
      title: "Tailor",
      paragraphs: [
        "Assalamualaikum! You are wearing your ihram, the two plain white cloths.",
        "Come back after your Umrah or Hajj and we will find you something lovely to wear.",
      ],
      buttons: [{ label: "OK", primary: true, icon: "check" }],
    });
  }

  /**
   * Open the wardrobe: the hero stands still, the camera shows the front, the sheet offers outfits
   * and colours with a live preview. Nothing changes until Save.
   */
  function open() {
    if (W.handle) return W.handle;
    if (S().sim.umrah.ihram) return ihramCard();
    W.draft = Rules().sanitize(S().sim.wardrobe);
    W.committed = false;
    const box = build();
    G.Player.lock(S().player, null, null);
    W.handle = G.UI.openSheet({
      el: box,
      label: "Tailor's wardrobe",
      variant: G.RitualUI.variant(),
      scrim: false,
      onClose: finish,
      focus: ".kq-wd-tile",
    });
    refresh();
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
      dressed: Boolean(P && P.rig.dressId),
      torso: P ? torsoColour(P.rig) : null,
    };
  }

  G.Wardrobe = { open, debug };
})((window.KQ = window.KQ || {}));
