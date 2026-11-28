// The hero choice (AC-P8..P10): boy or girl, the girl's hair / hijab styles and scarf colours, the girl's
// modest wardrobe, her ihram, and the saved `hero: { gender, style, scarf }` (cleaned, shared by every
// region through the look key). Pure rules: games/kampung-quest/js/sim/hero.js (+ save.js).
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain, memoryStorage } from "./load-sim.mjs";

const KQ = loadSim();
const { Hero, Wardrobe, Save } = KQ.Sim;
const HEX = /^#[0-9a-f]{6}$/;
const LOOK_KEY = "kampung-quest:look";

test("a new game is a boy; the girl's style and scarf are ready (a hijab in a friendly colour)", () => {
  assert.deepEqual(plain(Hero.DEFAULT), { gender: "boy", style: "hijab", scarf: "rose" });
  assert.deepEqual(plain(Save.defaultState().hero), plain(Hero.DEFAULT));
  assert.deepEqual(plain(Hero.GENDERS), ["boy", "girl"]);
  const girl = Hero.start("girl");
  assert.deepEqual(plain(girl.hero), { gender: "girl", style: "hijab", scarf: "rose" });
  assert.deepEqual(plain(girl.wardrobe), { wear: "kurung", tone: "teal" });
  assert.deepEqual(plain(Hero.start("boy").wardrobe), { wear: "classic", tone: "royal" });
  // switching keeps the girl's chosen style
  const back = Hero.start("girl", { gender: "boy", style: "braids", scarf: "mint" });
  assert.deepEqual(plain(back.hero), { gender: "girl", style: "braids", scarf: "mint" });
});

test("a saved hero is cleaned: unknown genders, styles, scarves and junk fall back safely", () => {
  const clean = (raw) => plain(Hero.sanitize(raw));
  assert.deepEqual(clean({ gender: "girl", style: "bob", scarf: "teal" }), {
    gender: "girl",
    style: "bob",
    scarf: "teal",
  });
  assert.deepEqual(
    clean({ gender: "dragon", style: "mohawk", scarf: "#ff0000" }),
    plain(Hero.DEFAULT),
  );
  for (const junk of [
    null,
    undefined,
    7,
    "girl",
    [],
    ["girl"],
    { gender: {} },
    { __proto__: { gender: "girl" } },
  ])
    assert.deepEqual(clean(junk), plain(Hero.DEFAULT), JSON.stringify(junk));
  assert.deepEqual(clean(JSON.parse('{"gender":"girl","__proto__":{"style":"bun"}}')), {
    gender: "girl",
    style: "hijab",
    scarf: "rose",
  });
});

test("the girl has hair and hijab styles and 6-8 scarf colours, each with a head piece", () => {
  const ids = Hero.STYLES.map((s) => s.id);
  for (const id of ["hijab", "hijab_sport", "hijab_flower", "ponytail", "braids", "bun", "bob"])
    assert.ok(ids.includes(id), id);
  assert.ok(Hero.SCARVES.length >= 6 && Hero.SCARVES.length <= 8);
  for (const s of Hero.STYLES)
    for (const c of Hero.SCARVES) {
      const head = Hero.headFor({ gender: "girl", style: s.id, scarf: c.id });
      assert.match(head.colour, HEX, s.id);
      assert.match(head.accent, HEX, s.id);
      if (s.covered) assert.equal(head.colour, c.hex, s.id + ": the hijab is the scarf colour");
      else assert.equal(head.type, "girl_" + s.id, s.id);
    }
  assert.equal(
    Hero.styleName({ gender: "girl", style: "hijab", scarf: "lilac" }),
    "Lilac plain hijab",
  );
  assert.equal(Hero.styleName({ gender: "girl", style: "bun", scarf: "lilac" }), "Bun");
});

test("every girl outfit and colour is modest: long sleeves, covered legs, never bare shins", () => {
  const G = Hero.GIRL;
  const ids = G.OUTFITS.map((o) => o.id);
  for (const id of ["kurung", "dress", "tunic", "abaya", "tracksuit"])
    assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  for (const o of G.OUTFITS) {
    assert.ok(o.palette.length >= 6 && o.palette.length <= 8, o.id + " palette size");
    assert.equal(new Set(o.palette.map((c) => c.hex)).size, o.palette.length, o.id + " colours");
    for (const c of o.palette) {
      const spec = G.specFor({ wear: o.id, tone: c.id });
      assert.equal(Hero.isModest(spec), true, o.id + "/" + c.id);
      assert.equal(spec.sleeves, "long", o.id);
      assert.ok(!spec.bareShins, o.id);
      assert.match(spec.legs, HEX, o.id + ": trousers, leggings or a long skirt");
      assert.match(spec.torso, HEX, o.id);
      if (spec.skirt)
        assert.ok(spec.skirt.top && spec.skirt.upper, o.id + ": the skirt reaches the knee");
    }
  }
  // the long ones reach the ankle
  for (const id of ["kurung", "abaya"])
    assert.ok(G.specFor({ wear: id, tone: "x" }).skirt.lower, id);
  // and the boy's bare-armed jacket is never a girl's outfit
  assert.equal(G.find("classic"), null);
  assert.equal(Hero.isModest(Wardrobe.specFor(Wardrobe.DEFAULT)), false);
});

test("the girl's ihram: plain white modest clothes, a white hijab, face and hands uncovered", () => {
  const spec = Hero.ihramSpec();
  assert.equal(Hero.isModest(spec), true);
  assert.equal(spec.torso, "#f7f6f1");
  assert.ok(spec.skirt.lower, "to the ankle");
  assert.equal(spec.hands, null, "hands are skin (uncovered), no gloves");
  const head = Hero.ihramHead();
  assert.equal(head.type, "hijab");
  assert.match(head.colour, /^#f[a-f0-9]{5}$/);
});

test("wardrobes per gender: a girl's outfit is cleaned with the girl's rules, a boy's with the boy's", () => {
  const boyRules = Hero.wardrobeFor("boy");
  const girlRules = Hero.wardrobeFor("girl");
  assert.equal(boyRules, Wardrobe);
  assert.deepEqual(plain(girlRules.sanitize({ wear: "abaya", tone: "plum" })), {
    wear: "abaya",
    tone: "plum",
  });
  assert.deepEqual(plain(girlRules.sanitize({ wear: "thobe", tone: "white" })), {
    wear: "kurung",
    tone: "teal",
  });
  assert.deepEqual(plain(boyRules.sanitize({ wear: "abaya", tone: "plum" })), {
    wear: "classic",
    tone: "royal",
  });
  const girlSave = Object.assign(Save.defaultState(), {
    hero: { gender: "girl", style: "bob", scarf: "sky" },
    wardrobe: { wear: "dress", tone: "red" },
  });
  const clean = Save.sanitize(girlSave);
  assert.deepEqual(plain(clean.hero), { gender: "girl", style: "bob", scarf: "sky" });
  assert.deepEqual(plain(clean.wardrobe), { wear: "dress", tone: "red" });
  const mixed = Save.sanitize(
    Object.assign(Save.defaultState(), { wardrobe: { wear: "dress", tone: "red" } }),
  );
  assert.deepEqual(
    plain(mixed.wardrobe),
    { wear: "classic", tone: "royal" },
    "a boy cannot wear the girl's dress id",
  );
});

test("the hero is saved, kept with the shared look (every region agrees) and New game forgets it", () => {
  const storage = memoryStorage();
  const state = Object.assign(Save.defaultState(), {
    hero: { gender: "girl", style: "braids", scarf: "mint" },
    wardrobe: { wear: "tunic", tone: "plum" },
  });
  assert.equal(Save.save(storage, state).ok, true);
  assert.deepEqual(JSON.parse(storage.data[LOOK_KEY]).hero, {
    gender: "girl",
    style: "braids",
    scarf: "mint",
  });
  const back = Save.load(storage);
  assert.equal(back.status, "loaded");
  assert.deepEqual(plain(back.state.hero), { gender: "girl", style: "braids", scarf: "mint" });
  // another region's empty slot wears the same hero and clothes
  const holy = loadSim(undefined, "haramain").Sim.Save;
  const other = holy.load(memoryStorage({ [LOOK_KEY]: storage.data[LOOK_KEY] }));
  assert.equal(other.status, "new");
  assert.deepEqual(plain(other.state.hero), { gender: "girl", style: "braids", scarf: "mint" });
  assert.deepEqual(plain(other.state.wardrobe), { wear: "tunic", tone: "plum" });
  // a hostile look cannot sneak in a bad hero or a boy's outfit for the girl
  const bad = JSON.stringify({
    v: 1,
    hero: { gender: "girl", style: "<img>" },
    wardrobe: { wear: "thobe" },
  });
  const hostile = holy.load(memoryStorage({ [LOOK_KEY]: bad }));
  assert.deepEqual(plain(hostile.state.hero), { gender: "girl", style: "hijab", scarf: "rose" });
  assert.deepEqual(plain(hostile.state.wardrobe), { wear: "kurung", tone: "teal" });
  // a look from before the hero choice keeps the slot's hero
  const old = JSON.stringify({
    v: 1,
    outfit: { hair: "classic", hat: "none" },
    wardrobe: { wear: "tunic", tone: "plum" },
  });
  const oldLook = memoryStorage({ [LOOK_KEY]: old, [Save.KEY]: storage.data[Save.KEY] });
  assert.equal(Save.load(oldLook).state.hero.gender, "girl");
  // New game clears it
  Save.clear(storage);
  assert.deepEqual(plain(Save.load(storage).state.hero), plain(Hero.DEFAULT));
});
