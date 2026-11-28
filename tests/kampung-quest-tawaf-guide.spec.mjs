// Kampung Quest, Makkah: the tawaf and sa'i ground guide and the calmer pace.
//   Owner feedback: "The tawaf is too fast ... show the user guidance: dotted lines when the task is active."
//   - the dotted guide (ring of dots, gold start line, glowing dots + arrow ahead) shows only while the
//     tawaf / sa'i step is active, follows the hero, and is removed when the step ends
//   - "Walk for me" is a calm stroll: a round takes about half a minute of game time, not a dozen seconds
//   - a gentle hint line says what to do next (and "Other way, please" when walking clockwise)
// Run: npx playwright test tests/kampung-quest-tawaf-guide.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low&region=haramain";
test.describe.configure({ mode: "serial", timeout: 240_000 });

let page;
const problems = [];
const ev = (fn, arg) => page.evaluate(fn, arg);
const ritual = () => ev(() => window.__kq.ritual());
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

/** Close any sheet, stop the walkers and forget all rite progress. */
async function reset() {
  await ev(() => {
    const G = window.KQ.Game;
    if (G.RitualUI.active) G.RitualUI.active.close("test"); // a minimised card has no sheet to close
    G.UI.closeSheet("test");
    G.RitualTrek.stop();
    G.RitualLook.cancel();
    G.S.sim.umrah.restore(window.KQ.Sim.Umrah.create().snapshot());
    G.Player.release(G.S.player);
    window.__kq.setMinute(420);
    window.__kq.place(0, -95, 0);
  });
  await step(200);
}

async function openFromDock(rite) {
  await page.locator("#kqDock-rites").click();
  await page.locator(`.kq-rite-btn[data-rite="${rite}"]`).click();
  await expect(
    page.getByRole("dialog", { name: new RegExp(`^${rite} steps$`, "i") }),
  ).toBeVisible();
}

async function advanceTo(stepId) {
  for (let i = 0; i < 80 && (await ritual()).step !== stepId; i += 1) await next();
  expect((await ritual()).step).toBe(stepId);
}

/** Put the hero on the tawaf circle at `turns` laps from the Black Stone line (anticlockwise > 0). */
const onCircle = (turns, radius = 14) =>
  ev(
    ({ turns, radius }) => {
      const RW = window.KQ.Sim.RitualWalk;
      const k = window.KQ.HOLY.makkah.kaaba;
      const route = RW.tawafRoute({ cx: k.x, cz: k.z, startAngle: RW.blackStoneAngle(k), radius });
      const p = route.at(turns);
      window.__kq.place(p.x, p.z, p.heading);
    },
    { turns, radius },
  );

test("the dotted guide appears while the tawaf step is active and is gone on other steps", async () => {
  await reset();
  await openFromDock("umrah");
  expect((await ritual()).guide.visible, "no guide before the tawaf").toBe(false);
  await advanceTo("tawaf");
  const g = (await ritual()).guide;
  expect(g).toMatchObject({ visible: true, kind: "tawaf", inScene: true });
  expect(g.dots, "a ring of dots").toBeGreaterThan(30);
  expect(g.lines, "the gold start line").toBe(1);
  expect(g.meshes, "a handful of draw calls: dots, line, arrow").toBeLessThanOrEqual(4);
  await next(); // +1 round, still tawaf
  expect((await ritual()).guide.visible).toBe(true);
  for (let i = 0; i < 6; i += 1) await next();
  await next(); // full: on to the Maqam
  expect((await ritual()).step).toBe("maqam");
  expect((await ritual()).guide, "removed after the step").toMatchObject({
    visible: false,
    inScene: false,
    dots: 0,
  });
});

test("the guide follows the hero: the dots ahead glow, the arrow leads anticlockwise, and it survives closing the card", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("tawaf");
  await onCircle(0.0);
  await step(300);
  const a = (await ritual()).guide;
  expect(a.lit.length).toBeGreaterThan(1);
  expect(a.arrow).not.toBeNull();
  await onCircle(0.25);
  await step(300);
  const b = (await ritual()).guide;
  expect(b.lit, "the glow moved on with the hero").not.toEqual(a.lit);
  const angle = (p) => ev((p) => window.KQ.Sim.RitualWalk.angleOf(0, 0, p.x, p.z), p);
  const ahead = await angle(b.arrow);
  const hero = await ev(() => window.KQ.Game.S.player.pos);
  const here = await angle({ x: hero.x, z: hero.z });
  const diff = Math.atan2(Math.sin(ahead - here), Math.cos(ahead - here));
  expect(diff, "the arrow is a little ahead, anticlockwise").toBeGreaterThan(0);
  expect(diff).toBeLessThan(1.2);
  await page.getByRole("button", { name: "I'll walk myself" }).click();
  await step(200);
  expect((await ritual()).guide.visible, "the guide stays up while you walk by hand").toBe(true);
  await expect(page.locator(".kq-min-chip")).toContainText("Tawaf 0/7");
  await expect(page.locator(".kq-min-chip")).toContainText("Kaaba on your left");
});

test("the hint is gentle: start line first, then keep the Kaaba on the left, 'Other way, please' for clockwise", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("tawaf");
  await step(200);
  await expect(page.locator(".kq-note")).toContainText("gold line");
  await onCircle(0.0);
  await step(200);
  await onCircle(0.3);
  await step(200);
  await expect(page.locator(".kq-note")).toContainText("Kaaba on your");
  await onCircle(0.2);
  await step(200);
  await onCircle(0.1);
  await step(200);
  await expect(page.locator(".kq-note")).toContainText("Other way, please");
  expect((await ritual()).hint).not.toMatch(/wrong|fail|mistake/i);
});

test("Walk for me is calm: about half a minute a round, the guide stays up and goes when done", async () => {
  // ~3.6 min of game time at the calm pace: slow 2-core CI runners need more than the file default.
  test.setTimeout(600_000);
  await reset();
  await openFromDock("umrah");
  await advanceTo("tawaf");
  await page.getByRole("button", { name: "Walk for me" }).click();
  expect(await ritual()).toMatchObject({ auto: true, count: 0 });
  await step(200);
  const p0 = await ev(() => ({ ...window.KQ.Game.S.player.pos }));
  await step(5000);
  const p1 = await ev(() => ({ ...window.KQ.Game.S.player.pos }));
  const speed = Math.hypot(p1.x - p0.x, p1.z - p0.z) / 5;
  expect(speed, "a stroll, not a run").toBeLessThan(3.4);
  expect(speed).toBeGreaterThan(1.5);
  expect((await ritual()).guide.visible).toBe(true);
  expect((await ritual()).hint).toContain("Walking for you");
  await step(15_000); // 20 s in: still on round one
  expect((await ritual()).count, "a round is not over in 20 s").toBe(0);
  await step(16_000); // 36 s in: round one done
  expect((await ritual()).count).toBe(1);
  for (let i = 0; i < 160 && (await ritual()).auto; i += 1) await step(2000);
  expect(await ritual()).toMatchObject({ auto: false, count: 7 });
  expect((await ritual()).guide.visible, "the guide stays until the step is done").toBe(true);
  await next();
  expect((await ritual()).guide.visible).toBe(false);
});

test("sa'i shows a dotted lane with a line at each hill, only while that step is active", async () => {
  await reset();
  await openFromDock("umrah");
  await advanceTo("sai");
  const g = (await ritual()).guide;
  expect(g).toMatchObject({ visible: true, kind: "sai", lines: 2 });
  await expect(page.locator(".kq-note")).toContainText("Walk to Safa");
  const safa = await ev(() => window.KQ.HOLY.makkah.safa);
  await ev((s) => window.__kq.place(s.x, s.z + 3, 0), safa);
  await step(300);
  const a = (await ritual()).guide;
  expect(a.arrow, "the arrow leads toward Marwa (south, +z)").not.toBeNull();
  expect(a.arrow.z).toBeGreaterThan(safa.z + 3);
  await expect(page.locator(".kq-note")).toContainText("Follow the dots to Marwa");
  await next();
  while ((await ritual()).step === "sai") await next();
  expect((await ritual()).guide.visible).toBe(false);
});
