// Kampung Quest: the toy figures are clean (features/kampung-quest-playability/figures/audit.md).
//   1. Every hero head style (boy: his cap and every barber / tailor head, the ihram cuts; girl: every
//      hair and hijab style and her ihram hijab), every neighbour, guide and event actor, and every
//      crowd / pilgrim hat fits the head: the head shows through a piece ("poke": the piece sunk under
//      the head surface, i.e. accessory-inside-head) or is left uncovered ("bare") at no more than a
//      few sample points, and no rim floats off the head.
//   2. Nothing goes through the floor in the prayer postures (ruku, sujud, julus) for the hero.
//   3. Speech bubbles never overlap on screen and at most three show at once.
// The geometry checks run on a bare page with three.js + the game's figure scripts and the audit's
// browser helpers (features/kampung-quest-playability/figures/audit-*.js).
// Run: npx playwright test tests/kampung-quest-figures.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";
import {
  auditSources,
  figureScripts,
} from "../features/kampung-quest-playability/figures/audit-lib.mjs";

const LIMIT = 4; // sample points; the audit's own flag threshold

/** A blank page on the test server with the figures and the audit helpers loaded. */
async function figuresPage(page, baseURL) {
  await page.goto("/games/kampung-quest/assets/audio/azan_license.txt");
  const scripts = figureScripts(baseURL.replace(/\/$/, "")).join("");
  await page.setContent(`<!doctype html><html><body>${scripts}</body></html>`, {
    waitUntil: "load",
  });
  for (const content of auditSources()) await page.addScriptTag({ content });
}

/** Browser-side: every hero head piece (both heroes) with its fit numbers. */
function heroHeads() {
  const F = window.KQ.Figures;
  const H = window.KQ.Sim.Hero;
  const heads = [F.CAST.hero.head, F.IHRAM_HEAD.none, F.IHRAM_HEAD.trim, F.IHRAM_HEAD.shave];
  heads.push({ type: "songkok", colour: "#1c1c22", hair: "#3a2416" });
  heads.push({
    type: "cap",
    colour: "#f2b134",
    peak: "#d99a1f",
    badge: "#1d4fc6",
    hair: "#3a2416",
  });
  heads.push({ type: "hair_short", colour: "#2a1c14" }, { type: "hair_quiff", colour: "#3a2416" });
  heads.push({ type: "kopiah", colour: "#fbfaf5", accent: "#2f8f5a" }, H.ihramHead());
  H.STYLES.forEach((s) => heads.push(H.headFor({ gender: "girl", style: s.id, scarf: "rose" })));
  return heads.map((hd) => ({
    type: hd.type,
    ...window.KQAudit.checkPiece(F.headPieceGeometry(hd), "cast", hd.type),
  }));
}

/** Browser-side: every other rig's head piece and every crowd / pilgrim hat. */
function everyoneElse() {
  const F = window.KQ.Figures;
  const A = window.KQAudit;
  const rows = Object.keys(F.CAST)
    .filter((id) => id !== "hero")
    .map((id) => ({
      who: id,
      ...A.checkPiece(F.headPieceGeometry(F.CAST[id].head), "cast", F.CAST[id].head.type),
    }));
  const geo = F.crowdGeometries();
  Object.keys(geo)
    .filter((k) => k.startsWith("hat_"))
    .forEach((k) => rows.push({ who: k, ...A.checkPiece(geo[k], "crowd", k.slice(4)) }));
  return rows;
}

/** Browser-side: samples below the floor for the hero boy and girl in the prayer postures. */
function prayerFloor() {
  const F = window.KQ.Figures;
  const boy = F.build("hero");
  const girl = F.build(Object.assign({}, F.HERO_GIRL, { id: "spec_girl" }));
  const out = [];
  [boy, girl].forEach((g, i) =>
    ["ruku", "sujud", "julus"].forEach((pose) => {
      const r = window.KQAudit.checkRigPose(g, pose);
      out.push({ who: i ? "girl" : "boy", pose, floor: r.floor, parts: r.floorParts.join(" ") });
    }),
  );
  return out;
}

test.describe.configure({ mode: "serial" });

test("every hero head style fits the head: nothing pokes through, nothing floats", async ({
  page,
  baseURL,
}) => {
  await figuresPage(page, baseURL);
  const rows = await page.evaluate(heroHeads);
  expect(rows.length).toBeGreaterThanOrEqual(15);
  for (const r of rows) {
    expect(r.poke, `${r.type}: head showing through the piece`).toBeLessThanOrEqual(LIMIT);
    expect(r.bare, `${r.type}: head left uncovered`).toBeLessThanOrEqual(LIMIT);
    expect(r.floating, `${r.type}: rim floating off the head`).toBe(0);
  }
});

test("every neighbour, guide, event actor and crowd hat fits the head", async ({
  page,
  baseURL,
}) => {
  await figuresPage(page, baseURL);
  const rows = await page.evaluate(everyoneElse);
  expect(rows.length).toBeGreaterThan(40);
  for (const r of rows) {
    expect(r.poke, `${r.who}: head showing through`).toBeLessThanOrEqual(LIMIT);
    expect(r.bare, `${r.who}: head left uncovered`).toBeLessThanOrEqual(LIMIT);
    expect(r.floating, `${r.who}: rim floating`).toBe(0);
  }
});

test("nothing goes through the floor in ruku, sujud and julus", async ({ page, baseURL }) => {
  await figuresPage(page, baseURL);
  const rows = await page.evaluate(prayerFloor);
  for (const r of rows) expect(r.floor, `${r.who} ${r.pose}: ${r.parts}`).toBe(0);
});

/** Browser-side: five bubbles at once over the hero and the nearest neighbours; their screen boxes. */
function crowdedBubbles() {
  const G = window.KQ.Game;
  const k = window.__kq;
  k.setMinute(600);
  k.step(3000); // let the camera settle behind the hero
  const S = G.S;
  const near = Object.keys(S.npcs.byId)
    .map((id) => S.npcs.byId[id])
    .filter((a) => !a.hidden)
    .sort(
      (a, b) =>
        Math.hypot(a.x - S.player.pos.x, a.z - S.player.pos.z) -
        Math.hypot(b.x - S.player.pos.x, b.z - S.player.pos.z),
    );
  const who = ["hero", "hero"].concat(near.slice(0, 3).map((a) => a.id));
  who.forEach((w, i) => G.Greetings.say(w, i % 2 ? "Waalaikumsalam!" : "Assalamualaikum!", 0, 6));
  k.step(400);
  return [...document.querySelectorAll(".kq-greet")]
    .filter((e) => !e.hidden)
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
}

test("speech bubbles never overlap and at most three show at once", async ({ page }) => {
  await page.goto("/games/kampung-quest/index.html?still=1&autoq=0&q=low");
  await expect.poll(() => page.evaluate(() => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => page.evaluate(() => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  const boxes = await page.evaluate(crowdedBubbles);
  expect(boxes.length).toBeGreaterThanOrEqual(2); // the hero's two at least
  expect(boxes.length).toBeLessThanOrEqual(3);
  for (let i = 0; i < boxes.length; i += 1)
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart, `bubbles ${i} and ${j} overlap`).toBe(true);
    }
});
