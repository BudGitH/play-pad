/* ============================================================================
 * FILE: ui-screens.js
 * PURPOSE: The dock screens: My missions board, Bag (stickers, carrying, look), Map (with the
 *          five-prayer day strip), How to play, and the Pause dialog with its settings.
 * BUSINESS CONTEXT: AC-11 (a mission board of >= 8 missions), AC-15 (mute, pause, caption size,
 *   read-to-me, less motion; every control >= 48 px), design D ("day of prayers" strip in the
 *   map / pause screen).
 * DEPENDENCIES: ui-core.js, pictures.js, names.js, minimap.js, KQ.Sim state passed in `ctx`.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;

  /**
   * Build one mission board tile (icon, title, and a status mark: Done, Doing now, Kept waiting, or
   * the giver's name).
   */
  function missionTile(m, status, paused) {
    const mark =
      status === "done"
        ? "Done"
        : status === "active"
          ? paused
            ? "Kept, waiting"
            : "Doing now"
          : G.Names.npc(m.giver);
    const icon =
      status === "done" ? G.Pictures.icon("check", "kq-ic-lg") : G.Pictures.missionIcon(m.id);
    return U.el(
      "div",
      {
        cls: "kq-tile kq-static is-" + status,
        tabindex: "0",
        role: "group",
        "aria-label": m.title + ". " + mark,
      },
      U.el("span", { cls: "kq-tile-ic" }, icon),
      U.el("b", { text: m.title }),
      U.el("span", { cls: "kq-small", text: mark }),
    );
  }

  /** My missions. ctx: { sim, onClose } */
  function missions(ctx) {
    const sim = ctx.sim;
    const done = sim.missions.completed();
    const activeId = sim.missions.active() && sim.missions.active().id;
    const paused = sim.missions.isPausedNow();
    const grid = U.el("div", { cls: "kq-grid kq-grid-missions" });
    KQ.Sim.MISSIONS.forEach(function (m) {
      const status = done.indexOf(m.id) !== -1 ? "done" : m.id === activeId ? "active" : "new";
      grid.appendChild(missionTile(m, status, paused));
    });
    const left = KQ.Sim.MISSIONS.length - done.length;
    const msg =
      left === 0
        ? "All " + done.length + " missions done. Masya-Allah! New missions come tomorrow at 07:00."
        : paused
          ? "Missions wait while we pray. Your mission is kept."
          : "Find the neighbour named on a picture and say salam.";
    const note = U.el("p", { cls: "kq-note" + (paused ? " is-prayer" : ""), text: msg });
    const read = G.UI.readButton(() => msg);
    const box = U.el(
      "div",
      { cls: "kq-menu" },
      G.UI.header("My missions · " + done.length + " of " + KQ.Sim.MISSIONS.length + " done", {
        extras: [read],
      }),
      note,
      grid,
    );
    return G.UI.openSheet({ el: box, label: "My missions", onClose: ctx.onClose });
  }

  /**
   * Build one sticker cell; collected stickers show a star, others a faded placeholder, both
   * labelled for screen readers.
   */
  function stickerCell(s, owned) {
    return U.el(
      "span",
      {
        cls: "kq-sticker" + (owned ? " is-owned" : ""),
        title: s.name,
        "aria-label": s.name + (owned ? ", collected" : ", not yet"),
      },
      G.Pictures.icon(owned ? "star" : "sticker"),
      U.el("span", { cls: "kq-small", text: s.name }),
    );
  }

  /** Bag. ctx: { sim, carrying: string|null, outfitName } */
  function bag(ctx) {
    const have = ctx.sim.missions.stickers();
    const grid = U.el("div", { cls: "kq-stickers" });
    KQ.Sim.STICKERS.forEach((s) => grid.appendChild(stickerCell(s, have.indexOf(s.id) !== -1)));
    const carrying = ctx.carrying
      ? "You are carrying: " + ctx.carrying + "."
      : "You are not carrying anything for a mission.";
    const box = U.el(
      "div",
      { cls: "kq-menu" },
      G.UI.header("My bag"),
      U.el("p", { cls: "kq-note", text: carrying }),
      U.el("p", {
        cls: "kq-small",
        text: "Look: " + ctx.outfitName + " · Coins: " + ctx.sim.economy.coins,
      }),
      U.el("h3", {
        cls: "kq-h3",
        text: "Stickers " + have.length + " of " + KQ.Sim.STICKERS.length,
      }),
      grid,
    );
    return G.UI.openSheet({ el: box, label: "My bag", onClose: ctx.onClose });
  }

  /** The five-prayer day strip: name, time, raka'at, status. */
  function dayStrip(sim) {
    const row = U.el("ol", { cls: "kq-day" });
    sim.prayer.state().prayers.forEach(function (p) {
      const st = p.status;
      const words = G.Names.prayerStatus(p);
      row.appendChild(
        U.el(
          "li",
          {
            cls: "kq-day-item is-" + st + (p.home ? " is-home" : ""),
            "aria-label": p.label + " " + p.time + ", " + p.rakaat + " rakaat, " + words,
          },
          G.Pictures.icon(st === "done" || st === "qada-done" ? "check" : "mosque"),
          U.el("b", { text: p.label }),
          U.el("span", { cls: "kq-small", text: p.time + " · " + p.rakaat }),
          U.el("span", { cls: "kq-small", text: words }),
        ),
      );
    });
    return row;
  }

  /** Full map screen. ctx: { sim, mapView() -> view for Minimap.draw, onClose } */
  function map(ctx) {
    const canvas = U.el("canvas", {
      cls: "kq-bigmap",
      width: "640",
      height: "640",
      role: "img",
      "aria-label": "Map of the neighbourhood",
    });
    const legend = U.el("p", {
      cls: "kq-small kq-legend",
      text: "White arrow: you. Pink dot: your mission. Green dot: the mosque. Orange: hawker centre. Pink house: home.",
    });
    const box = U.el(
      "div",
      { cls: "kq-menu kq-mapmenu" },
      G.UI.header("Map"),
      U.el(
        "div",
        { cls: "kq-mapbody" },
        canvas,
        U.el(
          "div",
          { cls: "kq-col" },
          U.el("h3", { cls: "kq-h3", text: "Today's prayers" }),
          dayStrip(ctx.sim),
          legend,
        ),
      ),
    );
    const draw = () => G.Minimap.draw(canvas.getContext("2d"), 640, ctx.mapView(), false);
    draw();
    const h = G.UI.openSheet({ el: box, label: "Map", onClose: ctx.onClose });
    h.redraw = draw;
    return h;
  }

  const HOWTO = [
    [
      "run",
      "Walk with W A S D or the arrow keys, or the joystick. Hold Shift, or push the joystick right to its edge, to run. Space or the Jump button jumps, even while you walk.",
    ],
    ["talk", "Walk up to a neighbour with a star and press E or the Talk button."],
    ["bowl", "Buy food at the hawker stalls. It fills your food meter."],
    [
      "mosque",
      "When you hear the azan, walk to the mosque, take wudu, then pray. Missions wait for you.",
    ],
  ];

  /** Open the How to play sheet: picture list, a read-aloud button and a 'Got it' close. */
  function howTo(ctx) {
    const list = U.el("ul", { cls: "kq-howto" });
    HOWTO.forEach((i) =>
      list.appendChild(
        U.el("li", {}, G.Pictures.icon(i[0], "kq-ic-lg"), U.el("span", { text: i[1] })),
      ),
    );
    const read = G.UI.readButton(() => HOWTO.map((i) => i[1]).join(" "));
    const ok = G.UI.btn("Got it", {
      cls: "primary",
      icon: "check",
      onClick: () => G.UI.closeSheet("button"),
    });
    const box = U.el(
      "div",
      { cls: "kq-menu kq-card" },
      G.UI.header("How to play", { extras: [read] }),
      list,
      U.el("div", { cls: "kq-bubble-actions" }, ok),
    );
    const onClose = ctx && ctx.onClose;
    return G.UI.openSheet({
      el: box,
      label: "How to play",
      onClose,
      focus: ".kq-bubble-actions button",
    });
  }

  /**
   * Build a segmented control (e.g. Sound, Caption size) from [value, label] options that
   * re-renders on each pick.
   */
  function choice(label, options, get, set) {
    const row = U.el("div", { cls: "kq-seg", role: "group", "aria-label": label });
    const fill = () => {
      U.clear(row);
      options.forEach(function (o) {
        const on = get() === o[0];
        row.appendChild(
          U.el("button", {
            type: "button",
            cls: "kq-seg-btn" + (on ? " is-on" : ""),
            "aria-pressed": String(on),
            text: o[1],
            on: { click: () => (set(o[0]), G.Audio.play("tap"), fill()) },
          }),
        );
      });
    };
    fill();
    return U.el("div", { cls: "kq-setting" }, U.el("span", { text: label }), row);
  }

  const YES_NO = [
    [false, "On"],
    [true, "Off"],
  ];
  const ON_OFF = [
    [true, "On"],
    [false, "Off"],
  ];
  const QUALITY = [
    ["auto", "Auto"],
    ["low", "Low"],
    ["med", "Medium"],
    ["high", "High"],
  ];
  const MOTION = [
    ["follow", "Follow device"],
    ["on", "On"],
    ["off", "Off"],
  ];
  const CAPTION = [
    ["large", "Large"],
    ["normal", "Normal"],
  ];

  /**
   * Build the Pause screen's setting rows (sound, fixed always-on azan captions, caption size, read
   * to me, quality, ...).
   */
  function settingRows(ctx) {
    const prefs = G.Settings.prefs;
    const fixed = U.el(
      "div",
      { cls: "kq-setting" },
      U.el("span", { text: "Azan captions" }),
      U.el("b", { cls: "kq-pill", text: "Always on" }),
    );
    return [
      choice("Sound", YES_NO, ctx.getMuted, ctx.setMuted),
      fixed,
      choice("Caption size", CAPTION, () => prefs.captionSize, ctx.setCaption),
      choice("Read to me", ON_OFF, () => prefs.readToMe, ctx.setRead),
      choice("Ambient sounds", ON_OFF, () => prefs.ambience, ctx.setAmbience),
      choice("Picture quality", QUALITY, ctx.getQuality, ctx.setQuality),
      choice("Less motion", MOTION, () => prefs.lessMotion, ctx.setMotion),
    ];
  }

  const AZAN_CREDIT = {
    title: 'Azan: "The Adhan - Muslim Call to Prayer - Aaqib Azeez"',
    author: "by Atcovi (Wikimedia Commons); reciter named in the title: Aaqib Azeez.",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3",
    changes: "Changes: volume reduced, 20 ms fade-in, re-encoded to Vorbis and MP3.",
  };

  /** An external link that opens in a new tab with noopener noreferrer. */
  function link(url, text) {
    return U.el("a", { href: url, target: "_blank", rel: "noopener noreferrer", text });
  }

  /** Build one titled block of credit lines for the Credits screen. */
  function creditBlock(title, lines) {
    const kids = [U.el("h3", { cls: "kq-h3", text: title })];
    lines.forEach((l) => kids.push(U.el("p", { cls: "kq-credit-line" }, l)));
    return U.el("section", { cls: "kq-credit-block" }, kids);
  }

  /** Credits: the azan's CC BY-SA 4.0 attribution, the textures and the prayer times. */
  function credits(ctx) {
    const a = AZAN_CREDIT;
    const box = U.el(
      "div",
      { cls: "kq-menu kq-card kq-credits" },
      G.UI.header("Credits"),
      creditBlock("Azan (call to prayer)", [
        a.title + " " + a.author,
        ["Licence: ", link(a.licenceUrl, a.licence + " (" + a.licenceUrl + ")")],
        ["Source: ", link(a.sourceUrl, "commons.wikimedia.org, The Adhan - Aaqib Azeez")],
        a.changes,
      ]),
      creditBlock("Photo textures", [
        ["ambientCG (", link("https://ambientcg.com", "ambientcg.com"), "), CC0 1.0."],
      ]),
      creditBlock("Prayer times", [
        "Singapore, 26 November 2026: MUIS Muslim Prayer Timetable 2026, published on data.gov.sg under the Singapore Open Data Licence.",
      ]),
    );
    return G.UI.openSheet({
      el: box,
      label: "Credits",
      onClose: ctx && ctx.onClose,
      focus: ".kq-icon-btn",
    });
  }

  /** Credits from the pause menu: the game stays paused, and closing returns to the pause menu. */
  function openCredits(ctx) {
    credits({ onClose: (why) => why !== "replaced" && (pause(ctx), G.Loop.setPaused(true)) });
    G.Loop.setPaused(true);
  }

  /**
   * Build the Pause screen's buttons: Resume, How to play, Credits, Save and go to PlayPad, Start
   * over.
   */
  function pauseButtons(ctx) {
    const resume = G.UI.btn("Resume", {
      cls: "primary kq-big",
      icon: "play",
      onClick: () => G.UI.closeSheet("button"),
    });
    return U.el(
      "div",
      { cls: "kq-col" },
      resume,
      G.UI.btn("How to play", { icon: "book", onClick: ctx.onHowTo }),
      G.UI.btn("Credits", { icon: "star", onClick: () => openCredits(ctx) }),
      G.UI.btn("Save and go to PlayPad", { icon: "home", onClick: ctx.onSaveExit }),
      G.UI.btn("Start over", { icon: "refresh", onClick: ctx.onStartOver }),
      U.el("p", { cls: "kq-small", text: ctx.status }),
    );
  }

  /** Pause dialog. ctx: { settings handlers..., onHowTo, onSaveExit, onStartOver, onClose } */
  function pause(ctx) {
    const right = U.el("div", { cls: "kq-col" }, settingRows(ctx));
    const box = U.el(
      "div",
      { cls: "kq-menu kq-pausebox" },
      G.UI.header("Paused", { close: false }),
      U.el("div", { cls: "kq-pause-grid" }, pauseButtons(ctx), right),
    );
    // a stray tap outside must not resume the game: Pause closes from its Resume button (or Esc)
    return G.UI.openSheet({
      el: box,
      label: "Paused",
      onClose: ctx.onClose,
      focus: ".kq-big",
      dismissible: false,
    });
  }

  G.Screens = { missions, bag, map, howTo, pause, credits, dayStrip };
})((window.KQ = window.KQ || {}));
