/* ============================================================================
 * FILE: services.js
 * PURPOSE: What happens at each place: hawker stall, mini-mart, barber, clinic, library,
 *          recycling, playground and the bus stop bench, plus the one-tap Rest (home door, bench,
 *          or anywhere when Tired).
 * BUSINESS CONTEXT: AC-10 (eat to refill hunger; rest at home refills energy; barber changes the
 *   hair piece; the clinic check-up refills energy; the library gives a story card; coins never go
 *   negative), AC-11 (a bought item for the active "buy" step is carried, not eaten), edge case
 *   "coins exactly 0 -> 'You need N more coins - try helping Pakcik Rahman!'".
 * DEPENDENCIES: KQ.Sim.Economy / Needs, ui-menus.js, mission-flow.js, player.js, seats.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  const STORIES = [
    [
      "Sang Kancil and the crocodiles",
      [
        "Sang Kancil, the clever mousedeer, wanted to cross the river to eat the sweet fruit on the other side.",
        "'Crocodiles!' he called. 'The king wants to count you. Line up from here to the bank!'",
        "The crocodiles lined up, and Sang Kancil hopped across on their backs, counting, one, two, three... all the way to the fruit trees.",
        "Sang Kancil used his head, not his strength. Being clever and kind is the best way.",
      ],
    ],
    [
      "The Helpful Hawker",
      [
        "Every morning, Abang Ali opened his stall before the sun was up.",
        "One day a little girl had only two coins and a big, hungry tummy. 'Roti prata kosong?' smiled Abang Ali. 'Just enough!'",
        "She shared her prata with her little brother, and Abang Ali smiled even more.",
      ],
    ],
    [
      "Why we say Bismillah",
      [
        "Before we eat, we say 'Bismillah', in the name of Allah.",
        "It reminds us that our food is a gift. We thank Allah for it, and we thank the people who made it.",
        "When we finish, we say 'Alhamdulillah'. Thank you, Allah.",
      ],
    ],
  ];
  let storyIdx = 0;

  /**
   * Shortcut to the pure sim objects (economy, needs, missions, outfit) on the shared game state.
   */
  function sim() {
    return S().sim;
  }

  /** Does the active step want exactly this item bought at this place? */
  function wantedByMission(placeId, itemId) {
    const prog = sim().missions.progress();
    const step = G.MissionFlow.activeStep();
    return Boolean(
      prog &&
        !prog.paused &&
        prog.type === "buy" &&
        prog.target === placeId &&
        step &&
        step.item === itemId,
    );
  }

  /**
   * Play a short happy pose (wave, etc.) on the hero after a purchase or play, then give control
   * back.
   */
  function happy(pose, seconds) {
    G.Player.lock(S().player, null, pose);
    S().after(seconds, () => G.Player.release(S().player));
  }

  /**
   * Turn the economy's buy result into feedback: sound, mission notification, toast and a wave;
   * returns {ok, hint} for the sheet.
   */
  function buyResult(res, placeId, item, forMission) {
    if (!res.ok) {
      G.Audio.play("hint");
      return { ok: false, hint: res.hint };
    }
    G.Audio.play("coin");
    G.MissionFlow.notify({ type: "buy", target: placeId, item: item.id });
    S().hudDirty = true;
    let hint = res.hint;
    if (forMission) G.UI.toast("You are carrying " + item.name + " for the mission.", "good", 4200);
    else if (item.hunger > 0) {
      G.Nudge.onAte();
      G.UI.toast("Sedap! " + foodLine(), "good");
      hint += " " + foodLine(); // the sheet announces this hint last, so it must carry the level
    }
    if (!forMission && item.hunger > 0) G.EatFlow.start(item);
    else happy("wave", 1.6);
    return { ok: true, hint };
  }

  /** The spoken food level after eating, e.g. "Food 100 of 100." (the same words as the needs ring). */
  function foodLine() {
    return "Food " + Math.round(sim().needs.hunger) + " of 100.";
  }

  /**
   * Buy an item at a place; a bought item wanted by the active mission is carried (no needs
   * change), otherwise it is eaten.
   */
  function buyAt(placeId, item) {
    const forMission = wantedByMission(placeId, item.id);
    const options = forMission ? {} : { needs: sim().needs };
    return buyResult(sim().economy.buy(item.id, options), placeId, item, forMission);
  }

  /**
   * Build the item-tag function that labels items the active mission wants ('For <giver>') in a
   * shop sheet.
   */
  function tagFor(placeId) {
    return function (item) {
      if (!wantedByMission(placeId, item.id)) return "";
      const m = sim().missions.active();
      return "For " + G.Names.npc(m.giver);
    };
  }

  /**
   * Open the hawker stall menu for a counter, with an intro that says whether the hero is already
   * full.
   */
  function stall(counterId) {
    const poiId = counterId.replace("counter_", "stall_");
    const info = G.Names.STALL[poiId] || ["Hawker stall", null];
    const items = KQ.Sim.MENU.filter((m) => m.stall === poiId);
    G.Menus.itemSheet({
      title: info[0],
      items,
      coins: () => sim().economy.coins,
      tagFor: tagFor(poiId),
      onBuy: (item) => buyAt(poiId, item),
      intro: sim().needs.canEat()
        ? "Tap a picture to buy it."
        : "You are full already, but you can still buy for a mission.",
    });
  }

  /** Open the mini-mart (kedai runcit) sheet of halal shop items. */
  function minimart() {
    G.Menus.itemSheet({
      title: "Mini-mart (Kedai runcit)",
      halal: true,
      items: KQ.Sim.SHOP,
      coins: () => sim().economy.coins,
      tagFor: tagFor("minimart"),
      onBuy: (item) => buyAt("minimart", item),
    });
  }

  /**
   * Open the barber sheet: picking a new look spends the price (or shows the short-by message) and
   * applies the outfit.
   */
  function barber() {
    if (G.Hero.isGirl()) return girlAtBarber();
    G.Menus.barber({
      price: KQ.Sim.SERVICES.barber.price,
      current: () => sim().outfit,
      coins: () => sim().economy.coins,
      onPick(look) {
        const cur = sim().outfit;
        if (cur.hair === look.hair && cur.hat === look.hat)
          return { ok: false, hint: "You already have this look. Looking good!" };
        const price = KQ.Sim.SERVICES.barber.price;
        const have = sim().economy.coins;
        if (!sim().economy.spend(price))
          return { ok: false, hint: KQ.Sim.Economy.shortMessage(price - have) };
        sim().outfit = { hair: look.hair, hat: look.hat };
        sim().umrah.setCut("none"); // a new look from the barber replaces the tahallul haircut
        G.Player.applyOutfit(S().player, sim().outfit);
        G.Audio.play("good");
        S().hudDirty = true;
        return { ok: true, hint: "Handsome! Looking sharp." };
      },
    });
  }

  /** The barber's cuts are boys' cuts: the girl hero is sent (kindly) to the tailor for her hair or hijab, free. */
  function girlAtBarber() {
    G.Menus.card({
      title: "Barber",
      paragraphs: [
        "Assalamualaikum! My chair is for short boys' haircuts.",
        "For a ponytail, braids, a bun, a bob or a pretty hijab, visit the tailor's Butik by the park. It's free!",
      ],
      buttons: [{ label: "OK", primary: true, icon: "check" }],
    });
  }

  /** Open Dr Nurul's friendly clinic card; the Check-up button refills energy. */
  function clinic() {
    G.Menus.card({
      title: "Dr Nurul's clinic",
      paragraphs: [
        "Assalamualaikum! Come in. Let's give you a friendly check-up: open wide, say aaah, and breathe in and out.",
        "Everything looks good. A little rest and plenty of water will make you strong!",
      ],
      buttons: [
        {
          label: "Check-up",
          primary: true,
          icon: "heart",
          onClick() {
            sim().needs.checkup();
            G.Audio.play("good");
            G.UI.toast("All better! Your energy is full.", "good");
          },
        },
        { label: "Later" },
      ],
    });
  }

  /** Open the library card with the next story, cycling through the stories in turn. */
  function library() {
    const story = STORIES[storyIdx % STORIES.length];
    storyIdx += 1;
    G.Menus.card({
      title: story[0],
      paragraphs: story[1],
      buttons: [{ label: "The end", primary: true, icon: "book" }],
    });
  }

  /** Why a rest is not offered right now, or "" when it is (full energy, or a fard prayer is due or under way). */
  function restRefusal() {
    if (!sim().needs.canRest()) return "full";
    return G.PrayerFlow.restBlocked() ? "prayer" : "";
  }

  /** Where the hero sits to rest: on the nearest seat (a bench) within 3 m, else on the ground where they stand. */
  function restSpot() {
    const P = S().player;
    const seat = G.Seats.claim(S().npcs.seats, P.pos.x, P.pos.z, 3, "hero");
    const drop = KQ.Figures.seatDrop(P.rig);
    if (seat) return { x: seat.x, y: seat.y - drop, z: seat.z, heading: seat.heading };
    const y = S().world.heightAt(P.pos.x, P.pos.z) + 0.12 - drop;
    return { x: P.pos.x, y, z: P.pos.z, heading: P.heading };
  }

  /** The soft "Zzz" on the fade-out screen, built on first use (text only). */
  function zzzEl() {
    const fade = document.getElementById("kqFade");
    if (!fade.firstChild) {
      const word = G.U.el("span", { cls: "kq-zzz-word", text: "Zzz..." });
      fade.appendChild(G.U.el("div", { cls: "kq-zzz" }, G.Pictures.icon("moon", "kq-ic-xl"), word));
    }
    return fade;
  }

  /** Skip 30 game minutes while resting, then the energy is full ("Energy is back!"); a prayer that falls due still shows. */
  function sleepAndWake(spot) {
    const slept = G.Loop.advanceMinutes(30, true);
    sim().needs.checkup();
    S().hudDirty = true;
    G.UI.toast("You rested for " + slept + " minutes. Energy is back!", "good", 4200);
    G.Say("rest-done", "Energy is back!");
    const P = S().player;
    G.Seats.release(S().npcs.seats, "hero");
    G.Player.release(P);
    G.Player.place(P, spot.x, spot.z, spot.heading, S().world.heightAt);
    setTimeout(() => S().root.classList.remove("kq-fading"), 350);
    setTimeout(() => S().root.classList.remove("kq-resting"), 800); // the "Zzz" fades out with the black
    resting = false;
  }

  /** True while the one-tap rest is playing (it cannot start twice). */
  let resting = false;

  /**
   * Rest, in one tap and with no question: the hero sits where they are (a bench seat if there is
   * one), the screen fades with a soft "Zzz", half an hour passes and the energy is full again.
   * Not offered at full energy or while a fard prayer is due or under way (Pray comes first).
   */
  function restHere() {
    if (resting || restRefusal()) return false;
    resting = true;
    const P = S().player;
    const here = { x: P.pos.x, z: P.pos.z, heading: P.heading };
    G.Player.lock(P, restSpot(), "sit");
    zzzEl();
    S().root.classList.add("kq-resting");
    G.Audio.play("tap");
    setTimeout(function () {
      S().root.classList.add("kq-fading");
      setTimeout(() => sleepAndWake(here), 600);
    }, 800);
    return true;
  }

  /**
   * The Tired bar was tapped: rest in one tap, or (a prayer is due) a kind word that prayer comes
   * first. A bar that is not low does nothing.
   */
  function tiredRest() {
    if (!sim().needs.isTired()) return false;
    if (restRefusal() === "prayer") {
      G.UI.toast("Prayer time first. Then we can rest.", "hint", 3600);
      return false;
    }
    return restHere();
  }

  /** Thank the child at the recycling point and notify missions that this place was visited. */
  function recycle() {
    G.Audio.play("good");
    G.UI.toast("Thank you for looking after the earth!", "good");
    G.MissionFlow.notify({ type: "goto", target: "recycling" });
  }

  /** Playground fun: a cheerful sound, a toast and a wave. */
  function play() {
    G.Audio.play("good");
    G.UI.toast("Wheee! Playing is fun.", "good", 2400);
    happy("wave", 2);
  }

  /** A bench: a tired hero rests there (one tap); otherwise a short, cosmetic sit for a few seconds. */
  function bench() {
    if (!restRefusal()) return void restHere();
    const seats = S().npcs.seats;
    const hero = S().player.pos;
    const seat = G.Seats.claim(seats, hero.x, hero.z, 3, "hero");
    if (!seat) return G.UI.toast("Nice place to wait!", "hint");
    const spot = {
      x: seat.x,
      y: seat.y - KQ.Figures.seatDrop(S().player.rig),
      z: seat.z,
      heading: seat.heading,
    };
    G.Player.lock(S().player, spot, "sit");
    G.UI.toast("Resting for a moment...", "hint", 2400);
    S().after(3, function () {
      G.Seats.release(seats, "hero");
      G.Player.release(S().player);
      G.Player.place(S().player, hero.x, hero.z, seat.heading, S().world.heightAt);
    });
  }

  G.Services = {
    stall,
    minimart,
    barber,
    clinic,
    library,
    recycle,
    play,
    bench,
    restHere,
    tiredRest,
  };
})((window.KQ = window.KQ || {}));
