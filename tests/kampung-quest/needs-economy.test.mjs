// AC-10: needs drain / refill, halal menu, coins never negative, polite shortfall copy.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const KQ = loadSim();
const { Needs, Economy, MENU, SHOP, SERVICES, OUTFIT_OPTIONS, POI_IDS } = { ...KQ.Sim };

test("needs start high, drain with game minutes and never go below 0", () => {
  const needs = Needs.create();
  assert.ok(needs.hunger > 50 && needs.energy > 50);
  const before = needs.hunger;
  needs.tick(10);
  assert.ok(needs.hunger < before);
  assert.ok(Math.abs(before - needs.hunger - 10 * Needs.HUNGER_DRAIN_PER_MIN) < 1e-9);
  needs.tick(1e9);
  assert.equal(needs.hunger, 0);
  assert.equal(needs.energy, 0);
});

test("a whole 24h game day drains hunger but is survivable (no fail state)", () => {
  const needs = Needs.create({ hunger: 100, energy: 100 });
  needs.tick(1440);
  assert.ok(needs.hunger >= 0 && needs.energy >= 0);
  assert.equal(needs.status(), "hungry-tired");
  assert.ok(needs.speedFactor() > 0.5, "slower, never stopped");
});

test("tick ignores nonsense durations", () => {
  const needs = Needs.create({ hunger: 50, energy: 50 });
  for (const bad of [-3, NaN, Infinity, "5", null, undefined, 0]) needs.tick(bad);
  assert.equal(needs.hunger, 50);
  assert.equal(needs.energy, 50);
});

test("eating refills hunger (clamped to 100) and applies a drink's energy bonus", () => {
  const needs = Needs.create({ hunger: 20, energy: 50 });
  const reply = needs.eat(MENU.find((d) => d.id === "nasi_lemak"));
  assert.equal(reply.ok, true);
  assert.equal(needs.hunger, 55);
  needs.eat(MENU.find((d) => d.id === "teh_tarik"));
  assert.equal(needs.energy, 54);
  const small = Needs.create({ hunger: 90, energy: 99 });
  small.eat(MENU.find((d) => d.id === "choc_malt_ais"));
  assert.equal(small.hunger, 98);
  assert.equal(small.energy, 100);
});

test("too full to eat: refused politely, nothing changes; junk items refused", () => {
  const needs = Needs.create({ hunger: 98 });
  assert.equal(needs.canEat(), false);
  const reply = needs.eat(MENU[0]);
  assert.equal(reply.ok, false);
  assert.match(reply.hint, /too full/);
  assert.equal(needs.hunger, 98);
  for (const junk of [null, undefined, {}, "roti", { hunger: NaN }])
    assert.equal(Needs.create().eat(junk).ok, false);
});

test("resting refills energy, clinic check-up refills it fully", () => {
  const needs = Needs.create({ energy: 10 });
  const gained = needs.rest(20);
  assert.ok(Math.abs(gained - 20 * Needs.REST_PER_MIN) < 1e-9);
  assert.equal(needs.rest(1e9) >= 0, true);
  assert.equal(needs.energy, 100);
  const tired = Needs.create({ energy: 5 });
  tired.checkup();
  assert.equal(tired.energy, 100);
  assert.equal(tired.rest(-5), 0);
});

test("status flags: ok / hungry / tired and speedFactor", () => {
  assert.equal(Needs.create({ hunger: 80, energy: 80 }).status(), "ok");
  assert.equal(Needs.create({ hunger: 10, energy: 80 }).status(), "hungry");
  assert.equal(Needs.create({ hunger: 80, energy: 10 }).status(), "tired");
  assert.equal(Needs.create({ hunger: 80, energy: 80 }).speedFactor(), 1);
  assert.ok(Needs.create({ hunger: 10 }).speedFactor() < 1);
});

test("needs snapshot/restore clamps junk and defaults sensibly", () => {
  const needs = Needs.create();
  needs.restore({ hunger: 1e9, energy: -50 });
  assert.deepEqual(plain(needs.snapshot()), { hunger: 100, energy: 0 });
  needs.restore({ hunger: "abc", energy: NaN });
  assert.ok(needs.hunger >= 0 && needs.energy >= 0);
  needs.restore(null);
  assert.ok(Number.isFinite(needs.hunger));
  assert.deepEqual(plain(Needs.create({ hunger: 500, energy: "x" }).snapshot()), {
    hunger: 100,
    energy: 90,
  });
});

test("MENU has >= 8 dishes across >= 4 stalls, each with a price and hunger value", () => {
  assert.ok(MENU.length >= 8);
  assert.equal(new Set(MENU.map((d) => d.id)).size, MENU.length);
  assert.ok(new Set(MENU.map((d) => d.stall)).size >= 4);
  for (const dish of MENU) {
    assert.ok(POI_IDS.includes(dish.stall), dish.id + " stall " + dish.stall);
    assert.ok(Number.isInteger(dish.price) && dish.price >= 1 && dish.price <= 6, dish.id);
    assert.ok(dish.hunger > 0 && dish.hunger <= 50, dish.id);
    assert.ok(dish.name && dish.nameMs, dish.id);
  }
  for (const id of [
    "roti_prata",
    "nasi_lemak",
    "mee_soto",
    "mee_rebus",
    "satay_ayam",
    "nasi_goreng",
    "teh_tarik",
    "choc_malt_ais",
    "kuih_lapis",
  ]) {
    assert.ok(
      MENU.some((d) => d.id === id),
      id,
    );
  }
});

test("everything for sale is halal: flagged, and no forbidden words anywhere", () => {
  const forbidden =
    /pork|bacon|ham\b|lard|babi|beer|wine|alcohol|liquor|whisky|rum\b|sake|tuak|brandy/i;
  for (const item of [...MENU, ...SHOP]) {
    assert.equal(item.halal, true, item.id);
    assert.doesNotMatch(item.id + " " + item.name + " " + item.nameMs, forbidden, item.id);
  }
});

test("shop items and services are well-formed; outfit vocabulary exists", () => {
  assert.ok(SHOP.length >= 5);
  for (const item of SHOP) assert.ok(Number.isInteger(item.price) && item.price >= 0, item.id);
  for (const id of ["groceries", "get_well_card"])
    assert.ok(
      SHOP.some((i) => i.id === id),
      id,
    );
  assert.ok(SERVICES.barber.price >= 0 && SERVICES.clinic.price === 0);
  assert.ok(OUTFIT_OPTIONS.hair.length >= 3 && OUTFIT_OPTIONS.hat.includes("none"));
});

test("coins start at a sane value and can be added", () => {
  const wallet = Economy.create();
  assert.equal(wallet.coins, Economy.START_COINS);
  assert.equal(wallet.add(5), Economy.START_COINS + 5);
  assert.equal(Economy.create({ coins: 3 }).coins, 3);
});

test("coins are never negative: overspending is refused, bad adds are clamped", () => {
  const wallet = Economy.create({ coins: 2 });
  assert.equal(wallet.spend(3), false);
  assert.equal(wallet.coins, 2);
  assert.equal(wallet.spend(2), true);
  assert.equal(wallet.coins, 0);
  assert.equal(wallet.spend(1), false);
  assert.equal(wallet.add(-100), 0);
  for (const bad of [-1, NaN, Infinity, "2", null]) assert.equal(wallet.spend(bad), false);
  wallet.setCoins(-9);
  assert.equal(wallet.coins, 0);
  wallet.setCoins(1e12);
  assert.equal(wallet.coins, Economy.MAX_COINS);
  wallet.setCoins("abc");
  assert.equal(wallet.coins, Economy.MAX_COINS);
});

test("coins at exactly 0: the stall says how many more are needed, kindly", () => {
  const wallet = Economy.create({ coins: 0 });
  const reply = wallet.buy("roti_prata");
  assert.equal(reply.ok, false);
  assert.equal(reply.shortBy, 2);
  assert.equal(reply.hint, "You need 2 more coins — try helping Pakcik Rahman!");
  assert.equal(wallet.coins, 0);
});

test("shortfall copy handles the singular and partial wallets", () => {
  const wallet = Economy.create({ coins: 1 });
  assert.equal(wallet.buy("roti_prata").hint, "You need 1 more coin — try helping Pakcik Rahman!");
  assert.equal(Economy.create({ coins: 1 }).buy("murtabak").shortBy, 3);
});

test("buy() charges the price, returns the item and leaves coins >= 0", () => {
  const wallet = Economy.create({ coins: 10 });
  const reply = wallet.buy("nasi_lemak");
  assert.equal(reply.ok, true);
  assert.equal(reply.item.stall, "stall_nasi_lemak");
  assert.equal(wallet.coins, 7);
  assert.equal(wallet.buy("does_not_exist").ok, false);
  assert.equal(wallet.buy(undefined).ok, false);
  assert.equal(wallet.coins, 7);
  for (let i = 0; i < 20; i += 1) wallet.buy("murtabak");
  assert.ok(wallet.coins >= 0);
});

test("buy() with needs eats the food, and refuses (without charging) when full", () => {
  const wallet = Economy.create({ coins: 10 });
  const needs = Needs.create({ hunger: 30 });
  assert.equal(wallet.buy("mee_soto", { needs }).ok, true);
  assert.equal(needs.hunger, 60);
  const full = Needs.create({ hunger: 99 });
  const coinsBefore = wallet.coins;
  const reply = wallet.buy("mee_soto", { needs: full });
  assert.equal(reply.ok, false);
  assert.equal(wallet.coins, coinsBefore);
  assert.equal(
    wallet.buy("get_well_card", { needs: full }).ok,
    true,
    "errand goods ignore fullness",
  );
});

test("wallet snapshot/restore clamps junk", () => {
  const wallet = Economy.create();
  wallet.restore({ coins: -50 });
  assert.equal(wallet.coins, 0);
  wallet.restore({ coins: 42.9 });
  assert.equal(wallet.coins, 42);
  wallet.restore("junk");
  assert.equal(wallet.coins, Economy.START_COINS);
  assert.deepEqual(plain(wallet.snapshot()), { coins: Economy.START_COINS });
});
