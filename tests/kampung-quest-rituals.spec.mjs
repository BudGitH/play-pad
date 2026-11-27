// Kampung Quest, Makkah and Madinah (?region=haramain): the one-card-at-a-time steppers.
//   AC-H3 Umrah (ihram, talbiyah, tawaf 7, 2 raka'at, Zamzam, sa'i 7, tahallul), AC-H4 Hajj, AC-H5 Ziarah:
//   Next alone reaches the end; counters; walking is optional (Go there, Walk for me, walking by hand).
//   AC-H8 wudu, prayer and eating as steppers: word by word recitation, the full text scrolls, the hero
//   shows each pose, "Change view" cycles the camera and the hero stays visible beside the panel.
// Run: npx playwright test tests/kampung-quest-rituals.spec.mjs --project=kampung-quest
// One page is shared by every test (the 3D boot is slow); each test resets the rites first.
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low&region=haramain";
test.describe.configure({ mode: "serial", timeout: 240_000 });

let page;
const problems = [];
const ev = (fn, arg) => page.evaluate(fn, arg);
const ritual = () => ev(() => window.__kq.ritual());
const state = () => ev(() => window.__kq.state());
const step = (ms) => ev((t) => window.__kq.step(t), ms);
const next = () => page.locator(".kq-step-next").click();

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text()));
  await page.goto(GAME);
  await expect.poll(() => ev(() => window.__kq?.loaded), { timeout: 150_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => ev(() => window.__kq.ready), { timeout: 60_000 }).toBe(true);
  await step(500);
});

test.afterAll(async () => {
  expect(problems, "no page errors or console errors").toEqual([]);
  await page.close();
});

/** Close any sheet, stop the walkers, put the hero back in normal clothes and forget all rite progress. */
async function reset() {
  await ev(() => {
    const G = window.KQ.Game;
    G.UI.closeSheet("test");
    G.RitualTrek.stop();
    G.RitualLook.cancel();
    G.S.sim.umrah.restore(window.KQ.Sim.Umrah.create().snapshot());
    G.S.sim.umrah.setCut("none");
    G.S.sim.umrah.setIhram(false);
    G.Player.release(G.S.player);
    G.RitualLook.sync();
    window.__kq.setMinute(420); // a rewind rebuilds the prayer tracker: no flow, nothing due
    window.__kq.place(0, -95, 0);
  });
  await step(200);
}

/** Open a rite from the dock like a child would: dock button, then the rite's own button. */
async function openFromDock(rite) {
  await page.locator("#kqDock-rites").click();
  await page.locator(`.kq-rite-btn[data-rite="${rite}"]`).click();
  await expect(
    page.getByRole("dialog", { name: new RegExp(`^${rite} steps$`, "i") }),
  ).toBeVisible();
}

/** Press Next until the rite reaches the given step id (the card must be open). */
async function advanceTo(stepId) {
  for (let i = 0; i < 80 && (await ritual()).step !== stepId; i += 1) await next();
  expect((await ritual()).step).toBe(stepId);
}

/** Press Next until the rite is finished; returns the step ids seen (in order) and the presses. */
async function pressToEnd() {
  const seen = [];
  let presses = 0;
  for (; presses < 120; presses += 1) {
    const r = await ritual();
    if (!r.rite) break;
    if (seen[seen.length - 1] !== r.step) seen.push(r.step);
    await next();
  }
  return { seen, presses };
}

/* ------------------------------ Umrah, Hajj, Ziarah ------------------------------ */

test("Umrah: the dock button opens the rites; Next alone reaches done, in order, in ihram and out of it", async () => {
  await reset();
  await expect(page.locator("#kqDock-rites")).toBeVisible();
  // no cast of neighbours here: no Missions button, and the mission card says how to begin a rite
  await expect(page.locator("#kqDock-missions")).toHaveCount(0);
  await expect(page.getByText("Tap Umrah below to begin: Umrah, Hajj or Ziarah.")).toBeVisible();
  await openFromDock("umrah");
  expect((await ritual()).step).toBe("ihram");
  await expect(page.locator(".kq-step-next")).toBeVisible();
  const box = await page.locator(".kq-step-next").boundingBox();
  expect(box.height, "the Next button is big").toBeGreaterThanOrEqual(48);
  await expect(page.locator(".kq-stepper .kq-step-title")).toHaveText("Ihram and niyyah");
  await expect(page.locator(".kq-stepper .kq-sheet-title")).toHaveText("Umrah · step 1 of 9");
  const { seen, presses } = await pressToEnd();
  expect(seen).toEqual([
    "ihram",
    "talbiyah",
    "enter",
    "tawaf",
    "maqam",
    "zamzam",
    "sai",
    "tahallul",
    "done",
  ]);
  expect(presses, "9 cards + 7 rounds + 2 raka'at + 7 legs").toBe(25);
  const r = await ritual();
  expect(r).toMatchObject({ rite: null, open: false, ihram: false, cut: "trim" });
  expect(await ev(() => window.KQ.Game.S.sim.umrah.view("umrah").done)).toBe(true);
  await expect(page.locator(".kq-toast", { hasText: "Umrah complete" })).toBeVisible();
});

/** What the hero's figure shows: the ihram cloths, the ihram head (short hair) or the cap. */
const look = () =>
  ev(() => {
    const F = window.KQ.Figures;
    const rig = window.KQ.Game.S.player.rig;
    return {
      wrap: Boolean(rig.ihram && rig.ihram.on),
      head: rig.accessory.geometry === F.headPieceGeometry(F.IHRAM_HEAD.none),
      cap: rig.accessory.geometry === F.headPieceGeometry(F.CAST.hero.head),
    };
  });

/** The haircut scene at tahallul: the hero sits, snips, stands up, and the shaved head shows. */
async function shaveAtTheSalon() {
  await page.getByRole("button", { name: "Shave" }).click();
  await step(100);
  expect((await ritual()).cutting).toBe(true);
  const pose = await ev(() => window.KQ.Game.S.player.forcedPose);
  expect(pose, "the hero sits in the barber's chair").toBe("sit");
  await step(3000);
  expect((await ritual()).cutting).toBe(false);
  expect(await ev(() => window.KQ.Game.S.player.locked)).toBe(false);
  expect(await ev(() => window.KQ.Game.S.sim.umrah.cut)).toBe("shave");
  const bald = await ev(() => {
    const F = window.KQ.Figures;
    return (
      window.KQ.Game.S.player.rig.accessory.geometry === F.headPieceGeometry(F.IHRAM_HEAD.shave)
    );
  });
  expect(bald, "the shaved head shows").toBe(true);
}

test("ihram goes on at the miqat step and off after tahallul; the hero's look follows", async () => {
  await reset();
  await openFromDock("umrah");
  expect(await look()).toMatchObject({ wrap: false, cap: true });
  await page.getByRole("button", { name: "Put on ihram" }).click();
  const on = await look();
  expect(on, "two white cloths and sandals, no cap").toMatchObject({
    wrap: true,
    head: true,
    cap: false,
  });
  await expect(page.getByRole("button", { name: "Ihram is on" })).toBeVisible();
  await advanceTo("tahallul");
  expect(await look()).toMatchObject({ wrap: true });
  expect((await ritual()).ihram).toBe(true);
  await shaveAtTheSalon();
  await next(); // leave tahallul
  expect(await look(), "normal clothes are back").toMatchObject({ wrap: false, cap: false });
  expect(await ev(() => window.KQ.Game.S.player.rig.ihram.on)).toBe(false);
  expect((await ritual()).ihram).toBe(false);
});

test("tahallul by Next alone gives the default trim and ends ihram (no choice needed)", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("tahallul");
  await next();
  expect(await ritual()).toMatchObject({ step: "done", ihram: false, cut: "trim" });
});

test("tawaf: the big button counts +1 round up to 7, then becomes Next", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("tawaf");
  await expect(page.locator(".kq-step-count")).toHaveText("Rounds: 0 of 7");
  await expect(page.locator(".kq-step-next")).toHaveText("+1 round");
  for (let n = 1; n <= 7; n += 1) {
    await next();
    await expect(page.locator(".kq-step-count")).toHaveText(`Rounds: ${n} of 7`);
  }
  expect(await ritual()).toMatchObject({ step: "tawaf", count: 7, target: 7 });
  await expect(page.locator(".kq-step-next")).toHaveText("Next");
  await expect(page.locator(".kq-stepper .kq-words")).toContainText("Bismi"); // Bismillah, Allahu akbar
  await next();
  expect((await ritual()).step).toBe("maqam");
  await expect(page.locator(".kq-stepper")).toContainText("Al-Baqarah 2:125");
});

test("tawaf by hand: walking anticlockwise round the Kaaba from the Black Stone is counted, clockwise is not", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("tawaf");
  expect((await ritual()).tracking).toBe("manual");
  const lap = (dir, turns) =>
    ev(
      ({ dir, turns }) => {
        const RW = window.KQ.Sim.RitualWalk;
        const k = window.KQ.HOLY.makkah.kaaba;
        const route = RW.tawafRoute({
          cx: k.x,
          cz: k.z,
          startAngle: RW.blackStoneAngle(k),
          radius: 14,
        });
        for (let u = 0; u <= turns; u += 0.08) {
          const p = route.at(u * dir);
          window.__kq.place(p.x, p.z, p.heading);
        }
      },
      { dir, turns },
    );
  await lap(-1, 1.5); // clockwise: nothing
  expect((await ritual()).count).toBe(0);
  await ev(() => window.__kq.place(0, -95, 0)); // out of the mataf: the walker starts afresh
  await lap(1, 2.1);
  expect((await ritual()).count, "two anticlockwise rounds").toBe(2);
  await expect(page.locator(".kq-step-count")).toHaveText("Rounds: 2 of 7");
});

test("tawaf by Walk for me: the hero circles anticlockwise with the Kaaba on the left and every round is counted", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("tawaf");
  await page.getByRole("button", { name: "Walk for me" }).click();
  expect(await ritual()).toMatchObject({ auto: true, count: 0 });
  await step(200);
  const sample = () =>
    ev(() => {
      const RW = window.KQ.Sim.RitualWalk;
      const P = window.KQ.Game.S.player;
      const k = window.KQ.HOLY.makkah.kaaba;
      const left = { x: Math.cos(P.heading), z: -Math.sin(P.heading) }; // the hero's own left
      const toKaaba = { x: k.x - P.pos.x, z: k.z - P.pos.z };
      return {
        angle: RW.angleOf(k.x, k.z, P.pos.x, P.pos.z),
        kaabaOnLeft: left.x * toKaaba.x + left.z * toKaaba.z > 0,
        pose: P.forcedPose,
        locked: P.locked,
      };
    });
  const a = await sample();
  await step(800);
  const b = await sample();
  expect(b.kaabaOnLeft && a.kaabaOnLeft, "the Kaaba is on the hero's left").toBe(true);
  expect(RW_wrap(b.angle - a.angle), "the angle grows: anticlockwise").toBeGreaterThan(0);
  expect(a).toMatchObject({ pose: "walk", locked: true });
  for (let i = 0; i < 160 && (await ritual()).auto; i += 1) await step(2000);
  expect(await ritual()).toMatchObject({ auto: false, count: 7, step: "tawaf" });
  expect(await ev(() => window.KQ.Game.S.player.locked), "the hero is free again").toBe(false);
  await next();
  expect((await ritual()).step).toBe("maqam");
});

/** Wrap an angle difference to (-PI, PI] (the browser has the same helper; this is the Node side). */
function RW_wrap(a) {
  const t = Math.PI * 2;
  let x = a % t;
  if (x > Math.PI) x -= t;
  if (x <= -Math.PI) x += t;
  return x;
}

test("sa'i starts at Safa and ends at Marwa: 7 legs, brisk only between the green lights", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("sai");
  await expect(page.locator(".kq-step-note, .kq-note").first()).toContainText(
    "Leg 1: Safa to Marwa.",
  );
  await expect(page.locator(".kq-step-count")).toHaveText("Legs: 0 of 7");
  await page.getByRole("button", { name: "Walk for me" }).click();
  await step(100);
  const start = await ev(() => window.KQ.Game.S.player.pos);
  const safa = await ev(() => window.KQ.HOLY.makkah.safa);
  expect(Math.hypot(start.x - safa.x, start.z - safa.z), "the walk starts at Safa").toBeLessThan(3);
  const poses = [];
  for (let i = 0; i < 160 && (await ritual()).auto; i += 1) {
    const s = await ev(() => ({
      z: window.KQ.Game.S.player.pos.z,
      pose: window.KQ.Game.S.player.forcedPose,
    }));
    poses.push(s);
    await step(1500);
  }
  expect(await ritual()).toMatchObject({ auto: false, count: 7 });
  const end = await ev(() => window.KQ.Game.S.player.pos);
  const marwa = await ev(() => window.KQ.HOLY.makkah.marwa);
  expect(Math.hypot(end.x - marwa.x, end.z - marwa.z), "the 7th leg ends at Marwa").toBeLessThan(3);
  const between = poses.filter((p) => Math.abs(p.z) < 6);
  const outside = poses.filter((p) => Math.abs(p.z) > 12);
  expect(between.length).toBeGreaterThan(3);
  expect(
    between.every((p) => p.pose === "run"),
    "brisk between the lights",
  ).toBe(true);
  expect(
    outside.every((p) => p.pose === "walk"),
    "a steady walk elsewhere",
  ).toBe(true);
  await next();
  expect((await ritual()).step).toBe("tahallul");
});

test("sa'i by hand: reaching Marwa from Safa counts leg 1, Safa again leg 2", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("sai");
  const to = (x, z) => ev(({ x, z }) => window.__kq.place(x, z, 0), { x, z });
  await to(42, 39); // Marwa first: not the start
  expect((await ritual()).count).toBe(0);
  await to(42, -39);
  await to(42, 39);
  expect((await ritual()).count).toBe(1);
  await to(42, -39);
  expect((await ritual()).count).toBe(2);
  await expect(page.locator(".kq-step-count")).toHaveText("Legs: 2 of 7");
});

/** Distance from the hero to a KQ.HOLY anchor of Makkah. */
const distTo = (key) =>
  ev((k) => {
    const a = window.KQ.HOLY.makkah[k];
    const p = window.KQ.Game.S.player.pos;
    return Math.hypot(p.x - a.x, p.z - a.z);
  }, key);

test("Go there moves the hero (KQ.Holy.goTo) and the button hides when the region cannot", async () => {
  await reset();
  await openFromDock("umrah");
  await page.getByRole("button", { name: "Go there" }).click(); // the miqat (a short fade first)
  await expect.poll(() => distTo("miqat"), { timeout: 10_000 }).toBeLessThan(8);
  await advanceTo("sai");
  await page.getByRole("button", { name: "Go there" }).click();
  await expect.poll(() => distTo("safa"), { timeout: 10_000 }).toBeLessThan(5);
  await ev(() => {
    window.__goTo = window.KQ.Holy.goTo;
    window.KQ.Holy.goTo = undefined;
  });
  await next(); // a redraw
  await expect(page.getByRole("button", { name: "Go there" })).toHaveCount(0);
  await ev(() => (window.KQ.Holy.goTo = window.__goTo));
});

test("I'll walk myself: the card folds into a chip, the mission card shows the step, and it reopens when the count is full", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("sai");
  await page.getByRole("button", { name: "I'll walk myself" }).click();
  await expect(page.getByRole("dialog", { name: "Umrah steps" })).toHaveCount(0);
  await step(300);
  await expect(page.locator(".kq-ritual-chip")).toContainText("Umrah: Sa'i: 7 legs (0 of 7)");
  await expect(page.locator(".kq-ritual-line")).toContainText("Umrah: Sa'i: 7 legs");
  const to = (z) => ev((z) => window.__kq.place(42, z, 0), z);
  await to(-39);
  for (let i = 0; i < 7; i += 1) {
    await to(i % 2 === 0 ? 39 : -39);
  }
  await expect(page.getByRole("dialog", { name: "Umrah steps" })).toBeVisible();
  expect(await ritual()).toMatchObject({ count: 7, open: true });
  await expect(page.locator(".kq-ritual-chip")).toHaveCount(0);
});

test("Hajj highlights and Ziarah reach done by Next alone", async () => {
  await reset();
  await openFromDock("hajj");
  const hajj = await pressToEnd();
  expect(hajj.seen).toEqual([
    "h_ihram",
    "h_mina",
    "h_arafah",
    "h_muzdalifah",
    "h_aqabah",
    "h_qurban",
    "h_hair",
    "h_ifadah",
    "h_sai",
    "h_tashriq",
    "h_wada",
    "h_done",
  ]);
  expect(hajj.presses).toBe(12 + 7 + 7 + 3 + 7 + 7 + 7);
  expect((await ritual()).ihram, "ihram ends at the haircut").toBe(false);
  await openFromDock("ziarah");
  const ziarah = await pressToEnd();
  expect(ziarah.seen).toEqual(["z_salam", "z_rawdah", "z_quba", "z_uhud", "z_baqi", "z_done"]);
  expect(ziarah.presses).toBe(6 + 2 + 2);
});

test("the rites survive a save: the saved section round-trips and a hostile one is clamped", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("tawaf");
  await next();
  await next();
  const out = await ev(() => {
    const S = window.KQ.Game.S;
    const Save = window.KQ.Sim.Save;
    const saved = Save.capture(S.sim);
    const clean = Save.sanitize(JSON.parse(JSON.stringify(saved)));
    return { saved: saved.rituals, clean: clean.rituals };
  });
  expect(out.clean).toEqual(out.saved);
  expect(out.saved).toMatchObject({ last: "umrah", ihram: true });
  expect(out.saved.idx.umrah).toBe(3);
  expect(out.saved.count.umrah).toBe(2);
});

/* ------------------------------ word by word and the full text ------------------------------ */

test("recitation is shown word by word: Next word, tap a word, back, and Auto advance the highlight", async () => {
  await reset();
  await openFromDock("umrah");
  const now = () => page.locator(".kq-word.is-now").getAttribute("data-i");
  await expect(page.locator(".kq-word").first()).toBeVisible();
  expect(
    await page.locator(".kq-w-ar[lang=ar][dir=rtl]").count(),
    "Arabic is right to left",
  ).toBeGreaterThan(5);
  expect(await now()).toBe("0");
  await expect(page.locator(".kq-word.is-now .kq-w-tr")).toHaveText("Nawaytu");
  await page.getByRole("button", { name: "Next word" }).click();
  expect(await now()).toBe("1");
  await expect(page.locator(".kq-word.is-said")).toHaveCount(1);
  await page.locator('.kq-word[data-i="4"]').click();
  expect(await now()).toBe("4");
  await page.getByRole("button", { name: "Previous word" }).click();
  expect(await now()).toBe("3");
  await page.getByRole("button", { name: "Next word" }).click();
  await page.getByRole("button", { name: "Next word" }).click();
  await page.getByRole("button", { name: "Next word" }).click();
  await expect(page.locator(".kq-meaning"), "the meaning follows the line").toContainText(
    "Here I am, O Allah, for Umrah",
  );
  await page.locator('.kq-word[data-i="0"]').click();
  await page.getByRole("button", { name: "Auto" }).click();
  await expect(page.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  await step(2600);
  expect(Number(await now()), "auto-advance moved on by itself").toBeGreaterThanOrEqual(2);
  await next();
  await expect(
    page.locator(".kq-word.is-now"),
    "a new card starts at its first word",
  ).toHaveAttribute("data-i", "0");
});

test("the full surah is one tap away and scrolls: Al-Fatihah on the Rawdah card, the short surahs by chip", async () => {
  await reset();
  await openFromDock("ziarah");
  await advanceTo("z_rawdah");
  await expect(page.locator(".kq-full")).toBeHidden();
  await page.getByRole("button", { name: "Show full text" }).click();
  const panel = page.locator(".kq-full");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".kq-full-line")).toHaveCount(7);
  const m = await panel.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  expect(m.sh, "it is taller than its box, so it scrolls").toBeGreaterThan(m.ch);
  await panel.evaluate((el) => (el.scrollTop = 120));
  expect(await panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(40);
  await expect(panel).toContainText("Alhamdu lillahi rabbi");
  await page.getByRole("button", { name: "Al-Ikhlas" }).click();
  await expect(page.locator(".kq-word")).toHaveCount(15);
  await expect(page.locator(".kq-full-line")).toHaveCount(4);
  for (const surah of ["Al-Kawthar", "Al-Kafirun", "Al-Falaq", "An-Nas"]) {
    await expect(page.getByRole("button", { name: surah })).toBeVisible();
  }
});

/* ------------------------------ wudu and prayer ------------------------------ */

const WUDU_CARDS = [
  "Make your intention (niat)",
  "Wash both hands",
  "Rinse your mouth",
  "Sniff water into your nose",
  "Wash your face",
  "Wash your right arm to the elbow",
  "Wash your left arm to the elbow",
  "Wipe your head",
  "Wipe your ears",
  "Wash your right foot to the ankle",
  "Wash your left foot to the ankle",
  "Say the doa after wudu",
];
const WUDU_POSES = [
  "idle",
  "wudu_hands",
  "wudu_mouth",
  "wudu_nose",
  "wudu_face",
  "wudu_hands",
  "wudu_hands",
  "wudu_head",
  "wudu_ears",
  "wudu_feet",
  "wudu_feet",
  "doa",
];

/** Press the wudu Next button until the wudu is done, noting each card's title, the hero's pose and the view. */
async function takeWuduByNext() {
  const out = { cards: [], poses: [], views: [], presses: 0 };
  while ((await state()).prayer.flow?.phase === "wudu" && out.presses < 60) {
    const title = await page.locator(".kq-stepper .kq-step-title").textContent();
    if (out.cards[out.cards.length - 1] !== title) {
      out.cards.push(title);
      out.poses.push(await ev(() => window.KQ.Game.S.player.forcedPose));
      out.views.push((await state()).ui.view);
    }
    await page.locator(".kq-wudu-act").click();
    out.presses += 1;
  }
  return out;
}

/** Press Next on every prayer card; the hero must show each card's posture. Returns the posture types. */
async function prayByNext() {
  const seen = [];
  while ((await state()).prayer.flow?.phase === "pray" && seen.length < 60) {
    const want = await ev(() => window.KQ.Game.S.sim.prayer.nextPrayStep());
    const pose = await ev(() => window.KQ.Game.S.player.forcedPose);
    expect(pose, "the hero shows the posture the card is about").toBe(want.pose);
    seen.push(want.type);
    await next();
  }
  return seen;
}

test("wudu and Subuh complete by Next alone, right where the hero stands, with the right poses", async () => {
  await reset();
  await ev(() => window.__kq.forcePrayer("subuh"));
  await step(300);
  const before = await state();
  await page.evaluate(() => window.__kq.action("pray"));
  await page.locator(".kq-pray-here").click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  await expect(page.locator(".kq-stepper .kq-sheet-title")).toHaveText(
    "Wudu at the mosque taps · step 1 of 12",
  );
  await expect(page.locator(".kq-stepbar .kq-sp")).toHaveCount(12);
  const wudu = await takeWuduByNext();
  expect(wudu.presses, "12 steps, with 3 taps for each wash").toBe(28);
  expect(wudu.cards).toEqual(WUDU_CARDS);
  expect(wudu.poses).toEqual(WUDU_POSES);
  expect(wudu.views.every((v) => ["close", "side", "behind"].includes(v))).toBe(true);
  // started "right here": the prayer steps open at once, in the same place
  await expect(page.getByRole("dialog", { name: "Prayer steps" })).toBeVisible();
  const pos = (await state()).pos;
  const walked = Math.hypot(pos.x - before.pos.x, pos.z - before.pos.z);
  expect(walked, "the hero did not walk anywhere").toBeLessThan(0.5);
  const seen = await prayByNext();
  expect(seen, "Subuh: takbir + 2 x 6 postures + qunut + tasyahud + 2 salam").toHaveLength(17);
  expect(seen[0]).toBe("takbir");
  expect(seen.filter((t) => t === "qunut")).toHaveLength(1);
  const card = page.getByRole("dialog", { name: /You prayed Subuh/ });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Alhamdulillah" }).click();
  const after = await state();
  expect(after.prayer.prayers.find((p) => p.name === "subuh").status).toBe("done");
  expect(after.prayer.flow).toBeNull();
  expect(after.coins, "praying pays no coins").toBe(before.coins);
  expect(await ev(() => window.KQ.Game.S.player.locked)).toBe(false);
  await step(3500);
  expect(await ev(() => window.KQ.Game.Camera.state.frame), "the normal camera is back").toBeNull();
});

/** Where the camera is and where the hero shows on screen, against the side panel. */
const cam = () =>
  ev(() => {
    const C = window.KQ.Game.Camera.state;
    const S = window.KQ.Game.S;
    const v = S.player.pos.clone().project(S.camera);
    const panel = document.querySelector(".kq-sheet-box").getBoundingClientRect();
    return {
      view: window.__kq.state().ui.view,
      yaw: C.yaw,
      dist: C.dist,
      hx: ((v.x + 1) / 2) * window.innerWidth,
      panelLeft: panel.left,
    };
  });

/** Press Change view twice: each press eases to a new angle (not there after 0.1 s) with the hero clear of the panel. */
async function cycleTwice(first) {
  const names = [first.view];
  const yaws = [first.yaw];
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole("button", { name: "Change view" }).click();
    await step(100);
    const mid = await cam();
    await step(2600);
    const b = await cam();
    names.push(b.view);
    yaws.push(b.yaw);
    const early = Math.abs(RW_wrap(mid.yaw - yaws[i]));
    const total = Math.abs(RW_wrap(b.yaw - yaws[i]));
    expect(early, "it eases: not there yet after 0.1 s").toBeLessThan(total + 0.0001);
    expect(b.hx, "the hero is left of the side panel").toBeLessThan(b.panelLeft);
  }
  return { names, yaws };
}

/** Take the first postures of Zohor and note the opening view of each. */
async function postureViews() {
  await ev(() => {
    const G = window.KQ.Game;
    G.UI.closeSheet("test");
    G.S.sim.prayer.cancelFlow();
    G.S.sim.prayer.startFlow("zohor");
    window.KQ.Sim.Prayer.WUDU_STEPS.forEach((w) => G.S.sim.prayer.wuduStep(w.id));
    G.PrayerFlow.startHere();
  });
  const views = {};
  for (let i = 0; i < 6; i += 1) {
    const type = await ev(() => window.KQ.Game.S.sim.prayer.nextPrayStep().type);
    views[type] = (await state()).ui.view;
    await next();
  }
  return views;
}

test("Change view cycles the camera through three angles with smooth transitions; the hero stays clear of the panel", async () => {
  await reset();
  await ev(() => window.__kq.forcePrayer("zohor"));
  await step(300);
  await page.evaluate(() => window.__kq.action("pray"));
  await page.locator(".kq-pray-here").click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  await step(2600);
  const a = await cam();
  expect(a.view).toBe("close");
  expect(a.dist, "a close-up").toBeLessThan(1.8);
  expect(a.hx, "the hero is left of the side panel").toBeLessThan(a.panelLeft);
  const { names, yaws } = await cycleTwice(a);
  expect(names).toEqual(["close", "side", "behind"]);
  expect(new Set(yaws.map((y) => RW_wrap(y).toFixed(1))).size, "three different angles").toBe(3);
  await page.getByRole("button", { name: "Change view" }).click();
  expect((await state()).ui.view, "the fourth press comes round to the first").toBe("close");
  // each prayer posture has its own best angle: front for qiyam, side for ruku and sujud
  const views = await postureViews();
  expect(views).toMatchObject({
    takbir: "front",
    qiyam: "front",
    ruku: "side",
    itidal: "front",
    sujud: "side",
  });
});

test("the prayer card reads word by word, with the full Al-Fatihah and the short surahs", async () => {
  await reset();
  await ev(() => {
    window.__kq.forcePrayer("asar");
    window.__kq.place(0, -95, 0);
  });
  await page.evaluate(() => window.__kq.action("pray"));
  await page.locator(".kq-pray-here").click();
  while ((await state()).prayer.flow?.phase === "wudu") await page.locator(".kq-wudu-act").click();
  await next(); // takbir -> qiyam
  await expect(page.locator(".kq-stepper .kq-step-title")).toHaveText("Qiyam (stand)");
  await expect(page.locator(".kq-stepper .kq-sheet-title")).toHaveText("Asar · raka'at 1 of 4");
  expect(await page.locator(".kq-word").count(), "Al-Fatihah has 29 words").toBe(29);
  await page.getByRole("button", { name: "Show full text" }).click();
  await expect(page.locator(".kq-full-line")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Al-Ikhlas" })).toBeVisible();
  await ev(() => window.KQ.Game.UI.closeSheet("test"));
  await ev(() => window.KQ.Game.S.sim.prayer.cancelFlow());
});

/* ------------------------------ eating ------------------------------ */

test("eating is a stepper: wash hands, Bismillah, bites with the right hand, Alhamdulillah", async () => {
  await reset();
  await ev(() => window.KQ.Game.S.sim.needs.restore({ hunger: 30, energy: 80 }));
  await ev(() => window.KQ.Game.Services.stall("counter_nasi_lemak"));
  const before = await state();
  await page.locator(".kq-tile").first().click();
  const dialog = page.getByRole("dialog", { name: "Eating steps" });
  await expect(dialog).toBeVisible();
  expect((await state()).hunger, "the food is eaten when bought").toBeGreaterThan(before.hunger);
  const titles = [];
  const poses = [];
  let presses = 0;
  while ((await state()).ui.eating && presses < 20) {
    const t = await page.locator(".kq-stepper .kq-step-title").textContent();
    if (titles[titles.length - 1] !== t) {
      titles.push(t);
      poses.push(await ev(() => window.KQ.Game.S.player.forcedPose));
    }
    await page.locator(".kq-eat-next").click();
    presses += 1;
  }
  expect(titles).toEqual([
    "Wash your hands",
    "Say Bismillah",
    "Eat with your right hand",
    "Say Alhamdulillah",
  ]);
  expect(poses).toEqual(["wudu_hands", "doa", "eat", "doa"]);
  expect(presses, "4 cards + 3 bites").toBe(7);
  await expect(page.getByRole("dialog", { name: "Eating steps" })).toHaveCount(0);
  expect(await ev(() => window.KQ.Game.S.player.locked), "the hero is free again").toBe(false);
});

test("the eating card reads the Bismillah and the dua after eating word by word", async () => {
  await reset();
  await ev(() => {
    window.KQ.Game.S.sim.needs.restore({ hunger: 30, energy: 80 });
    window.KQ.Game.S.sim.economy.setCoins(10);
  });
  await ev(() => window.KQ.Game.Services.stall("counter_nasi_lemak"));
  await page.locator(".kq-tile").first().click();
  await page.locator(".kq-eat-next").click(); // wash -> Bismillah
  await expect(page.locator(".kq-word.is-now .kq-w-tr")).toHaveText("Bismi");
  await expect(page.locator(".kq-meaning")).toContainText("In the name of Allah");
  await page.getByRole("button", { name: "If you forgot Bismillah" }).click();
  await expect(page.locator(".kq-word")).toHaveCount(4);
  for (let i = 0; i < 5; i += 1) await page.locator(".kq-eat-next").click();
  await expect(page.locator(".kq-stepper .kq-step-title")).toHaveText("Say Alhamdulillah");
  await expect(page.locator(".kq-word")).toHaveCount(7);
  await page.locator(".kq-eat-next").click();
  await expect(page.getByRole("dialog", { name: "Eating steps" })).toHaveCount(0);
});
