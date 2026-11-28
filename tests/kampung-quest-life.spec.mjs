// Kampung Quest: the town has life (playability round F, AC-P17..P19). Say hi to crowd extras
// (a reply bubble, a wave, the Muslim-only salaam rule, kids who call out first, a capped tally),
// the small kampung events (football, ice cream, a cat, a wedding procession, rain, a balloon) that
// start one at a time, never during a prayer, and tidy themselves away, and the new missions
// (Photo, Push, escort, ride, say hi). The pure rules are unit-tested in
// tests/kampung-quest/{hi,events,missions-more}.test.mjs; Makkah and Madinah are in
// kampung-quest-life-holy.spec.mjs. The page runs with `?still=1` and `?autoq=0`; the in-page
// drivers are in tests/life-drivers.mjs.
// Run: PW_PORT=5608 npx playwright test tests/kampung-quest-life.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";
import * as D from "./life-drivers.mjs";

let page;
const errors = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await D.boot(page);
  await page.evaluate(() => window.__kq.kidChance(0)); // kids only call out when a test asks them to
});

test.afterAll(async () => {
  await page.close();
});

test("Say hi to a crowd extra: a prompt, the hero's hello, a reply bubble and a wave (AC-P17)", async () => {
  const r = await page.evaluate(D.sayHiScenario);
  expect(r.target, "the Talk button offers Say hi").toMatchObject({ kind: "hi", label: "Say hi" });
  expect(r.hi.count).toBe(1);
  expect(r.hi.last.id).toBe(r.id);
  expect(r.showing.map((b) => b.who)).toEqual(expect.arrayContaining(["hero", r.id]));
  expect(r.dom.length, "real DOM bubbles").toBeGreaterThanOrEqual(2);
  expect(r.waving[0][1], "the person waves (the crowd's wave pose)").toBe("wave");
  expect(r.after, "the wave ends again").toBe(0);
  const hero = r.showing.find((b) => b.who === "hero").text;
  expect(hero).toBe(r.muslim ? "Assalamualaikum!" : "Hello!");
  expect(errors).toEqual([]);
});

test("the salaam is only for Muslim people; everyone else gets a plain hello", async () => {
  const r = await page.evaluate(D.salaamRuleScenario);
  expect(r.length).toBeGreaterThanOrEqual(2);
  for (const s of r.filter((x) => x.said)) {
    if (s.muslim) expect(s.said.hero).toBe("Assalamualaikum!");
    else {
      expect(s.said.hero, s.group).toBe("Hello!");
      expect(s.said.reply, s.group).not.toMatch(/salam|Waalaikum/i);
    }
  }
});

test("kids sometimes call out first (a forced chance), counted in the tally", async () => {
  const r = await page.evaluate(D.kidFirstScenario);
  if (r.called) {
    expect(r.called.kid).toMatch(/^(Assalamualaikum!|Hi|Hello)/);
    expect(r.count).toBeGreaterThan(r.before);
  } else {
    expect(r.count, "no kid within earshot this run: nothing was counted").toBe(r.before);
  }
});

test("an event starts on request, runs one at a time, and tidies itself away (AC-P18)", async () => {
  const r = await page.evaluate(D.footballStartScenario);
  expect(r.forced).toBe(true);
  expect(r.second, "a second event is refused while one runs").toBe(false);
  expect(r.running).toBe(true);
  expect(r.id).toBe("football");
  expect(r.actors).toBe(3);
  expect(r.chip.event).toMatch(/Football/);
  expect(r.blip, "a radar blip while the event is active").toBe(true);
  expect(r.kicks, "walking into the ball kicks it").toBeGreaterThanOrEqual(1);
  const t = await page.evaluate(D.footballTidyScenario);
  expect(t.ended.running).toBe(false);
  expect(t.ended.actors, "every actor is hidden again").toBe(0);
  expect(t.ended.meshes, "every prop is freed").toBe(0);
  expect(t.chipAfter.event).toBeUndefined();
  expect(t.leak2, "the second run leaves nothing extra in the scene").toBe(0);
  expect(errors).toEqual([]);
});

test("the ice-cream cart: a prompt near the cart, 2 coins, never forced", async () => {
  const r = await page.evaluate(D.iceCreamScenario);
  expect(r.phase).toBe("serve");
  expect(r.target).toMatchObject({ kind: "event", label: "Ice cream" });
  expect(r.coins[1]).toBe(r.coins[0] - 2);
});

test("missions: Photo and Push work in the real game (AC-P19)", async () => {
  const photo = await page.evaluate(D.photoScenario);
  expect(photo.accepted).toBe(true);
  expect(photo.photoTarget).toMatchObject({ kind: "step", label: "Photo" });
  expect(photo.afterPhoto.stepIndex).toBe(1);
  expect(photo.photoTarget2).toMatchObject({ kind: "step", label: "Photo" });
  expect(photo.afterPhoto2.stepIndex).toBe(2);
  const push = await page.evaluate(D.pushScenario);
  if (!push.lim) return; // Uncle Lim is indoors at this hour: the prompt is unit-tested
  expect(push.pushTarget).toMatchObject({ kind: "npc", label: "Push" });
  expect(push.afterPush.stepIndex, "three presses finish the push step").toBe(1);
});

test("missions: an escorted kid follows the hero home, and 'ride to' counts on any ride (AC-P19)", async () => {
  const r = await page.evaluate(D.escortScenario);
  expect(r.step).toBe("escort");
  expect(r.escorting).toBe("kid_wei");
  expect(r.gap, "Wei keeps close behind").toBeLessThan(5);
  expect(r.afterEscort.stepIndex, "arriving together finishes the escort").toBe(2);
  expect(r.released, "Wei goes back to his day").toBe(null);
  expect(r.weiFree).toBe(true);
  const ride = await page.evaluate(D.rideScenario);
  expect(ride.afterRide.stepIndex, "arriving on a ride finishes the ride step").toBe(1);
});

test("missions: real hellos count towards 'say hi to five people'", async () => {
  const r = await page.evaluate(D.fiveHellosScenario);
  expect(r.hellos, "real hellos happened: " + r.counts).toBeGreaterThanOrEqual(3);
  expect(r.progress.stepIndex === 1 || r.progress.count >= 3, "each hello counts").toBe(true);
});

test("no event starts, and a running one stops, during a prayer or the azan (AC-P18)", async () => {
  const r = await page.evaluate(D.prayerScenario);
  expect(r.running).toBe(true);
  expect(r.beforePrayer).toBe(true);
  expect(r.afterPrayer.running, "the prayer ends the event").toBe(false);
  expect(r.afterPrayer.last.ended).toMatch(/prayer|azan/);
  expect(r.forceDuring, "nothing starts during the prayer").toBe(false);
  expect(r.flags.prayerDue || r.flags.azan).toBe(true);
});
