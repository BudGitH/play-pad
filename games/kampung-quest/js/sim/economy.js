/* ============================================================================
 * FILE: economy.js
 * PURPOSE: Coins (never negative), the hawker MENU (halal Singapore dishes by
 *          stall), the mini-mart SHOP, service prices and outfit options.
 * BUSINESS CONTEXT: AC-10, business rule 1 (every food halal, no alcohol/pork),
 *   edge case "coins exactly 0 -> 'You need 2 more coins - try helping Pakcik
 *   Rahman!'". Prices are small whole numbers so a child can always afford a
 *   snack after one mission.
 * DEPENDENCIES: none. Optional `needs` object (KQ.Sim.Needs) for buy({needs}).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/needs-economy.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const MAX_COINS = 99999;
  const START_COINS = 10;

  /** Build one hawker menu entry; every dish is halal by construction (child-friendly rule). */
  function dish(id, name, nameMs, stall, price, hunger, energy) {
    return { id, name, nameMs, stall, price, hunger, energy: energy || 0, halal: true };
  }

  /** Hawker centre menu: every dish halal, grouped by stall poi id. */
  const MENU = [
    dish("roti_prata", "Roti prata", "Roti prata", "stall_prata", 2, 20),
    dish("murtabak", "Chicken murtabak", "Murtabak ayam", "stall_prata", 4, 35),
    dish("nasi_lemak", "Nasi lemak", "Nasi lemak", "stall_nasi_lemak", 3, 35),
    dish("nasi_goreng", "Nasi goreng", "Nasi goreng", "stall_nasi_lemak", 3, 35),
    dish("mee_soto", "Mee soto", "Mee soto", "stall_mee_soto", 3, 30),
    dish("mee_rebus", "Mee rebus", "Mee rebus", "stall_mee_soto", 3, 30),
    dish("satay_ayam", "Chicken satay", "Satay ayam", "stall_satay", 4, 25),
    dish("teh_tarik", "Teh tarik", "Teh tarik", "stall_drinks", 2, 8, 4),
    dish("choc_malt_ais", "Iced chocolate malt", "Air coklat", "stall_drinks", 2, 8, 6),
    dish("kuih_lapis", "Kuih lapis", "Kuih lapis", "stall_drinks", 2, 10),
  ];

  /** Build one mini-mart shelf item; halal by construction, hunger / energy only for food. */
  function goods(id, name, nameMs, price, extra) {
    return Object.assign(
      { id, name, nameMs, price, hunger: 0, energy: 0, halal: true },
      extra || {},
    );
  }

  /** Mini-mart shelf. Eatable items carry hunger/energy; the rest are errand goods. */
  const SHOP = [
    goods("bottled_water", "Bottled water", "Air mineral", 1, { energy: 5 }),
    goods("biscuits", "Marie biscuits", "Biskut Marie", 2, { hunger: 12 }),
    goods("groceries", "Bag of groceries", "Barang dapur", 4),
    goods("get_well_card", "Get-well card", "Kad cepat sembuh", 1),
    goods("notebook", "Little notebook", "Buku nota", 2),
    goods("cat_treats", "Cat treats", "Makanan kucing", 2),
  ];

  /** Service prices (0 = free). The barber changes the hair piece only. */
  const SERVICES = { barber: { price: 2 }, clinic: { price: 0 }, library: { price: 0 } };

  /** Outfit vocabulary shared with KQ.Figures (hair piece + hat). */
  const OUTFIT_OPTIONS = {
    hair: ["classic", "crew", "curly", "side_part", "buzz"],
    hat: ["none", "songkok", "cap"],
  };

  /** Whole, non-negative coins capped at MAX_COINS, so junk input can never make a negative or huge purse. */
  function cleanCoins(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(MAX_COINS, Math.max(0, Math.floor(n)));
  }

  /** Look an item up in the menu and the shop by id (non-string ids find nothing). */
  function findItem(id) {
    const wanted = typeof id === "string" ? id : "";
    return MENU.concat(SHOP).find((item) => item.id === wanted) || null;
  }

  /** The gentle "you need N more coins" hint: points at an errand to earn them, never scolds. */
  function shortMessage(missing) {
    const noun = missing === 1 ? "coin" : "coins";
    return "You need " + missing + " more " + noun + " \u2014 try helping Pakcik Rahman!";
  }

  /** Try to buy an item: refuses (never throws) for an unknown item, a full tummy or too few coins, else pays and eats. */
  function buy(E, id, options) {
    const item = findItem(id);
    if (!item) return { ok: false, hint: "Hmm, we don't have that today.", coins: E.coins };
    const needs = options && options.needs;
    if (needs && item.hunger > 0 && !needs.canEat()) {
      return { ok: false, item, hint: "You're too full right now. Maybe later!", coins: E.coins };
    }
    if (E.coins < item.price) {
      const shortBy = item.price - E.coins;
      return { ok: false, item, shortBy, hint: shortMessage(shortBy), coins: E.coins };
    }
    E.coins -= item.price;
    if (needs && (item.hunger > 0 || item.energy > 0)) needs.eat(item);
    return {
      ok: true,
      item,
      hint: "Terima kasih! That's " + item.price + " coin(s).",
      coins: E.coins,
    };
  }

  /**
   * Create a wallet.
   * @param {{coins?:number}} [start] starting coins (default 10; clamped to 0..99999)
   */
  function create(start) {
    const E = { coins: cleanCoins(start && start.coins, START_COINS) };
    return {
      get coins() {
        return E.coins;
      },
      add(amount) {
        E.coins = cleanCoins(E.coins + (Number.isFinite(amount) ? Math.floor(amount) : 0), E.coins);
        return E.coins;
      },
      /** Spend coins; returns false (and changes nothing) if not affordable. */
      spend(amount) {
        if (!Number.isFinite(amount) || amount < 0 || amount > E.coins) return false;
        E.coins -= Math.floor(amount);
        return true;
      },
      canAfford: (amount) => Number.isFinite(amount) && amount >= 0 && amount <= E.coins,
      buy: (id, options) => buy(E, id, options),
      setCoins(value) {
        E.coins = cleanCoins(value, E.coins);
      },
      snapshot: () => ({ coins: E.coins }),
      restore(raw) {
        E.coins = cleanCoins(raw && raw.coins, START_COINS);
      },
    };
  }

  KQ.Sim.Economy = {
    create,
    findItem,
    shortMessage,
    cleanCoins,
    START_COINS,
    MAX_COINS,
    PRAYER_REWARD_COINS: 3,
  };
  KQ.Sim.MENU = MENU;
  KQ.Sim.SHOP = SHOP;
  KQ.Sim.SERVICES = SERVICES;
  KQ.Sim.OUTFIT_OPTIONS = OUTFIT_OPTIONS;
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
