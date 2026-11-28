// Kampung Quest: spoken NPC voices (AC-H7, features/kampung-quest-haramain/requirements.md).
// Every dialogue line and speech bubble is also read aloud through speechSynthesis, each character with
// their own pitch / rate / voice; nothing speaks while muted, paused, under the azan or with the
// "Character voices" switch off; a closing dialogue stops its voice; overlapping bubbles are rate
// limited; and a device without speechSynthesis just stays silent. window.speechSynthesis is replaced
// by a recorder (headless Chromium has no voices): window.__spoken lists every utterance.
// The page runs with `?still=1` (time moves only through __kq.step).
// Run: npx playwright test tests/kampung-quest-voice.spec.mjs
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);
const voice = (page) => kq(page, () => window.__kq.voice());
const spoken = (page) => kq(page, () => window.__spoken.slice());

/** Replace the speech synthesiser with a recorder (runs before the page's own scripts). */
function installStub() {
  const log = [];
  let cancels = 0;
  const voices = [
    { name: "Stub Daniel (male)", lang: "en-GB", localService: true },
    { name: "Stub Samantha (female)", lang: "en-US", localService: true },
    { name: "Stub Francais", lang: "fr-FR", localService: true },
  ];
  window.SpeechSynthesisUtterance = function (text) {
    this.text = text;
    this.pitch = 1;
    this.rate = 1;
    this.volume = 1;
    this.voice = null;
    this.lang = "";
  };
  // window.speechSynthesis is a read-only accessor: it has to be redefined, not assigned
  const synth = {
    speaking: false,
    getVoices: () => voices,
    addEventListener() {},
    cancel() {
      cancels += 1;
    },
    speak(u) {
      log.push({ text: u.text, pitch: u.pitch, rate: u.rate, voice: u.voice && u.voice.name });
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  window.__spoken = log;
  window.__cancels = () => cancels;
}

async function boot(page) {
  await page.goto(GAME);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await step(page, 300);
}

/** Open a dialogue (as the missions do) and return nothing; the Next / reply buttons are real. */
const openDialogue = (page, o) => kq(page, (d) => window.KQ.Game.Dialogue.open(d), o);
const closeDialogue = (page) => kq(page, () => window.KQ.Game.UI.closeSheet("test"));

/** Browser-side: walk the hero at a neighbour for up to 8 s so they greet (as in the greetings spec). */
function walkAtNeighbour(id) {
  const k = window.__kq;
  k.setMinute(420);
  for (let i = 0; i < 8 && !k.npc(id); i += 1) k.step(200);
  const n = k.npc(id);
  k.greetChance(1);
  k.place(n.x + 4, n.z, -Math.PI / 2);
  k.input("up", true);
  for (let i = 0; i < 240; i += 1) window.KQ.Game.Loop.frame(1 / 30, true);
  k.input("up", false);
  k.greetChance(null);
}

test.use({ viewport: { width: 1100, height: 700 } });
test.describe.configure({ mode: "serial", timeout: 240_000 });

let page;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(150_000); // booting the 3D world in software GL
  page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.addInitScript(installStub);
  await boot(page);
});
test.afterAll(async () => page && (await page.close()));
test.afterEach(async () => {
  await kq(page, () => {
    const G = window.KQ.Game;
    if (G.UI.modalOpen()) G.UI.closeSheet("test");
    G.Voice.cancel("test");
    window.__kq.greetChance(null);
    G.PrayerFlow.reset(); // leave any azan card behind
    G.Audio.stopAzan();
    window.__spoken.length = 0;
    G.Settings.prefs.voices = true;
  });
});

test("speech is available and on by default, with the device's English voices found", async () => {
  const v = await voice(page);
  expect(v.supported).toBe(true);
  expect(v.enabled).toBe(true);
  await openDialogue(page, { id: "nenek", name: "Nenek", lines: ["Hello"] });
  expect((await voice(page)).voices, "only the two English stub voices count").toBe(2);
});

test("a real conversation: talking to Nenek speaks her line in her own voice", async () => {
  const text = await kq(page, () => {
    const k = window.__kq;
    const n = k.npc("nenek");
    k.place(n.x + 1.2, n.z, Math.PI / 2);
    k.step(200);
    k.interact();
    return document.querySelector(".kq-bubble-text").textContent;
  });
  // the one-time spoken hint for the Talk button ("Tap the big button to talk.") may come first
  const line = (await spoken(page)).find((s) => s.text === text);
  expect(line, "Nenek's line was spoken").toBeDefined();
  expect(line.pitch).toBeCloseTo(1.05, 2);
  expect(line.rate).toBeCloseTo(0.8, 2);
});

test("each character sounds different: kids high, elders low and slow, women and men get matching voices", async () => {
  const ids = [
    ["kid_aisyah", "Aisyah"],
    ["nenek", "Nenek"],
    ["atuk", "Atuk"],
    ["hawker_ali", "Abang Ali"],
  ];
  for (const [id, name] of ids) {
    await openDialogue(page, { id, name, lines: ["Salam, " + name] });
    await closeDialogue(page);
  }
  const by = Object.fromEntries((await spoken(page)).map((u) => [u.text, u]));
  expect(by["Salam, Aisyah"].pitch).toBeGreaterThan(1.6);
  expect(by["Salam, Aisyah"].pitch).toBeGreaterThan(by["Salam, Nenek"].pitch);
  expect(by["Salam, Nenek"].pitch).toBeGreaterThan(by["Salam, Atuk"].pitch);
  expect(by["Salam, Atuk"].rate).toBeLessThan(by["Salam, Abang Ali"].rate);
  expect(by["Salam, Aisyah"].voice).toMatch(/female/);
  expect(by["Salam, Atuk"].voice).toMatch(/male/);
  Object.values(by).forEach((u) => expect(u.voice).not.toMatch(/Francais/));
});

test("the dialogue's name also works when only the name is known", async () => {
  await openDialogue(page, { name: "Atuk", lines: ["Assalamualaikum"] });
  const u = (await spoken(page)).at(-1);
  expect(u.pitch).toBeCloseTo(0.7, 2);
});

test("Next speaks the next line (replacing the first); closing the dialogue stops the voice", async () => {
  await openDialogue(page, { id: "nenek", name: "Nenek", lines: ["First line.", "Second line."] });
  expect((await spoken(page)).map((u) => u.text)).toEqual(["First line."]);
  const before = await kq(page, () => window.__cancels());
  await page.locator(".kq-bubble-actions button").first().click(); // Next
  expect((await spoken(page)).map((u) => u.text)).toEqual(["First line.", "Second line."]);
  expect(await kq(page, () => window.__cancels())).toBeGreaterThan(before);
  expect((await voice(page)).speaking).toBe(true);
  const c = await kq(page, () => window.__cancels());
  await closeDialogue(page);
  expect(await kq(page, () => window.__cancels()), "closing cancelled the speech").toBeGreaterThan(
    c,
  );
  expect((await voice(page)).speaking).toBe(false);
});

test("muted, paused, under the azan, or switched off: nothing is spoken, and each refusal is counted", async () => {
  const say = (id) => kq(page, (i) => window.KQ.Game.Voice.line({ id: i, text: "Hello " + i }), id);
  await kq(page, () => window.__kq.action("mute"));
  expect(await say("nenek")).toBe(false);
  await kq(page, () => window.__kq.action("mute"));
  expect((await voice(page)).refused.muted).toBe(1);
  await kq(page, () => window.KQ.Game.Loop.setPaused(true));
  expect(await say("nenek")).toBe(false);
  await kq(page, () => window.KQ.Game.Loop.setPaused(false));
  expect((await voice(page)).refused.paused).toBe(1);
  await kq(page, () => (window.KQ.Game.Settings.prefs.voices = false));
  expect(await say("nenek")).toBe(false);
  await kq(page, () => (window.KQ.Game.Settings.prefs.voices = true));
  expect((await voice(page)).refused.off).toBe(1);
  expect(await spoken(page)).toEqual([]);
  await kq(page, () => window.__kq.forcePrayer("zohor"));
  await step(page, 300);
  expect(await say("nenek")).toBe(false);
  const r = (await voice(page)).refused;
  expect(
    (r.azan || 0) + (r.prayer || 0),
    "refused during the azan / prayer",
  ).toBeGreaterThanOrEqual(1);
  expect(await spoken(page)).toEqual([]);
});

test("the azan starting cuts a line that is being spoken", async () => {
  await kq(page, () =>
    window.KQ.Game.Voice.line({ id: "nenek", text: "A long chat about the weather." }),
  );
  expect((await voice(page)).speaking).toBe(true);
  const c = await kq(page, () => window.__cancels());
  await kq(page, () => window.__kq.forcePrayer("asar"));
  await step(page, 200);
  expect((await voice(page)).speaking).toBe(false);
  expect(await kq(page, () => window.__cancels())).toBeGreaterThan(c);
});

test("overlapping bubbles: out of earshot is dropped, a nearer one cuts in, the latest waits its turn", async () => {
  await kq(page, () => {
    window.__kq.setMinute(480);
    window.__kq.greetChance(0); // no real greetings mixing in
  });
  await step(page, 5000); // let any bubbles already on screen finish
  await kq(page, () => {
    window.KQ.Game.Voice.cancel("test");
    window.__spoken.length = 0;
  });
  const bubble = (who, text, dist) =>
    kq(page, (b) => window.KQ.Game.Voice.bubble(b), { who, text, dist });
  expect(await bubble("nenek", "far away", 40)).toBe(false);
  expect((await voice(page)).refused.range).toBe(1);
  expect(await bubble("nenek", "first one", 12)).toBe(true);
  expect(await bubble("atuk", "nearer one", 6), "a much nearer bubble cuts in").toBe(true);
  expect(await bubble("aunty_mei", "waits", 5.5)).toBe(false);
  expect(await bubble("uncle_lim", "latest", 5)).toBe(false);
  expect((await voice(page)).waiting).toBe(true);
  await step(page, 3000);
  const texts = (await spoken(page)).map((u) => u.text);
  expect(texts).toEqual(["first one", "nearer one", "latest"]);
  const v = await voice(page);
  expect(v.refused.dropped, "the replaced waiting bubble").toBe(1);
  expect(v.waiting).toBe(false);
});

test("a bubble never talks over a dialogue", async () => {
  await openDialogue(page, { id: "nenek", name: "Nenek", lines: ["Please listen."] });
  const ok = await kq(page, () =>
    window.KQ.Game.Voice.bubble({ who: "atuk", text: "psst", dist: 2 }),
  );
  expect(ok).toBe(false);
  expect((await spoken(page)).map((u) => u.text)).toEqual(["Please listen."]);
  expect((await voice(page)).refused.dialogue).toBe(1);
});

test("a neighbour's salaam bubble is spoken, then the hero's reply, each in their own voice", async () => {
  await kq(page, walkAtNeighbour, "nenek");
  const said = await spoken(page);
  const hello = said.find((u) => u.text === "Assalamualaikum!");
  const reply = said.find((u) => u.text === "Waalaikumsalam!");
  expect(hello, "Nenek's bubble was spoken").toBeTruthy();
  expect(hello.pitch).toBeCloseTo(1.05, 2);
  expect(reply, "the hero's reply was spoken after it").toBeTruthy();
  expect(reply.pitch).toBeCloseTo(1.32, 2);
});

test("the Pause menu has a Character voices switch, and Off silences the dialogue", async () => {
  await kq(page, () => window.__kq.action("pause"));
  const group = page.getByRole("group", { name: "Character voices" });
  await expect(group).toBeVisible();
  await expect(group.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "Off" }).click();
  expect(await kq(page, () => window.KQ.Game.Settings.prefs.voices)).toBe(false);
  expect(await kq(page, () => localStorage.getItem("kampung-quest:prefs"))).toContain(
    '"voices":false',
  );
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(page, () => window.KQ.Game.Loop.setPaused(false));
  await openDialogue(page, { id: "nenek", name: "Nenek", lines: ["Can you hear me?"] });
  expect(await spoken(page)).toEqual([]);
  expect((await voice(page)).refused.off).toBeGreaterThanOrEqual(1);
  await kq(page, () => {
    window.KQ.Game.Settings.prefs.voices = true;
    window.KQ.Game.Settings.save(window.KQ.Game.S.storage);
  });
});

test("a saved 'voices off' is honoured on load and a junk value falls back to on", async () => {
  const clean = await kq(page, () => {
    const G = window.KQ.Game;
    const out = [];
    [{ voices: false }, { voices: "no" }, {}].forEach((raw) => {
      localStorage.setItem("kampung-quest:prefs", JSON.stringify(raw));
      out.push(G.Settings.load(G.S.storage).voices);
    });
    return out;
  });
  expect(clean).toEqual([false, true, true]);
});

test("a device with no speechSynthesis: the game still talks on screen, silently, with no error", async ({
  browser,
}) => {
  const quiet = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  quiet.on("pageerror", (e) => errors.push(e.message));
  await quiet.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
    delete window.SpeechSynthesisUtterance;
  });
  await boot(quiet);
  await openDialogue(quiet, { id: "nenek", name: "Nenek", lines: ["Hello there"] });
  await expect(quiet.locator(".kq-bubble-text")).toHaveText("Hello there");
  const v = await voice(quiet);
  expect(v.supported).toBe(false);
  expect(v.spoken).toBe(0);
  expect(v.refused.unsupported).toBeGreaterThanOrEqual(1);
  await kq(quiet, walkAtNeighbour, "nenek");
  expect(errors).toEqual([]);
  await quiet.close();
});
