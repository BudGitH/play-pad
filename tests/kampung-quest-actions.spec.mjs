// Kampung Quest: "simple actions for 7-year-olds" (playability round, AC-P24 / AC-P25).
// One fixed Action control (id kqTalk) with a picture and one word; a chooser of up to three picture
// tiles when two or more actions are in reach (the known bug: a neighbour's Talk used to hide the
// ice-cream cart, Say hi and shop counters); one word table; Rest in one tap; Pray as one path behind
// every door; spoken hints once per kind; and the placement on phone landscape, portrait and iPad.
// The pure order rules are unit-tested in tests/kampung-quest/action-order.test.mjs.
// Run: PW_PORT=5614 npx playwright test tests/kampung-quest-actions.spec.mjs --project=kampung-quest
// The page runs with `?still=1` (time moves only through __kq.step), like the other Kampung Quest specs.
import { test, expect, devices } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);
const state = (page) => kq(page, () => window.__kq.state());
const talk = (page) => page.locator("#kqTalk");

/** Replace the speech synthesiser with a recorder (headless Chromium has no voices). */
function installSpeechStub() {
  const log = [];
  window.SpeechSynthesisUtterance = function (text) {
    this.text = text;
  };
  const synth = {
    speaking: false,
    getVoices: () => [{ name: "Stub Daniel", lang: "en-GB", localService: true }],
    addEventListener() {},
    cancel() {},
    speak: (u) => log.push(u.text),
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  window.__spoken = log;
}

/** Boot the game, press Start and wait until it runs. */
async function boot(page) {
  await page.addInitScript(installSpeechStub);
  await page.goto(GAME);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 120_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 60_000 }).toBe(true);
  await step(page, 300);
}

/** Put the hero somewhere by place id, daylight, with a clean slate (no sheet, nothing due). */
async function goTo(page, poi) {
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(page, (id) => window.__kq.teleport(id), poi);
  await step(page, 300);
}

/** Stand `d` metres from a neighbour. */
async function nearNpc(page, id, d) {
  const n = await kq(page, (i) => window.__kq.npc(i), id);
  await kq(page, ([x, z]) => window.__kq.place(x, z, -Math.PI / 2), [n.x + d, n.z]);
  await step(page, 300);
}

/** The rectangle of an element as [left, top, width, height] (rounded). */
const rectOf = (page, sel) =>
  kq(
    page,
    (q) => {
      const r = document.querySelector(q).getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round);
    },
    sel,
  );

/** Do two [left, top, width, height] rectangles overlap? */
function overlaps(a, b) {
  return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

/** Bring a neighbour next to the hero and start the ice-cream cart beside them: two actions in reach. */
async function neighbourAndCart(page) {
  await kq(page, () => {
    const k = window.__kq;
    k.setMinute(660);
    k.teleport("playground");
    k.stopEvent();
    k.forceEvent("icecream");
  });
  for (
    let i = 0;
    i < 40 && !(await kq(page, () => window.__kq.events().info?.phase === "serve"));
    i += 1
  )
    await step(page, 1000);
  await kq(page, () => {
    const G = window.KQ.Game;
    const cart = window.__kq.events().info.cart;
    window.__kq.place(cart.x, cart.z - 2, 0);
    const A = G.S.npcs.byId.imam_hakim; // a neighbour who stands still: bring him beside the hero
    A.hidden = false;
    A.x = A.goal.x = cart.x + 0.9;
    A.z = A.goal.z = cart.z - 2;
    A.path = [];
  });
  await step(page, 200);
}

/** The `kind` of every action offered, in chooser order. */
const kinds = async (page) => (await state(page)).targets.map((t) => t.kind);

let page;
const errors = [];

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
});
test.afterAll(async () => {
  await page.close();
});

test("AC-P24.1 the Action control has one fixed place, whatever the target; the world only has a pointer", async () => {
  const spots = [];
  for (const poi of ["stall_prata", "home", "mosque_hall", "mosque_wudu"]) {
    await goTo(page, poi);
    await expect(talk(page)).toBeVisible();
    spots.push(await rectOf(page, "#kqTalk"));
  }
  await nearNpc(page, "nenek", 1.4);
  spots.push(await rectOf(page, "#kqTalk"));
  for (const r of spots)
    for (let i = 0; i < 4; i += 1) expect(Math.abs(r[i] - spots[0][i])).toBeLessThanOrEqual(2);
  const pointer = await kq(page, () => {
    const el = document.getElementById("kqPointer");
    return { events: getComputedStyle(el).pointerEvents, text: el.textContent, hidden: el.hidden };
  });
  expect(pointer.events).toBe("none");
  expect(pointer.text).toBe("");
  expect(await kq(page, () => document.querySelectorAll("#kqTalk").length)).toBe(1);
});

test("AC-P24.2 a neighbour a few steps away is never a button: only the arrow points at her", async () => {
  await nearNpc(page, "nenek", 3.6);
  const t = (await state(page)).target;
  expect(t === null || t.enabled, "no disabled target").toBe(true);
  const words = await kq(page, () =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent !== null)
      .map((b) => b.textContent + b.getAttribute("aria-label")),
  );
  expect(words.join("|")).not.toMatch(/Walk closer/);
  // the arrow is the only sign of her: point it at her (other prompts nearby may own the arrow this frame)
  const arrow = await kq(page, () => {
    const G = window.KQ.Game;
    const far = G.Interact.far();
    G.ActionBar.point(far, G.S.camera, G.S.size.w, G.S.size.h);
    return { far: far && far.id, enabled: far && far.enabled, hidden: G.Hud.refs.pointer.hidden };
  });
  expect(arrow).toEqual({ far: "nenek", enabled: false, hidden: false });
  await nearNpc(page, "nenek", 1.4);
  expect((await state(page)).target).toMatchObject({ id: "nenek", enabled: true });
  expect(await kq(page, () => document.getElementById("kqPointer").hidden)).toBe(false);
});

test("AC-P24.3 a neighbour and the ice-cream cart: both are offered, each runs its own action", async () => {
  await neighbourAndCart(page);
  const ks = await kinds(page);
  expect(ks, "the cart is not hidden behind the neighbour's Talk").toEqual(
    expect.arrayContaining(["npc", "event"]),
  );
  const tiles = page.locator(".kq-talk-more");
  expect(await tiles.count()).toBeGreaterThanOrEqual(1);
  const heights = await kq(page, () =>
    [...document.querySelectorAll("#kqTalk, .kq-talk-more")].map((b) => [
      b.offsetWidth,
      b.offsetHeight,
    ]),
  );
  for (const [w, h] of heights) expect(Math.min(w, h)).toBeGreaterThanOrEqual(56);
  // tap the second tile: it runs its own action (the other one than the big button)
  const second = (await state(page)).targets[1].kind;
  const coins = (await state(page)).coins;
  await tiles.first().click();
  await step(page, 200);
  if (second === "event") expect((await state(page)).coins).toBeLessThan(coins);
  else await expect(page.locator(".kq-bubble")).toBeVisible();
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
});

/** The action of kind `kind` really ran: the cart took coins, or the neighbour's talk opened. */
async function expectRan(pg, kind, coinsBefore) {
  if (kind === "event") expect((await state(pg)).coins).toBeLessThan(coinsBefore);
  else await expect(pg.locator(".kq-bubble")).toBeVisible();
}

test("AC-P24.3 keys: 2 runs the next tile, 1 and E run the big button", async () => {
  test.setTimeout(150_000);
  for (const key of ["2", "1", "e"]) {
    await neighbourAndCart(page);
    const { targets, coins } = await state(page);
    expect(targets.length).toBeGreaterThanOrEqual(2);
    await page.keyboard.press(key);
    await step(page, 200);
    await expectRan(page, targets[key === "2" ? 1 : 0].kind, coins);
    await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
    await kq(page, () => window.__kq.stopEvent());
  }
});

test("AC-P24.3 a camel or pony: Ride is the big button, Say hi is the second tile", async () => {
  await kq(page, () => window.__kq.place(60.8, 41.2, Math.PI / 2));
  await step(page, 300);
  const t = (await state(page)).targets;
  expect(t.map((x) => x.label)).toEqual(expect.arrayContaining(["Ride", "Say hi"]));
  await page.locator(".kq-talk-more").first().click();
  await step(page, 200);
  expect(await kq(page, () => window.__kq.mounts().hi)).toBeGreaterThanOrEqual(1);
  await expect(page.locator(".kq-sheet")).toHaveCount(0); // no "Say hi or Ride" menu card any more
});

test("AC-P24.4 one word table: known words, and an unknown action degrades to the hand picture", async () => {
  await goTo(page, "stall_prata");
  await expect(talk(page)).toContainText("Eat");
  const known = await kq(page, () =>
    window.KQ.Game.ActionWords.info({ kind: "obj", id: "home_door", label: "Rest" }),
  );
  expect(known).toMatchObject({ word: "Rest", icon: "moon", known: true });
  const unknown = await kq(page, () => {
    const G = window.KQ.Game;
    const fake = {
      kind: "event",
      id: "zzz",
      label: "Zzz",
      aria: "Do a Zzz",
      x: 0,
      z: 0,
      dist: 1,
      h: 1,
      enabled: true,
    };
    G.ActionBar.render([fake]);
    return { info: G.ActionWords.info(fake), text: document.getElementById("kqTalk").textContent };
  });
  expect(unknown.info).toMatchObject({ icon: "hand", word: "Zzz", known: false });
  expect(unknown.text).toContain("Zzz");
  await step(page, 200); // the next frame shows the real target again
});

/** How many times a hint that mentions `word` was spoken so far. */
const heard = (pg, word) =>
  kq(pg, (w) => window.__spoken.filter((s) => new RegExp(w).test(s)).length, word);

test("AC-P24.5 a spoken hint once per kind, never twice, and not while muted", async () => {
  await kq(page, () => window.KQ.Game.Say.reset());
  await kq(page, () => (window.__spoken.length = 0));
  await step(page, 4000); // let any line being said finish
  await nearNpc(page, "nenek", 1.4);
  await step(page, 4000);
  expect(await heard(page, "to talk")).toBe(1);
  await goTo(page, "stall_prata");
  await nearNpc(page, "nenek", 1.4);
  await step(page, 4000);
  expect(await heard(page, "to talk"), "once only").toBe(1);
  await kq(page, () => window.__kq.action("mute"));
  await goTo(page, "home");
  await step(page, 4000);
  expect(await heard(page, "Rest"), "muted: nothing is said").toBe(0);
  expect(await kq(page, () => window.__kq.say()), "and it is not counted as heard").not.toContain(
    "rest",
  );
  await kq(page, () => window.__kq.action("mute"));
  await step(page, 4000);
  expect(await heard(page, "Rest"), "unmuted: it is said now").toBe(1);
});

test("AC-P25.1 Rest: one tap at the home door, no question, energy full and the clock 30 minutes on", async () => {
  await kq(page, () => window.KQ.Game.S.sim.needs.restore({ hunger: 80, energy: 40 }));
  await goTo(page, "home");
  await expect(talk(page)).toContainText("Rest");
  const before = await state(page);
  await talk(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); // no "Rest at home?" card
  await expect
    .poll(async () => (await state(page)).energy, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(95);
  const after = await state(page);
  const minutes = (s) => Number(s.hhmm.slice(0, 2)) * 60 + Number(s.hhmm.slice(3));
  expect(minutes(after) - minutes(before)).toBeGreaterThanOrEqual(29);
  await step(page, 500);
  expect(await kq(page, () => window.KQ.Game.S.player.locked)).toBe(false);
});

test("AC-P25.1 Rest is not offered at full energy, and the Tired bar is a one-tap Rest anywhere", async () => {
  await goTo(page, "home");
  expect((await state(page)).target?.id ?? null, "full energy: nothing to rest for").not.toBe(
    "home_door",
  );
  await kq(page, () => window.KQ.Game.S.sim.needs.restore({ hunger: 80, energy: 10 }));
  await kq(page, () => window.__kq.place(10, 10, 0));
  await step(page, 400);
  await expect(talk(page)).toContainText("Rest");
  await expect(page.locator("#kqNeeds")).toHaveAttribute("role", "button");
  await page.locator("#kqNeeds").click();
  await expect
    .poll(async () => (await state(page)).energy, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(95);
  await step(page, 500);
});

/* Holds for the Rest-refusal test. Each runs in the page (no outer variables); one method is patched and put back. */
const holdDriving = () => {
  window.__real = window.KQ.Game.Vehicles.mounted;
  window.KQ.Game.Vehicles.mounted = () => true; // as if driving
};
const freeDriving = () => (window.KQ.Game.Vehicles.mounted = window.__real);
const holdRiding = () => {
  window.__real = window.KQ.Game.Mounts.riding;
  window.KQ.Game.Mounts.riding = () => ({ id: "camel" }); // as if on an animal
};
const freeRiding = () => (window.KQ.Game.Mounts.riding = window.__real);
const holdLocked = () => window.KQ.Game.Player.lock(window.KQ.Game.S.player, null, "sit");
const freeLocked = () => window.KQ.Game.Player.release(window.KQ.Game.S.player);

test("AC-P25.1 Rest from the Tired bar refuses, with a kind line, while driving, riding or held by something else", async () => {
  await kq(page, () => window.__kq.setMinute(10 * 60)); // mid-morning: no prayer is due
  await kq(page, () => window.KQ.Game.S.sim.needs.restore({ hunger: 80, energy: 10 }));
  await kq(page, () => window.__kq.place(10, 10, 0));
  await step(page, 400);
  await restRefusedWhile(page, holdDriving, freeDriving, /Get off first/);
  await restRefusedWhile(page, holdRiding, freeRiding, /Get off first/);
  await restRefusedWhile(page, holdLocked, freeLocked, /Finish this first/);
  await page.locator("#kqNeeds").click(); // free again: it rests
  await expect
    .poll(async () => (await state(page)).energy, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(95);
  await step(page, 500);
});

test("AC-P25.1 Rest is refused while a fard prayer is due (Pray comes first)", async () => {
  await kq(page, () => window.KQ.Game.S.sim.needs.restore({ hunger: 80, energy: 10 }));
  await goTo(page, "home");
  await kq(page, () => window.__kq.forcePrayer("zohor"));
  await step(page, 400);
  expect((await state(page)).target?.label ?? "").not.toBe("Rest");
  await page.locator("#kqNeeds").click();
  await step(page, 300);
  expect((await state(page)).energy, "no rest happened").toBeLessThan(30);
  await expect(page.locator(".kq-toast", { hasText: /Prayer time first/ })).toBeVisible();
});

/** Hold the hero as `hold` says, tap the Tired bar, expect the kind line and no rest; then `release`. */
async function restRefusedWhile(pg, hold, release, pattern) {
  await kq(pg, hold);
  const before = (await state(pg)).energy;
  await pg.locator("#kqNeeds").click();
  await step(pg, 300);
  await expect(pg.locator(".kq-toast", { hasText: pattern }).last()).toBeVisible();
  expect((await state(pg)).energy, "no rest happened").toBe(before);
  const resting = await kq(pg, () => window.KQ.Game.S.root.classList.contains("kq-resting"));
  expect(resting, "no rest scene started").toBe(false);
  await kq(pg, release);
}

test("AC-P25.2 / .3 Pray from the status card: wudu, then the prayer, in one flow; no Sunat / Wudu / Show me the way", async () => {
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(page, () => window.__kq.teleport("mosque_wudu"));
  await step(page, 300);
  await expect(talk(page)).toContainText("Pray");
  await page.locator("#kqStatus").click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  const flow = (await state(page)).prayer.flow;
  expect(flow.kind).toMatch(/due|qada/);
  for (let i = 0; i < 60 && (await state(page)).prayer.flow?.phase === "wudu"; i += 1)
    await page.locator(".kq-wudu-act").click();
  await expect(page.getByRole("dialog", { name: "Prayer steps" })).toBeVisible();
  expect((await state(page)).prayer.flow.phase).toBe("pray");
  const labels = await kq(page, () =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent)
      .map((b) => b.textContent),
  );
  expect(labels.join("|")).not.toMatch(/Sunat|Wudu|Show me the way/);
  await page.keyboard.press("Escape");
  await kq(page, () => window.KQ.Game.S.sim.prayer.cancelFlow());
});

test("AC-P25.2 Pray from far away: one tap draws the footprints, then Pray here prays on the spot", async () => {
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(page, () => window.__kq.place(30, 30, 0));
  await kq(page, () => window.__kq.forcePrayer("asar"));
  await step(page, 400);
  await page.locator("#kqStatus").click();
  await step(page, 300);
  const st = await state(page);
  expect(st.ui.guide, "the footprints are on").toBe(true);
  expect(st.ui.modal, "no dialog in the way").toBeNull();
  await expect(talk(page)).toContainText("Pray here");
  await talk(page).click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(page, () => window.KQ.Game.S.sim.prayer.cancelFlow());
});

test("AC-P25.2 the azan card's button is Pray, and the nothing-owed day card says 'Pray a little extra'", async () => {
  await kq(page, () => window.__kq.setMinute(600));
  await goTo(page, "home");
  await page.locator("#kqStatus").click();
  const card = page.getByRole("dialog", { name: "Prayer" });
  await expect(card.getByRole("button", { name: "Pray a little extra" })).toBeVisible();
  await expect(card).not.toContainText(/Sunat|Wudu and pray|Show me the way/);
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(page, () => window.__kq.forcePrayer("zohor"));
  await step(page, 400);
  await expect(
    page.locator("#kqAzan").getByRole("button", { name: "Pray", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a hero held by a sheet (a shop menu) has no Action control", async () => {
  await kq(page, () => window.KQ.Game.S.sim.prayer.cancelFlow());
  await kq(page, () => window.__kq.setMinute(600));
  await goTo(page, "stall_prata");
  await expect(talk(page)).toBeVisible();
  await talk(page).click();
  await expect(page.locator(".kq-sheet")).toBeVisible();
  await step(page, 200);
  await expect(talk(page)).toBeHidden();
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
});

/* ------------------------------ placement on every screen ------------------------------ */

const SCREENS = {
  "phone landscape 844x390": {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  },
  "phone portrait (Pixel 7)": { ...devices["Pixel 7"] },
  "iPad 1180x820": { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true },
};
const NEIGHBOURS = [
  "#kqJoy",
  "#kqJump",
  ".kq-dock",
  "#kqMap",
  "#kqStatus",
  "#kqNeeds",
  ".kq-mission",
];

/** Show three fake actions (the big button plus two tiles) and return each one's box [l, t, w, h]. */
function showTray() {
  const G = window.KQ.Game;
  const fake = (id, label) => ({ kind: "obj", id, label, aria: label, x: 0, z: 0, dist: 1, h: 1 });
  G.Hud.refs.talk.hidden = false;
  G.ActionBar.render(
    [fake("counter_a", "Eat"), fake("home_door", "Rest"), fake("minimart_till", "Buy")].map((t) =>
      Object.assign(t, { enabled: true }),
    ),
  );
  return [...document.querySelectorAll("#kqTalk, .kq-talk-more")].map((b) => {
    const r = b.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height];
  });
}

/** Render fake actions as the world would: { kind, id, label, aria } by id (the first is the big button). */
function renderFake(rows) {
  const G = window.KQ.Game;
  G.Hud.refs.talk.hidden = false;
  G.ActionBar.render(
    rows.map(([kind, id, label, aria]) => ({
      kind,
      id,
      label,
      aria,
      enabled: true,
      x: 0,
      z: 0,
      dist: 1,
      h: 1,
    })),
  );
  return [...document.querySelectorAll("#kqTalk, .kq-talk-more")].map((b) =>
    b.getAttribute("aria-label"),
  );
}

test("a11y: the accessible name starts with the visible word, and a rebuild keeps keyboard focus", async () => {
  const rows = (hiId, secondWord) => [
    ["hi", hiId, "Say hi", "Say hi"],
    ["obj", "counter_a", "Eat", "Order food"],
    ["obj", "minimart_till", secondWord, "Pay at the till"],
  ];
  const names = await kq(page, renderFake, rows("walker:1", "Buy"));
  expect(names).toEqual(["Say hi", "Eat: order food", "Buy: pay at the till"]);
  // the nearest crowd person changes (a new volatile id) while the tile the child focused is untouched
  await kq(page, () => {
    const tile = document.querySelector('.kq-talk-more[data-n="2"]');
    tile.focus();
    tile.dataset.mark = "same-node";
  });
  await kq(page, renderFake, rows("walker:2", "Buy"));
  expect(
    await kq(page, () => document.activeElement && document.activeElement.dataset.mark),
    "the focused tile is the same node, not rebuilt",
  ).toBe("same-node");
  // what is shown does change: the DOM is rebuilt, and focus follows to the tile with the same number
  await kq(page, renderFake, rows("walker:2", "Pay"));
  const focus = await kq(page, () => {
    const a = document.activeElement;
    return a && a.getAttribute("data-n");
  });
  expect(focus, "focus stays on tile 2, never on the page body").toBe("2");
  await kq(page, () => window.KQ.Game.ActionBar.render([]));
  const after = await kq(page, () => document.activeElement && document.activeElement.id);
  expect(after, "when the control goes away, focus moves to the stage").toBe("kqStage");
});

/** Count clicks on chooser tile 2, then press Tab until it has focus; true when it does. */
async function tabToTile(pg) {
  await kq(pg, () => {
    const tile = document.querySelector('.kq-talk-more[data-n="2"]');
    window.__tileClicks = 0;
    tile.addEventListener("click", () => (window.__tileClicks += 1));
    document.getElementById("kqStage").focus();
  });
  for (let i = 0; i < 40; i += 1) {
    await pg.keyboard.press("Tab");
    const on = await kq(pg, () => document.activeElement.matches('.kq-talk-more[data-n="2"]'));
    if (on) return true;
  }
  return false;
}

/** Make room to jump: no sheet, in play, hero on open ground. */
async function readyToJump(pg) {
  await kq(pg, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(pg, () => window.__kq.place(10, 10, 0));
  await step(pg, 2500);
  await kq(pg, () => document.getElementById("kqStage").focus());
}

test("a11y: after a mouse click on a HUD button, Space still jumps and does not press it again", async () => {
  await readyToJump(page);
  const before = (await state(page)).muted;
  await page.locator("#kqMute").click(); // a real mouse click: pointerdown, focus, click
  expect((await state(page)).muted, "the click toggled mute").toBe(!before);
  expect(await kq(page, () => document.activeElement.id)).toBe("kqMute");
  await page.keyboard.press("Space");
  await step(page, 150);
  const after = await state(page);
  expect(after.airborne || after.jumpHeight > 0, "Space jumped").toBe(true);
  expect(after.muted, "and did not press Mute again").toBe(!before);
  await step(page, 1200);
  await page.locator("#kqMute").click(); // restore
  expect((await state(page)).muted).toBe(before);
});

test("a11y: after a mouse click on the Action control (and a dock button), Space jumps", async () => {
  await readyToJump(page);
  await kq(page, renderFake, [
    ["hi", "walker:1", "Say hi", "Say hi"],
    ["obj", "counter_a", "Eat", "Order food"],
  ]);
  await kq(page, () => {
    window.__actionClicks = 0;
    document.getElementById("kqTalk").addEventListener("click", () => (window.__actionClicks += 1));
  });
  await page.locator("#kqTalk").click({ force: true });
  const clicks = await kq(page, () => window.__actionClicks);
  expect(clicks).toBe(1);
  // whatever the click started (a wave, a sheet) ends before Space is pressed
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(page, () => window.KQ.Game.Player.release(window.KQ.Game.S.player));
  await step(page, 2500);
  expect(await kq(page, () => window.KQ.Game.Actions.canJump()), "free to jump again").toBe(true);
  await page.keyboard.press("Space");
  await step(page, 150);
  expect((await state(page)).airborne, "Space jumps after the Action click").toBe(true);
  expect(await kq(page, () => window.__actionClicks), "and does not press Action").toBe(1);
  await step(page, 1200);
  await kq(page, () => window.KQ.Game.ActionBar.render([]));
  // a dock button: open its sheet with a click, close it, then Space
  await page.locator("#kqDock-bag").click();
  // wait for the sheet to really be open before closing it: closing a sheet that has not opened yet
  // leaves it open, and an open sheet blocks the jump, so the press below would test nothing
  await expect.poll(() => kq(page, () => window.KQ.Game.UI.modalOpen())).toBe(true);
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await expect.poll(() => kq(page, () => window.KQ.Game.Actions.canJump())).toBe(true);
  await step(page, 400);
  await page.keyboard.press("Space");
  await step(page, 150);
  expect((await state(page)).airborne, "Space jumps after a dock click").toBe(true);
  await step(page, 1200);
});

test("a11y: Tab to a button, then Space activates it and does not jump", async () => {
  await readyToJump(page);
  await kq(page, renderFake, [
    ["hi", "walker:1", "Say hi", "Say hi"],
    ["obj", "counter_a", "Eat", "Order food"],
  ]);
  expect(await tabToTile(page), "Tab reaches the chooser tile").toBe(true);
  await page.keyboard.press("Space");
  await step(page, 150);
  expect(await kq(page, () => window.__tileClicks), "Space pressed the tile").toBe(1);
  expect((await state(page)).airborne, "and did not jump").toBe(false);
  // a pointer press ends keyboard navigation: Space is Jump again even with the tile focused
  await kq(page, () => window.KQ.Game.UI.closeSheet("test")); // whatever the tile opened
  await kq(page, () => window.KQ.Game.Player.release(window.KQ.Game.S.player));
  await step(page, 2500);
  await kq(page, renderFake, [
    ["hi", "walker:1", "Say hi", "Say hi"],
    ["obj", "counter_a", "Eat", "Order food"],
  ]);
  await page.locator("#kqMute").click();
  await kq(page, () => document.querySelector('.kq-talk-more[data-n="2"]').focus());
  await page.keyboard.press("Space");
  await step(page, 150);
  expect((await state(page)).airborne, "Space jumps after a pointer press").toBe(true);
  await step(page, 1200);
  await page.locator("#kqMute").click(); // restore mute
  await kq(page, () => window.KQ.Game.ActionBar.render([]));
});

test("a11y: Space presses a keyboard-focused HUD button instead of jumping; after a tap it still jumps", async () => {
  await kq(page, () => window.KQ.Game.UI.closeSheet("test"));
  await kq(page, () => window.__kq.place(10, 10, 0));
  await step(page, 2500); // let any wave or ice-cream pose from an earlier test end
  expect(await kq(page, () => window.KQ.Game.Actions.canJump()), "in play, free to jump").toBe(
    true,
  );
  await kq(page, renderFake, [
    ["hi", "walker:1", "Say hi", "Say hi"],
    ["obj", "counter_a", "Eat", "Order food"],
  ]);
  const reached = await tabToTile(page);
  expect(reached, "Tab reaches the chooser tile").toBe(true);
  await page.keyboard.press("Space");
  await step(page, 150);
  expect(await kq(page, () => window.__tileClicks), "Space pressed the tile").toBe(1);
  expect((await state(page)).airborne, "and did not make the hero jump").toBe(false);
  // after a tap (focus without :focus-visible) Space jumps as before
  await kq(page, () => document.getElementById("kqStage").focus());
  await page.keyboard.press("Space");
  await step(page, 150);
  expect((await state(page)).airborne, "Space jumps again with focus on the world").toBe(true);
  await step(page, 1200);
  await kq(page, () => window.KQ.Game.ActionBar.render([]));
});

/** The boxes of the HUD pieces the Action control must keep clear of (those that exist right now). */
async function neighbourBoxes(pg) {
  const out = [];
  for (const sel of [...NEIGHBOURS, ".kq-min-chip"]) {
    const r = await pg
      .locator(sel)
      .first()
      .boundingBox()
      .catch(() => null);
    if (r) out.push([sel, [r.x, r.y, r.width, r.height]]);
  }
  return out;
}

/** With a tray of three tiles and a minimised card chip, the control overlaps nothing else. */
async function checkPlacement(pg) {
  await goTo(pg, "mosque_wudu");
  await kq(pg, () => window.__kq.interact());
  await pg.locator(".kq-minimise").click(); // the tucked-away steps chip
  await step(pg, 300);
  const boxes = await kq(pg, showTray);
  expect(boxes.length).toBe(3);
  const others = await neighbourBoxes(pg);
  expect(others.map((o) => o[0])).toContain(".kq-min-chip");
  for (const [sel, r] of others)
    for (const b of boxes) expect(overlaps(b, r), `${sel} vs a tile`).toBe(false);
  const vp = pg.viewportSize();
  for (const b of boxes) {
    expect(b[0] >= 0 && b[1] >= 0).toBe(true);
    expect(b[0] + b[2] <= vp.width && b[1] + b[3] <= vp.height).toBe(true);
  }
}

for (const [name, opts] of Object.entries(SCREENS)) {
  test(`placement, ${name}: Action control and tray overlap neither the joystick, Jump, dock, radar, cards nor the chip`, async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    await boot(pg);
    await checkPlacement(pg);
    await ctx.close();
  });
}

test("the minimised card's Hide button shows the word on a phone and stays a 48 px target", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({
    ...SCREENS["phone landscape 844x390"],
    deviceScaleFactor: 1,
  });
  const pg = await ctx.newPage();
  await boot(pg);
  await goTo(pg, "mosque_wudu");
  await kq(pg, () => window.__kq.interact());
  const hide = pg.locator(".kq-minimise");
  await expect(hide).toContainText("Hide");
  const box = await hide.boundingBox();
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(47.5);
  await ctx.close();
});

test("the loading screen uses kid words, never 'shaders' or 'textures'", async ({ browser }) => {
  test.setTimeout(240_000);
  const pg = await browser.newPage();
  await pg.addInitScript(() => {
    window.__loadTexts = [];
    new MutationObserver(() => {
      const el = document.getElementById("kqLoadStatus");
      if (el) window.__loadTexts.push(el.textContent);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await pg.goto(GAME);
  await expect.poll(() => kq(pg, () => window.__kq?.loaded), { timeout: 120_000 }).toBe(true);
  const all =
    (await kq(pg, () => window.__loadTexts)).join("|") +
    (await pg.locator("#kqLoadSteps").textContent());
  expect(all).not.toMatch(/shader|texture|figures|instanced/i);
  expect(all).toMatch(/Painting the town/);
  await pg.close();
});
