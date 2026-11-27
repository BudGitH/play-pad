// The tailor's wardrobe: outfits and colour palettes, the saved choice (clean, schema-checked, shared by every
// region) and the plain overrides the figure layer paints. Pure rules: games/kampung-quest/js/sim/wardrobe.js.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain, memoryStorage } from "./load-sim.mjs";

const KQ = loadSim();
const { Wardrobe, Save } = KQ.Sim;
const HEX = /^#[0-9a-f]{6}$/;
const LOOK_KEY = "kampung-quest:look";

test("the wardrobe offers the owner's outfits, each with 6 to 8 colours", () => {
  const ids = Wardrobe.OUTFITS.map((o) => o.id);
  for (const id of [
    "classic",
    "baju_melayu",
    "tee",
    "kurta",
    "thobe",
    "jubah",
    "raincoat",
    "sporty",
  ])
    assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  for (const o of Wardrobe.OUTFITS) {
    assert.ok(o.palette.length >= 6 && o.palette.length <= 8, o.id + " palette size");
    assert.equal(new Set(o.palette.map((c) => c.id)).size, o.palette.length, o.id + " ids");
    assert.equal(new Set(o.palette.map((c) => c.hex)).size, o.palette.length, o.id + " colours");
    for (const c of o.palette) {
      assert.match(c.hex, HEX, o.id + "/" + c.id);
      assert.match(c.alt, HEX, o.id + "/" + c.id + " alt");
      assert.ok(c.name.length > 2, c.id);
    }
  }
});

test("the default is the hero's colour family: royal blue jacket, white gloves, red shoes, bare arms", () => {
  assert.deepEqual(plain(Wardrobe.DEFAULT), { wear: "classic", tone: "royal" });
  assert.equal(Wardrobe.isDefault(Wardrobe.DEFAULT), true);
  const spec = Wardrobe.specFor(Wardrobe.DEFAULT);
  assert.equal(spec.torso, "#1d4fc6");
  assert.equal(spec.legs, "#1d4fc6");
  assert.equal(spec.hands, "#f6f5f0");
  assert.equal(spec.shoes, "#d7232c");
  assert.equal(spec.band, "#f6f5f0");
  assert.equal(spec.sleeves, "bare");
  assert.equal(spec.print.accent, "#3f74e8");
  assert.equal(Wardrobe.isDefault({ wear: "classic", tone: "teal" }), false);
  assert.equal(Wardrobe.isDefault({ wear: "thobe", tone: "white" }), false);
});

test("every outfit and colour gives a complete, modest, valid spec and a head piece", () => {
  for (const o of Wardrobe.OUTFITS) {
    for (const c of o.palette) {
      const w = { wear: o.id, tone: c.id };
      const spec = Wardrobe.specFor(w);
      assert.match(spec.torso, HEX, o.id + "/" + c.id);
      assert.ok(["bare", "short", "long"].includes(spec.sleeves), o.id);
      assert.ok(spec.legs && spec.shoes, o.id);
      // modest: only the hero's own jacket has bare arms; shorts stop at the knee (the thigh piece), never higher
      if (o.id !== "classic") assert.notEqual(spec.sleeves, "bare", o.id);
      if (spec.skirt) assert.ok(spec.skirt.upper || spec.skirt.top, o.id);
      const head = Wardrobe.headFor(w);
      assert.ok(["cap", "songkok", "kopiah", "hair_short"].includes(head.type), o.id);
      assert.match(head.colour, HEX, o.id);
    }
  }
});

test("robes cover to the ankle and tunics to the knee", () => {
  for (const id of ["thobe", "jubah"]) {
    const s = Wardrobe.specFor({ wear: id, tone: "white" });
    assert.ok(s.skirt.top && s.skirt.upper && s.skirt.lower, id);
    assert.equal(s.sleeves, "long");
  }
  const kurta = Wardrobe.specFor({ wear: "kurta", tone: "navy" });
  assert.ok(kurta.skirt.upper && !kurta.skirt.lower);
  assert.equal(Wardrobe.specFor({ wear: "tee", tone: "sunny" }).bareShins, true);
});

test("the short outfits (tee, sporty) are knee-length shorts with sleeves: no bare arms, no thigh", () => {
  for (const id of ["tee", "sporty"]) {
    const outfit = Wardrobe.OUTFITS.find((o) => o.id === id);
    for (const c of outfit.palette) {
      const s = Wardrobe.specFor({ wear: id, tone: c.id });
      assert.equal(s.sleeves, "short", id + "/" + c.id + " keeps its sleeves");
      assert.equal(s.bareShins, true, id + "/" + c.id + ": only the shins show");
      assert.match(
        s.legs,
        HEX,
        id + "/" + c.id + ": the thigh piece is covered (shorts to the knee)",
      );
      assert.ok(!s.skirt, id + " is plain shorts, not a skirt");
    }
  }
  // the classic jacket is the ONLY outfit with bare arms (the hero's own default look)
  const bare = Wardrobe.OUTFITS.filter((o) =>
    o.palette.some((c) => Wardrobe.specFor({ wear: o.id, tone: c.id }).sleeves === "bare"),
  );
  assert.deepEqual(plain(bare.map((o) => o.id)), ["classic"]);
});

test("a saved choice is cleaned: unknown ids, other outfits' colours and junk fall back safely", () => {
  const clean = (raw) => plain(Wardrobe.sanitize(raw));
  assert.deepEqual(clean({ wear: "thobe", tone: "navy" }), { wear: "thobe", tone: "navy" });
  assert.deepEqual(clean({ wear: "thobe", tone: "royal" }), { wear: "thobe", tone: "white" });
  assert.deepEqual(clean({ wear: "mohawk", tone: "navy" }), { wear: "classic", tone: "royal" });
  for (const junk of [
    null,
    undefined,
    5,
    "thobe",
    [],
    [1],
    { wear: 7, tone: {} },
    { wear: "__proto__" },
  ])
    assert.deepEqual(clean(junk), { wear: "classic", tone: "royal" }, JSON.stringify(junk));
  assert.deepEqual(clean(JSON.parse('{"wear":"tee","__proto__":{"x":1}}')), {
    wear: "tee",
    tone: "sunny",
  });
});

test("switching outfit keeps the colour when the new outfit comes in it, recolour ignores unknown ids", () => {
  assert.deepEqual(plain(Wardrobe.choose({ wear: "classic", tone: "teal" }, "baju_melayu")), {
    wear: "baju_melayu",
    tone: "teal",
  });
  assert.deepEqual(plain(Wardrobe.choose({ wear: "classic", tone: "pink" }, "thobe")), {
    wear: "thobe",
    tone: "white",
  });
  assert.deepEqual(plain(Wardrobe.choose({ wear: "tee", tone: "red" }, "nonsense")), {
    wear: "tee",
    tone: "red",
  });
  assert.deepEqual(plain(Wardrobe.recolour({ wear: "tee", tone: "red" }, "sky")), {
    wear: "tee",
    tone: "sky",
  });
  assert.deepEqual(plain(Wardrobe.recolour({ wear: "tee", tone: "red" }, "royal")), {
    wear: "tee",
    tone: "red",
  });
});

test("specFor hands out a fresh object each time (a caller cannot change the outfit table)", () => {
  const a = Wardrobe.specFor({ wear: "classic", tone: "royal" });
  a.torso = "#000000";
  assert.equal(Wardrobe.specFor({ wear: "classic", tone: "royal" }).torso, "#1d4fc6");
});

test("names read well for the bag and the screen reader", () => {
  assert.equal(Wardrobe.nameOf(Wardrobe.DEFAULT), "Royal blue Classic jacket");
  assert.equal(Wardrobe.nameOf({ wear: "baju_melayu", tone: "teal" }), "Teal Baju Melayu");
});

test("the wardrobe is part of the save: round trip, junk cleaned, default for old saves", () => {
  const storage = memoryStorage();
  const state = Save.defaultState();
  assert.deepEqual(plain(state.wardrobe), { wear: "classic", tone: "royal" });
  state.wardrobe = { wear: "thobe", tone: "navy" };
  assert.equal(Save.save(storage, state).ok, true);
  assert.deepEqual(plain(Save.load(storage).state.wardrobe), { wear: "thobe", tone: "navy" });
  const old = Save.sanitize({ v: 1 });
  assert.deepEqual(plain(old.wardrobe), { wear: "classic", tone: "royal" });
  const junk = Save.sanitize({
    v: 1,
    wardrobe: { wear: "thobe", tone: "<img src=x onerror=alert(1)>" },
  });
  assert.deepEqual(plain(junk.wardrobe), { wear: "thobe", tone: "white" });
});

test("the look (barber style + wardrobe) is shared by every region's save slot", () => {
  const storage = memoryStorage();
  const state = Save.defaultState();
  state.outfit = { hair: "curly", hat: "none" };
  state.wardrobe = { wear: "raincoat", tone: "red" };
  Save.save(storage, state);
  assert.ok(LOOK_KEY in storage.data);
  // another region's slot (here: no slot yet) starts in the same clothes
  const other = memoryStorage({ [LOOK_KEY]: storage.data[LOOK_KEY] });
  const fresh = Save.load(other);
  assert.equal(fresh.status, "new");
  assert.deepEqual(plain(fresh.state.wardrobe), { wear: "raincoat", tone: "red" });
  assert.deepEqual(plain(fresh.state.outfit), { hair: "curly", hat: "none" });
  // and the shared look wins over an older look in the slot
  const stale = Save.defaultState();
  stale.wardrobe = { wear: "tee", tone: "red" };
  const slot = memoryStorage({ [LOOK_KEY]: storage.data[LOOK_KEY] });
  Save.save(slot, stale);
  assert.deepEqual(plain(Save.load(slot).state.wardrobe), { wear: "tee", tone: "red" });
});

test("a damaged shared look is ignored; New game forgets it", () => {
  for (const text of ["{nope", "[]", '{"v":9}', "null", "x".repeat(300000)]) {
    const s = memoryStorage({ [LOOK_KEY]: text });
    const r = Save.load(s);
    assert.equal(r.status, "new");
    assert.deepEqual(plain(r.state.wardrobe), { wear: "classic", tone: "royal" });
  }
  const storage = memoryStorage();
  const state = Save.defaultState();
  state.wardrobe = { wear: "kurta", tone: "navy" };
  Save.save(storage, state);
  assert.equal(Save.clear(storage), true);
  assert.deepEqual(JSON.parse(storage.data[LOOK_KEY]), { v: 1, cleared: true });
  assert.deepEqual(plain(Save.load(storage).state.wardrobe), { wear: "classic", tone: "royal" });
});

test("New game in one region clears the look in every region (no resurrection)", () => {
  const kampung = loadSim().Sim.Save;
  const makkah = loadSim(undefined, "haramain").Sim.Save;
  assert.notEqual(kampung.KEY, makkah.KEY);
  const storage = memoryStorage();
  const look = (save, wear, hair) => {
    const s = save.defaultState();
    s.wardrobe = { wear, tone: "navy" };
    s.outfit = { hair, hat: "none" };
    return s;
  };
  // the player dresses in the kampung, then in Makkah: both slots hold a look
  assert.equal(kampung.save(storage, look(kampung, "kurta", "curly")).ok, true);
  assert.equal(makkah.save(storage, look(makkah, "thobe", "curly")).ok, true);
  // New game in the kampung wipes its slot and the shared look
  assert.equal(kampung.clear(storage), true);
  assert.deepEqual(plain(kampung.load(storage).state.wardrobe), { wear: "classic", tone: "royal" });
  // Makkah still holds its old slot, but must NOT bring the thobe back
  const m = makkah.load(storage);
  assert.equal(m.status, "loaded");
  assert.deepEqual(plain(m.state.wardrobe), { wear: "classic", tone: "royal" });
  assert.deepEqual(plain(m.state.outfit), { hair: "classic", hat: "none" });
  // saving in Makkah and returning to the kampung must not resurrect it either
  assert.equal(makkah.save(storage, m.state).ok, true);
  assert.deepEqual(plain(kampung.load(storage).state.wardrobe), { wear: "classic", tone: "royal" });
  assert.deepEqual(plain(kampung.load(storage).state.outfit), { hair: "classic", hat: "none" });
});
