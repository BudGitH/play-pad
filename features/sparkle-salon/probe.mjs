// probe.mjs — headless acceptance probe for Sparkle Salon (dev-only; not part of `npm run smoke`).
//
// Drives the real page like a player (mouse strokes, taps, keyboard, reloads) and prints one
// PASS/FAIL line per acceptance criterion in features/sparkle-salon/requirements.md.
// Exit code 1 if anything fails. Screenshots go to a temp folder (printed at the end) so a run never dirties
// the repo; set SHOTS=1 to write them to features/sparkle-salon/screens/ instead.
//
//   node features/sparkle-salon/probe.mjs          # starts tools/serve.mjs on :5601 itself if needed
//   SHOTS=1 node features/sparkle-salon/probe.mjs  # also (re)write features/sparkle-salon/screens/
//   BASE_URL=http://localhost:5599 node features/sparkle-salon/probe.mjs
//   PW_CHROMIUM_PATH=/path/to/chrome node features/sparkle-salon/probe.mjs   # optional
//
// Nothing here uses a fixed sleep to decide an outcome: state is polled through window.__salon.
//
/* eslint-disable max-lines-per-function -- a probe is a long linear script of checks; splitting it per line adds no clarity */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const SHOTS = process.env.SHOTS
  ? resolve(HERE, "screens")
  : resolve(tmpdir(), "sparkle-salon-probe-shots");
const PORT = Number(process.env.PORT || 5601);
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const URL = `${BASE}/games/sparkle-salon/`;
const SAVE_KEY = "playpad.sparkleSalon.v1";
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, name, ok, detail = "") {
  results.push({ id, name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}${detail ? "  — " + detail : ""}`);
}

/** Start the repo's static server unless one already answers on BASE. */
async function ensureServer() {
  try {
    await fetch(BASE + "/");
    return null;
  } catch {
    const child = spawn(process.execPath, ["tools/serve.mjs", String(PORT)], {
      cwd: ROOT,
      stdio: "ignore",
    });
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(BASE + "/");
        return child;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error("static server did not start");
  }
}

async function open(
  browser,
  { viewport = { width: 390, height: 844 }, url = URL, touch = false, reduced = false, init } = {},
) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: touch,
    hasTouch: touch,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text());
  });
  page.on("requestfailed", (r) => {
    if (!/ERR_ABORTED/.test(r.failure()?.errorText || "")) errors.push("requestfailed: " + r.url());
  });
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(url);
  await page.waitForFunction(() => window.__salon && typeof window.__salon.phase === "string");
  return { ctx, page, errors, requests };
}

const S = (page, fn, arg) => page.evaluate(fn, arg);
const startBtn = (page) => page.getByRole("button", { name: "Start makeover", exact: true });
async function begin(page) {
  await startBtn(page).click();
  await page.waitForFunction(() => window.__salon.phase === "playing");
  await page.getByRole("button", { name: "Let's glam!" }).click();
  await page
    .locator("#reqModal.open")
    .waitFor({ state: "detached" })
    .catch(() => {});
  await page.waitForFunction(() => !document.querySelector("#reqModal.open"));
}
const shot = (page, name) =>
  page.screenshot({ path: resolve(SHOTS, name + ".jpg"), type: "jpeg", quality: 82 });
const progress = (page) => S(page, () => window.__salon.progress);

/** Rub the brush back and forth over the current step's region until it completes (or the passes run out). */
async function scrub(page, { passes = 8, points = 16, samples } = {}) {
  for (let k = 0; k < passes; k++) {
    await scrubPass(page, points, k === 0, samples);
    if (await S(page, () => window.__salon.done[window.__salon.step])) break;
  }
  await page.mouse.up();
}
async function scrubPass(page, points, first, samples) {
  for (let i = 0; i <= points; i++) {
    const p = await S(page, (f) => window.__salon.debug.regionPoint(f), i / points);
    if (first && i === 0) {
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
    }
    await page.mouse.move(p.x, p.y, { steps: 2 });
    if (samples && i % 4 === 0) samples.push(await progress(page));
  }
}
async function wipeSmudges(page) {
  // the smudge positions come from the page itself (data-x / data-y on each .smudge group)
  const spots = await S(page, () =>
    [...document.querySelectorAll(".smudge")].map((e) => [
      Number(e.dataset.x),
      Number(e.dataset.y),
    ]),
  );
  for (let k = 0; k < 4; k++) {
    for (const [i, [x, y]] of spots.entries()) {
      const c = await S(page, ([x, y]) => window.__salon.debug.unitsToClient(x, y), [x, y]);
      if (k === 0 && i === 0) {
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
      }
      await page.mouse.move(c.x + 8, c.y + 8, { steps: 3 });
    }
    if (await S(page, () => window.__salon.done[0])) break;
  }
  await page.mouse.up();
}
const nextBtn = (page) => page.locator("#nextBtn");
async function goNext(page) {
  const before = await S(page, () => window.__salon.step);
  await nextBtn(page).click();
  if (before < 7) await page.waitForFunction((b) => window.__salon.step === b + 1, before);
}
/** The tray button the client asked for (it carries the heart badge). */
const wantedTool = (page) => page.locator("#tools button.tool:has(.want)");

// ================================================================== QA-panel regression checks (SS-*)
/** Reach a step quickly with the debug helpers (complete + next until `id`). */
async function playTo(page, id) {
  for (let i = 0; i < 8 && (await S(page, () => window.__salon.stepId)) !== id; i++) {
    await S(page, () => window.__salon.debug.completeStep());
    await S(page, () => window.__salon.debug.nextStep());
  }
}
const focusInfo = (page) =>
  S(page, () => {
    const a = document.activeElement;
    return {
      tag: a.tagName,
      inTools: !!a.closest("#tools"),
      inTabs: !!a.closest("#subtabs"),
      opt: a.dataset.opt || null,
      slot: a.dataset.slot || null,
    };
  });
const withCoins = (coins) =>
  `localStorage.setItem("${SAVE_KEY}", ${JSON.stringify(JSON.stringify({ v: 1, rev: 1, coins, unlocked: [], sound: true, looks: [], bestOverall: 0 }))})`;

/** SS-C01: a keyboard user's focus must survive every tray rebuild (pick, subtab, unlock). */
async function checkFocusKept(browser) {
  const k = await open(browser, { init: withCoins(300) });
  await begin(k.page);
  await playTo(k.page, "shadow");
  await k.page.locator("#tools button.tool").nth(1).focus();
  await k.page.keyboard.press("Enter");
  const pick = await focusInfo(k.page);
  const said = await k.page
    .waitForFunction(() => /selected/.test(document.getElementById("sr").textContent), null, {
      timeout: 3000,
    })
    .then(
      () => true,
      () => false,
    );
  await k.page.getByRole("button", { name: /Eye shadow: Mint, locked/ }).focus();
  await k.page.keyboard.press("Enter");
  await k.page.keyboard.press("Enter"); // the Unlock button has focus inside the sheet
  await k.page.waitForFunction(() => !document.querySelector("#unlockModal.open"));
  const unlock = await focusInfo(k.page);
  await playTo(k.page, "acc");
  await k.page.getByRole("button", { name: "Earrings", exact: true }).focus();
  await k.page.keyboard.press("Enter");
  const tab = await focusInfo(k.page);
  check(
    "SS-C01",
    "keyboard focus stays on the same option / tab after a pick, an unlock and an accessory tab (and the pick is announced)",
    pick.inTools &&
      pick.opt &&
      unlock.inTools &&
      unlock.opt === "mint" &&
      tab.inTabs &&
      tab.slot === "earring" &&
      said,
    JSON.stringify({ pick, unlock, tab, said }),
  );
  await k.ctx.close();
}

/** SS-C02 + SS-C11: the face is a tab stop only while playing; one live region; done/skipped dots carry a glyph. */
async function checkStageAndDots(browser) {
  const k = await open(browser);
  const stage = () =>
    S(k.page, () => {
      const e = document.getElementById("stage");
      return {
        tab: e.getAttribute("tabindex"),
        role: e.getAttribute("role"),
        hidden: e.getAttribute("aria-hidden"),
      };
    });
  const title = await stage();
  await begin(k.page);
  const playing = await stage();
  await S(k.page, () => window.__salon.debug.completeStep());
  await goNext(k.page); // step 0 done, now on step 1
  await goNext(k.page); // step 1 skipped, now on step 2
  const glyphs = await S(k.page, () => {
    const dots = [...document.querySelectorAll("#dots li")];
    const after = (el) => getComputedStyle(el, "::after").content;
    return { done: after(dots[0]), skipped: after(dots[1]) };
  });
  const live = await S(
    k.page,
    () => document.querySelectorAll('[role="status"], [aria-live]').length,
  );
  await S(k.page, () => window.__salon.debug.skipToResults());
  await k.page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10000 });
  const results = await stage();
  check(
    "SS-C02",
    "#stage is a tab stop (role=application) only while playing; on title / results it is tabindex=-1, aria-hidden, no role",
    title.tab === "-1" &&
      !title.role &&
      title.hidden === "true" &&
      playing.tab === "0" &&
      playing.role === "application" &&
      results.tab === "-1" &&
      !results.role,
    JSON.stringify({ title, playing, results }),
  );
  check(
    "SS-C11a",
    "done / skipped step dots carry a shape cue (check / dash), not colour alone",
    glyphs.done === '"✓"' && glyphs.skipped === '"–"',
    JSON.stringify(glyphs),
  );
  check(
    "SS-C11b",
    "exactly one live region announces (the coin pills are not live)",
    live === 1,
    `${live} live regions`,
  );
  await k.ctx.close();
}

/** SS-C03: computed contrast (worst gradient stop) of the flagged text pairs is >= 4.5:1. */
const CONTRAST_JS = () => {
  const parse = (str) =>
    [...str.matchAll(/rgba?\(([^)]+)\)/g)]
      .map((m) => m[1].split(",").map((x) => parseFloat(x)))
      .map(([r, g, b, a = 1]) => ({ r, g, b, a }));
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const wall = { r: 247, g: 163, b: 200 }; // the darkest wallpaper a translucent surface can sit on
  const blend = (c) => ({
    r: c.r * c.a + wall.r * (1 - c.a),
    g: c.g * c.a + wall.g * (1 - c.a),
    b: c.b * c.a + wall.b * (1 - c.a),
  });
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const stops = parse(cs.backgroundImage).concat(
        parse(cs.backgroundColor).filter((c) => c.a > 0),
      );
      if (stops.length) return stops.map(blend);
    }
    return [{ r: 255, g: 255, b: 255 }];
  };
  const out = {};
  for (const [name, sel] of Object.entries(window.__contrastTargets)) {
    const el = document.querySelector(sel);
    if (!el) {
      out[name] = null;
      continue;
    }
    const cs = getComputedStyle(el);
    const text = parse(cs.color)[0];
    // outlined headline text (-webkit-text-stroke) is read against its stroke colour, which is what surrounds the glyph
    const backs =
      parseFloat(cs.webkitTextStrokeWidth) > 0 ? parse(cs.webkitTextStrokeColor) : bgOf(el);
    out[name] = Math.min(...backs.map((bg) => ratio(text, bg)));
  }
  return out;
};
async function contrastOf(page, targets) {
  await page.evaluate((t) => {
    window.__contrastTargets = t;
  }, targets);
  return page.evaluate(CONTRAST_JS);
}
async function checkContrast(browser) {
  const k = await open(browser);
  const all = await contrastOf(k.page, { "Start button": "#startBtn", tagline: ".tagline" });
  await begin(k.page);
  await S(k.page, () => window.__salon.debug.completeStep());
  Object.assign(
    all,
    await contrastOf(k.page, {
      "Next (ready)": "#nextBtn[data-ready='true']",
      "step name": "#stepName",
      bubble: "#bubble",
    }),
  );
  await playTo(k.page, "acc");
  Object.assign(
    all,
    await contrastOf(k.page, { "pressed subtab": ".subtab[aria-pressed='true']" }),
  );
  await S(k.page, () => window.__salon.debug.skipToResults());
  await k.page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10000 });
  Object.assign(
    all,
    await contrastOf(k.page, {
      "photo caption": ".photo .cap",
      "new best": ".res-best.new",
      "results title": ".res-title",
      "look chip": ".res-card .look b",
      "coin pill": ".coin-pill",
      "earn line": ".earn",
      "play again": "#againBtn",
    }),
  );
  await k.page.evaluate(() => document.getElementById("againBtn").click());
  await k.page.waitForFunction(() => document.querySelector("#reqModal.open"));
  Object.assign(
    all,
    await contrastOf(k.page, { "sheet title": "#reqTitle", "look pill": "#reqLook" }),
  );
  const low = Object.entries(all)
    .filter(([, v]) => v !== null && v < 4.5)
    .map(([n, v]) => `${n} ${v.toFixed(2)}`);
  const missing = Object.entries(all)
    .filter(([, v]) => v === null)
    .map(([n]) => n);
  check(
    "SS-C03",
    "text contrast >= 4.5:1 (worst gradient stop) for buttons, tagline, caption, best, titles, sheet",
    low.length === 0 && missing.length === 0,
    low.concat(missing.map((m) => "missing " + m)).join(", ") ||
      Object.entries(all)
        .map(([n, v]) => `${n} ${v.toFixed(1)}`)
        .join(", "),
  );
  // the matched tick sits on a white disc
  await k.ctx.close();
}

const SMALL = (page) =>
  S(page, () =>
    [...document.querySelectorAll("#app button, #app a[href]")]
      .filter(
        (e) =>
          e.offsetParent !== null &&
          !e.closest("[hidden]") &&
          !e.closest(".modal:not(.open)") &&
          getComputedStyle(e).visibility !== "hidden",
      )
      .map((e) => ({
        id: e.id || e.className.split(" ")[0] || e.textContent.trim(),
        r: e.getBoundingClientRect(),
      }))
      .filter((x) => x.r.width > 0 && (x.r.width < 47.9 || x.r.height < 47.9))
      .map((x) => `${x.id}:${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
  );
/** SS-C04: every control is >= 48px at portrait and landscape (title, request sheet, each play state, results). */
async function checkTargets(browser) {
  const bad = [];
  for (const [w, h] of [
    [390, 844],
    [844, 390],
  ]) {
    const k = await open(browser, { viewport: { width: w, height: h } });
    bad.push(...(await SMALL(k.page)).map((x) => `${w}x${h} title ${x}`));
    await startBtn(k.page).click();
    await k.page.waitForFunction(() => document.querySelector("#reqModal.open"));
    await settled(k.page, "#reqModal .sheet");
    bad.push(...(await SMALL(k.page)).map((x) => `${w}x${h} sheet ${x}`));
    await k.page.getByRole("button", { name: "Let's glam!" }).click();
    await k.page.waitForFunction(() => !document.querySelector("#reqModal.open"));
    bad.push(...(await SMALL(k.page)).map((x) => `${w}x${h} cleanse ${x}`));
    await playTo(k.page, "acc");
    bad.push(...(await SMALL(k.page)).map((x) => `${w}x${h} accessories ${x}`));
    await S(k.page, () => window.__salon.debug.skipToResults());
    await k.page.waitForFunction(() => window.__salon.phase === "results", null, {
      timeout: 10000,
    });
    bad.push(...(await SMALL(k.page)).map((x) => `${w}x${h} results ${x}`));
    await k.ctx.close();
  }
  check(
    "SS-C04",
    "every visible button / link is >= 48x48px at 390x844 and 844x390 (title, sheet, cleanse, accessories, results)",
    bad.length === 0,
    [...new Set(bad)].join(", "),
  );
}

/** Wait for a sheet's pop-in animation to end (its bounding box is scaled while it plays). */
const settled = (page, sel) =>
  page.evaluate(
    (q) =>
      Promise.all(
        document
          .querySelector(q)
          .getAnimations()
          .map((a) => a.finished),
      ),
    sel,
  );
const inside = (b, w, h) =>
  b && b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5;
/** SS-C05: the request / leave / unlock sheets and their primary buttons fit short landscape screens. */
async function checkSheetsFit(browser) {
  const bad = [];
  for (const [w, h] of [
    [844, 390],
    [667, 375],
    [640, 360],
    [568, 320],
  ]) {
    const k = await open(browser, { viewport: { width: w, height: h } });
    const startOk = inside(await startBtn(k.page).boundingBox(), w, h);
    await startBtn(k.page).click();
    await k.page.waitForFunction(() => document.querySelector("#reqModal.open"));
    await settled(k.page, "#reqModal .sheet");
    const req = [
      await k.page.locator("#reqModal .sheet").boundingBox(),
      await k.page.locator("#reqGo").boundingBox(),
    ];
    await k.page.getByRole("button", { name: "Let's glam!" }).click();
    await k.page.keyboard.press("Escape");
    await k.page.waitForFunction(() => document.querySelector("#leaveModal.open"));
    await settled(k.page, "#leaveModal .sheet");
    const leave = [
      await k.page.locator("#leaveModal .sheet").boundingBox(),
      await k.page.locator("#leaveNo").boundingBox(),
    ];
    await k.page.keyboard.press("Escape");
    await playTo(k.page, "shadow");
    await k.page.getByRole("button", { name: /Eye shadow: Mint, locked/ }).click();
    await k.page.waitForFunction(() => document.querySelector("#unlockModal.open"));
    await settled(k.page, "#unlockModal .sheet");
    const unlock = [
      await k.page.locator("#unlockModal .sheet").boundingBox(),
      await k.page.locator("#unlockNo").boundingBox(),
    ];
    if (!startOk) bad.push(`${w}x${h} Start`);
    [
      ["request", req],
      ["leave", leave],
      ["unlock", unlock],
    ].forEach(([name, boxes]) =>
      boxes.forEach((b, i) => {
        if (!inside(b, w, h)) bad.push(`${w}x${h} ${name} ${i ? "button" : "sheet"}`);
      }),
    );
    await k.ctx.close();
  }
  check(
    "SS-C05",
    "Start, and the request / leave / unlock sheets with their primary buttons, fit 844x390, 667x375, 640x360 and 568x320",
    bad.length === 0,
    bad.join(", "),
  );
}

/** SS-C06: Play again / PlayPad are on screen without any scrolling on phones. */
async function checkResultsCta(browser) {
  const bad = [];
  for (const [w, h] of [
    [390, 844],
    [360, 640],
    [844, 390],
  ]) {
    const k = await open(browser, { viewport: { width: w, height: h } });
    await begin(k.page);
    await S(k.page, () => window.__salon.debug.skipToResults());
    await k.page.waitForFunction(() => window.__salon.phase === "results", null, {
      timeout: 10000,
    });
    const again = await k.page.locator("#againBtn").boundingBox();
    const hub = await k.page.locator('#results a[href="../../index.html"]').boundingBox();
    if (!inside(again, w, h) || !inside(hub, w, h)) bad.push(`${w}x${h}`);
    await k.ctx.close();
  }
  check(
    "SS-C06",
    "results: Play again and PlayPad are fully on screen with no scrolling at 390x844, 360x640 and 844x390",
    bad.length === 0,
    bad.join(", "),
  );
}

/** SS-Q04 / SS-QA-02: a keyboard "Space held" latch can never get stuck (blur, hidden tab). */
async function checkKbdLatch(browser) {
  const k = await open(browser);
  await begin(k.page);
  await playTo(k.page, "shadow");
  await k.page.locator("#stage").focus();
  await k.page.keyboard.down("Space");
  const held = (await S(k.page, () => window.__salon.kbd)).held;
  await k.page.evaluate(() => document.getElementById("stage").blur()); // focus leaves while Space is down: no keyup arrives
  const afterBlur = (await S(k.page, () => window.__salon.kbd)).held;
  await k.page.keyboard.up("Space");
  await k.page.locator("#stage").focus();
  await k.page.keyboard.down("Space");
  await k.page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const afterHidden = (await S(k.page, () => window.__salon.kbd)).held;
  await k.page.keyboard.up("Space");
  const before = await progress(k.page);
  await k.page.locator("#stage").focus();
  for (let i = 0; i < 6; i++) await k.page.keyboard.press("ArrowRight");
  check(
    "SS-Q04",
    "keyboard Space-held latch resets on blur and on a hidden tab (arrows then do not paint)",
    held === true &&
      afterBlur === false &&
      afterHidden === false &&
      (await progress(k.page)) === before,
    JSON.stringify({ held, afterBlur, afterHidden }),
  );
  await k.ctx.close();
}

/** SS-QA-03 + SS-QA-06: Accessories un-complete when nothing is worn (coin latched); debug helpers inert off-phase. */
async function checkAccessoriesAndGuards(browser) {
  const k = await open(browser);
  await begin(k.page);
  await playTo(k.page, "acc");
  const coins0 = await S(k.page, () => window.__salon.coins);
  const tiara = k.page.getByRole("button", { name: /Tiara: Pearl tiara/ });
  await tiara.click();
  const done1 = await S(k.page, () => window.__salon.done[6]);
  const coins1 = await S(k.page, () => window.__salon.coins);
  await tiara.click(); // take it off again
  const done2 = await S(k.page, () => window.__salon.done[6]);
  await tiara.click(); // and back on
  const coins3 = await S(k.page, () => window.__salon.coins);
  check(
    "SS-QA-03",
    "Accessories un-complete when nothing is worn, and the step coin is paid only once",
    done1 === true && coins1 === coins0 + 10 && done2 === false && coins3 === coins1,
    JSON.stringify({ done1, coins1, done2, coins3 }),
  );
  await S(k.page, () => window.__salon.debug.skipToResults());
  await k.page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10000 });
  const before = await S(k.page, () => ({
    coins: window.__salon.coins,
    phase: window.__salon.phase,
    saved: window.__salon.saved.looks.length,
  }));
  await S(k.page, () => {
    window.__salon.debug.skipToResults();
    window.__salon.debug.completeStep();
    window.__salon.debug.nextStep();
    window.__salon.debug.glam();
  });
  const after = await S(k.page, () => ({
    coins: window.__salon.coins,
    phase: window.__salon.phase,
    saved: window.__salon.saved.looks.length,
  }));
  check(
    "SS-Q07",
    "debug helpers do nothing outside a live makeover (no re-run from the results screen)",
    JSON.stringify(before) === JSON.stringify(after),
    JSON.stringify({ before, after }),
  );
  await k.ctx.close();
}

/** SS-QA-05: two tabs share one save through a revision counter; coins / unlocks follow the newest write. */
async function checkMultiTab(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await ctx.newPage();
  const b = await ctx.newPage();
  await a.goto(URL);
  await b.goto(URL);
  await a.waitForFunction(() => window.__salon);
  await b.waitForFunction(() => window.__salon);
  await b.evaluate(() => window.__salon.debug.addCoins(40));
  const seenByA = await a
    .waitForFunction(() => window.__salon.coins === 40, null, { timeout: 4000 })
    .then(
      () => true,
      () => false,
    );
  await a.evaluate(() => window.__salon.debug.addCoins(15));
  const seenByB = await b
    .waitForFunction(() => window.__salon.coins === 55, null, { timeout: 4000 })
    .then(
      () => true,
      () => false,
    );
  const revs = [
    await a.evaluate(() => window.__salon.saved.rev),
    await b.evaluate(() => window.__salon.saved.rev),
  ];
  // a stale tab must not overwrite a newer save: tab A writes while its copy is behind
  await b.evaluate(() =>
    localStorage.setItem(
      "playpad.sparkleSalon.v1",
      JSON.stringify({
        v: 1,
        rev: 99,
        coins: 7,
        unlocked: [],
        sound: true,
        looks: [],
        bestOverall: 0,
      }),
    ),
  );
  await a.evaluate(() => window.__salon.debug.addCoins(1)); // A still believes rev ~2: it must adopt rev 99 first, then add
  const merged = await a.evaluate(() => ({
    coins: window.__salon.coins,
    rev: window.__salon.saved.rev,
  }));
  check(
    "SS-QA-05",
    "two tabs: a write in one shows up in the other, and a stale tab adopts the newer revision instead of overwriting it",
    seenByA && seenByB && revs[0] === revs[1] && merged.coins === 8 && merged.rev === 100,
    JSON.stringify({ seenByA, seenByB, revs, merged }),
  );
  await ctx.close();
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  try {
    // ------------------------------------------------------------------ AC-1 title screen
    {
      const { ctx, page, errors, requests } = await open(browser);
      const f0 = await S(page, () => window.__salon.frame);
      await page.waitForTimeout(250);
      const f1 = await S(page, () => window.__salon.frame);
      const box = await startBtn(page).boundingBox();
      const hook = await S(page, () =>
        ["phase", "step", "frame", "coins"].every(
          (k) => typeof Object.getOwnPropertyDescriptor(window.__salon, k).get === "function",
        ),
      );
      check(
        "AC-19",
        "window.__salon exists from load with live getters phase/step/frame/coins",
        hook,
      );
      check(
        "AC-1",
        "title: phase=title, Start makeover visible inside the viewport, frame idle",
        (await S(page, () => window.__salon.phase)) === "title" &&
          box &&
          box.y + box.height <= 844 &&
          f0 === f1,
        `frame ${f0}->${f1}`,
      );
      check(
        "AC-1b",
        "title has a sound toggle and a back link to the hub",
        (await page.locator("#soundBtn").getAttribute("aria-pressed")) === "true" &&
          (await page.locator('#title a[href="../../index.html"]').count()) === 1,
      );
      await shot(page, "390-title");
      await ctx.close();

      // ------------------------------------------------------------------ AC-17 clean page
      void errors;
      void requests;
    }

    // ------------------------------------------------------------------ main play-through (390x844)
    const { ctx, page, errors, requests } = await open(browser);
    await startBtn(page).click();
    await page.waitForFunction(() => window.__salon.phase === "playing");
    const want = await S(page, () => window.__salon.want);
    const cardNames = await page.locator("#reqWants li").allInnerTexts();
    check(
      "AC-2",
      "Start -> phase=playing; the client card lists 4 colour hints",
      cardNames.length === 4 && Object.keys(want).length === 4,
      cardNames.join(" | ").replace(/\n/g, " "),
    );
    await shot(page, "390-request");
    await page.getByRole("button", { name: "Let's glam!" }).click();
    await page.waitForFunction(() => !document.querySelector("#reqModal.open"));
    const fA = await S(page, () => window.__salon.frame);
    await page.waitForTimeout(400);
    const fB = await S(page, () => window.__salon.frame);
    check(
      "AC-2b",
      "RAF loop runs while playing (frame increments)",
      fB - fA >= 8,
      `+${fB - fA} frames in 400ms`,
    );

    const names = await page.locator("#dots li").count();
    const stepNames = [];
    check("AC-3a", "step indicator shows 8 steps", names === 8);

    // ---- step 0 cleanse (wipe)
    stepNames.push(await page.locator("#stepName").innerText());
    const p0 = await progress(page);
    await shot(page, "390-step1-cleanse-before");
    await wipeSmudges(page);
    const p0b = await S(page, () => ({
      done: window.__salon.done[0],
      coins: window.__salon.coins,
      audio: window.__salon.audio.played,
    }));
    check(
      "AC-4a",
      "cleanse: wiping the smudges completes the step (+10 coins, chime played)",
      p0 === 0 && p0b.done && p0b.coins === 10 && p0b.audio > 0,
      JSON.stringify(p0b),
    );
    await shot(page, "390-step1-cleanse-done");
    check(
      "AC-8a",
      "Next turns prominent (data-ready=true) once the step is done",
      (await nextBtn(page).getAttribute("data-ready")) === "true",
    );
    await goNext(page);

    // ---- step 1 eye shadow (rub) — monotonic progress, then auto-complete
    stepNames.push(await page.locator("#stepName").innerText());
    await wantedTool(page).click(); // use the colour the client asked for
    const samples = [];
    await scrub(page, { passes: 8, points: 16, samples });
    const mono = samples.every((v, i) => i === 0 || v >= samples[i - 1] - 1e-9);
    const first = samples.find((v) => v > 0);
    const sh = await S(page, () => ({ done: window.__salon.done[1], coins: window.__salon.coins }));
    check(
      "AC-4b",
      "eye shadow: rubbing raises coverage monotonically and auto-completes at ~80% (+10 coins)",
      mono && first !== undefined && first < 0.8 && sh.done && sh.coins === 20,
      `samples ${samples.length}, first ${first?.toFixed(2)}, ${JSON.stringify(sh)}`,
    );
    check(
      "AC-4c",
      "the progress ring reports the step as done",
      (await page.locator("#ringTxt").innerText()) === "✓",
    );
    await shot(page, "390-step2-shadow-done");
    await goNext(page);

    // ---- step 2 lenses: tap to choose, instant swap
    stepNames.push(await page.locator("#stepName").innerText());
    const irisBefore = await page.locator("#irisMid").getAttribute("stop-color");
    await wantedTool(page).click();
    const irisAfter = await page.locator("#irisMid").getAttribute("stop-color");
    check(
      "AC-6a",
      "lenses: tapping a colour swaps the iris instantly and completes the step",
      irisBefore !== irisAfter && (await S(page, () => window.__salon.done[2])),
      `${irisBefore} -> ${irisAfter}`,
    );
    await shot(page, "390-step3-lens-done");
    await goNext(page);

    // ---- step 3 mascara: lashes coat as the wand sweeps (skip-less: scrub)
    stepNames.push(await page.locator("#stepName").innerText());
    await scrub(page, { passes: 12, points: 40 });
    const lashOp = await page
      .locator("#lashFullL .lf")
      .first()
      .evaluate((e) => Number(e.style.opacity));
    check(
      "AC-4d",
      "mascara: sweeping the wand coats the lashes and completes the step",
      (await S(page, () => window.__salon.done[3])) && lashOp > 0.5,
      `lash opacity ${lashOp}`,
    );
    await goNext(page);

    // ---- step 4 blush: a TAP paints a dab; Redo clears it
    stepNames.push(await page.locator("#stepName").innerText());
    await wantedTool(page).click();
    const pt = await S(page, () => window.__salon.debug.regionPoint(0.5));
    await page.mouse.click(pt.x, pt.y);
    const pTap = await progress(page);
    check(
      "AC-5",
      "blush: a single tap paints a dab (progress rises, step not yet done)",
      pTap > 0 && pTap < 0.8,
      `progress ${pTap.toFixed(3)}`,
    );
    await page.locator("#clearBtn").click();
    check(
      "AC-7",
      "Redo clears the step (progress back to 0, paint removed)",
      (await progress(page)) === 0,
    );
    await scrub(page, { passes: 12, points: 40 });
    await goNext(page);

    // ---- step 5 lipstick: use the client's colour
    stepNames.push(await page.locator("#stepName").innerText());
    await wantedTool(page).click();
    await scrub(page, { passes: 12, points: 20 });
    await goNext(page);

    // ---- step 6 accessories
    stepNames.push(await page.locator("#stepName").innerText());
    await page.getByRole("button", { name: /Tiara: Heart tiara/ }).click();
    const tiaraShown = await page
      .locator('[data-acc="tiara:heart"]')
      .evaluate((e) => e.style.display !== "none");
    const pearlHidden = await page
      .locator('[data-acc="tiara:pearl"]')
      .evaluate((e) => e.style.display === "none");
    await page.getByRole("button", { name: "Necklace", exact: true }).click();
    await page.getByRole("button", { name: /Necklace: Star necklace/ }).click();
    const necklace = await page
      .locator('[data-acc="necklace:star"]')
      .evaluate((e) => e.style.display !== "none");
    check(
      "AC-6b",
      "accessories: tiara + necklace swap in instantly (old one hidden) and complete the step",
      tiaraShown && pearlHidden && necklace && (await S(page, () => window.__salon.done[6])),
    );
    await shot(page, "390-step7-accessories");
    await goNext(page);

    // ---- step 7 stickers (optional): tap places one
    stepNames.push(await page.locator("#stepName").innerText());
    const c = await S(page, () => window.__salon.debug.unitsToClient(150, 250));
    await page.mouse.click(c.x, c.y);
    check(
      "AC-6c",
      "stickers: tapping the face sticks a sticker and completes the step",
      (await S(page, () => window.__salon.stickers)) === 1 &&
        (await S(page, () => window.__salon.done[7])),
    );
    await shot(page, "390-step8-stickers");
    check(
      "AC-3b",
      "the 8 steps run in order: Cleanse, Eye shadow, Eye lenses, Mascara, Blush, Lipstick, Accessories, Stickers",
      stepNames.join(",") ===
        "Cleanse,Eye shadow,Eye lenses,Mascara,Blush,Lipstick,Accessories,Stickers",
      stepNames.join(","),
    );
    check(
      "AC-8b",
      "the last step's Next reads 'Photo!' when ready",
      (await page.locator("#nextTxt").innerText()) === "Photo!",
    );

    // ---- reveal
    const coinsBefore = await S(page, () => window.__salon.coins);
    await nextBtn(page).click();
    await page.waitForFunction(
      () => window.__salon.phase === "reveal" || window.__salon.phase === "results",
    );
    const flash = await page.locator("#flash").evaluate((e) => e.classList.contains("go"));
    await page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10000 });
    const res = await S(page, () => ({
      r: window.__salon.result,
      coins: window.__salon.coins,
      saved: window.__salon.saved,
    }));
    check(
      "AC-11a",
      "reveal: camera flash, then the photo screen with a 1-3 star rating",
      flash && res.r.stars >= 1 && res.r.stars <= 3,
      `stars ${res.r.stars}`,
    );
    check(
      "AC-11b",
      "results: coins banked (steps + matches + stars) and persisted",
      res.coins > coinsBefore && res.saved.coins === res.coins,
      `${coinsBefore} -> ${res.coins}`,
    );
    check(
      "AC-11c",
      "results: bestOverall is a top-level number in the save",
      typeof res.saved.bestOverall === "number" &&
        res.saved.bestOverall === res.r.score &&
        res.saved.v === 1,
    );
    check(
      "AC-12a",
      "matching the client's 4 colours with all 8 steps done earns 3 stars",
      res.r.matches === 4 && res.r.stars === 3 && res.r.stepsDone === 8,
      JSON.stringify({ matches: res.r.matches, stars: res.r.stars, steps: res.r.stepsDone }),
    );
    const litStars = await page.locator("#stars .star.lit").count();
    check("AC-11d", "the earned stars light up one by one", litStars === res.r.stars);
    await shot(page, "390-results");

    // ---- play again / back link
    const hubHref = await page.locator('#results a[href="../../index.html"]').getAttribute("href");
    await page.locator("#againBtn").click();
    await page.waitForFunction(
      () => window.__salon.phase === "playing" && document.querySelector("#reqModal.open"),
    );
    check(
      "AC-13",
      "Play again starts a new makeover (new client card, phase=playing); ← PlayPad links to the hub",
      hubHref === "../../index.html" && (await S(page, () => window.__salon.step)) === 0,
    );
    await page.getByRole("button", { name: "Let's glam!" }).click();

    // ---- AC-10 persistence: reload keeps coins / unlocks
    const savedCoins = await S(page, () => window.__salon.coins);
    await page.reload();
    await page.waitForFunction(() => window.__salon);
    check(
      "AC-10a",
      "reload keeps coins and best score",
      (await S(page, () => window.__salon.coins)) === savedCoins &&
        (await S(page, () => window.__salon.saved.bestOverall)) > 0,
      `coins ${savedCoins}`,
    );

    // ---- AC-9 unlocks (locked item, not enough coins, then enough)
    await S(page, () =>
      localStorage.setItem(
        "playpad.sparkleSalon.v1",
        JSON.stringify({ v: 1, coins: 10, unlocked: [], sound: true, looks: [], bestOverall: 0 }),
      ),
    );
    await page.reload();
    await page.waitForFunction(() => window.__salon);
    await begin(page);
    await S(page, () => window.__salon.debug.completeStep());
    await goNext(page); // -> eye shadow
    const lockedBtn = page.getByRole("button", {
      name: /Eye shadow: Mint, locked, costs 50 coins/,
    });
    const hasLock = (await lockedBtn.locator(".badge").count()) === 1;
    await lockedBtn.click();
    const noYes = await page.locator("#unlockYes").isHidden();
    const coinsA = await S(page, () => window.__salon.coins);
    await page.locator("#unlockNo").click();
    check(
      "AC-9a",
      "a locked colour shows a lock badge; with too few coins the sheet offers no Unlock",
      hasLock && noYes && coinsA === 20,
      `coins ${coinsA}`,
    );
    await S(page, () => window.__salon.debug.addCoins(100));
    await lockedBtn.click();
    await page.locator("#unlockYes").click();
    const after = await S(page, () => ({
      coins: window.__salon.coins,
      saved: window.__salon.saved,
    }));
    check(
      "AC-9b",
      "unlocking spends the coins, is saved, and the colour is used straight away",
      after.coins === coinsA + 100 - 50 &&
        after.saved.unlocked.includes("shadow:mint") &&
        (await page
          .getByRole("button", { name: /Eye shadow: Mint$/ })
          .getAttribute("aria-pressed")) === "true",
      JSON.stringify(after.saved.unlocked),
    );
    await page.reload();
    await page.waitForFunction(() => window.__salon);
    check(
      "AC-9c",
      "the unlock survives a reload",
      (await S(page, () => window.__salon.saved.unlocked.includes("shadow:mint"))) === true,
    );

    // ---- AC-14 sound: toggle persists, music pauses when hidden
    await page.locator("#soundBtn").click();
    const off = await S(page, () => window.__salon.saved.sound);
    await page.locator("#soundBtn").click();
    const on = await S(page, () => window.__salon.saved.sound);
    const musicRan = await page
      .waitForFunction(
        () => window.__salon.audio.music >= 6 && window.__salon.audio.played > 0,
        null,
        {
          timeout: 8000,
        },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      "AC-14b",
      "music: the loop scheduler runs after the first gesture and synthesised effects fire",
      musicRan,
      JSON.stringify(await S(page, () => window.__salon.audio)),
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page
      .waitForFunction(() => window.__salon.audio.state === "suspended", null, { timeout: 3000 })
      .catch(() => {});
    const hiddenState = await S(page, () => window.__salon.audio.state);
    check(
      "AC-14",
      "sound toggle persists (off then on) and the audio context suspends while the tab is hidden",
      off === false && on === true && hiddenState === "suspended",
      `ctx ${hiddenState}`,
    );

    // ---- AC-12b free styling is never punished: skip every step, still >= 1 star and coins
    {
      const q = await open(browser);
      await begin(q.page);
      for (let i = 0; i < 8; i++) await goNext(q.page);
      await q.page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10000,
      });
      const r = await S(q.page, () => ({ r: window.__salon.result, coins: window.__salon.coins }));
      check(
        "AC-12b",
        "a run with every step skipped still earns 1 star and coins (never punished)",
        r.r.stars === 1 && r.r.matches === 0 && r.coins === 15 && r.r.stepsDone === 0,
        JSON.stringify({ stars: r.r.stars, coins: r.coins }),
      );
      await q.ctx.close();
    }

    // ---- AC-17 no errors / no foreign requests
    const foreign = requests.filter(
      (u) => !u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:"),
    );
    const allowed = requests
      .filter((u) => u.startsWith(BASE))
      .every(
        (u) =>
          /\/(games\/sparkle-salon\/(index\.html)?|styles\/(tokens|base)\.css|icons\/favicon\.svg)$/.test(
            u.split("?")[0],
          ) || u === BASE + "/",
      );
    check(
      "AC-17",
      "no console errors / failed requests, and nothing fetched beyond the page + shared css + favicon (no theme.js: the salon is pinned light)",
      errors.length === 0 && foreign.length === 0 && allowed,
      errors.concat(foreign).join(" | ") || `${requests.length} requests`,
    );
    await ctx.close();

    // ------------------------------------------------------------------ AC-10b hostile save
    {
      const hostile = JSON.stringify({
        v: 1,
        coins: "1e999",
        unlocked: ["__proto__", "shadow:gold", "nope", 5],
        sound: "yes",
        looks: [
          { stars: 99, score: -4, req: "zzz" },
          { stars: 2, score: 1e99, req: "ocean-ball" },
        ],
        bestOverall: Infinity,
      });
      const h = await open(browser, {
        init: `localStorage.setItem("${SAVE_KEY}", ${JSON.stringify(hostile)})`,
      });
      const s = await S(h.page, () => window.__salon.saved);
      check(
        "AC-10b",
        "a hand-edited save is sanitised (no Infinity, unknown ids dropped, caps applied)",
        s.coins === 0 &&
          s.unlocked.length === 1 &&
          s.unlocked[0] === "shadow:gold" &&
          s.looks.length === 1 &&
          s.looks[0].score === 99999 &&
          s.bestOverall === 0 &&
          s.sound === true,
        JSON.stringify(s),
      );
      await h.ctx.close();
      const broken = await open(browser, {
        init: `Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });`,
      });
      check(
        "AC-10c",
        "blocked / throwing storage never breaks the game",
        (await S(broken.page, () => window.__salon.phase)) === "title" &&
          broken.errors.filter((e) => !/blocked/.test(e)).length === 0,
      );
      await broken.ctx.close();
    }

    // ------------------------------------------------------------------ AC-15 keyboard + a11y
    {
      const k = await open(browser);
      await begin(k.page);
      const unnamed = await S(
        k.page,
        () =>
          [...document.querySelectorAll("button, a[href]")].filter(
            (e) =>
              e.offsetParent !== null &&
              !(e.getAttribute("aria-label") || e.textContent || "").trim(),
          ).length,
      );
      check(
        "AC-15a",
        "every visible button / link has an accessible name",
        unnamed === 0,
        `${unnamed} unnamed`,
      );
      const small = await S(k.page, () =>
        [...document.querySelectorAll("#play button, #play a[href]")]
          .filter((e) => e.offsetParent !== null && !e.closest("[hidden]"))
          .map((e) => ({ id: e.id || e.className, r: e.getBoundingClientRect() }))
          .filter((x) => x.r.width > 0 && (x.r.width < 47.9 || x.r.height < 47.9))
          .map((x) => `${x.id}:${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
      );
      check("AC-15b", "touch targets are at least 48x48px", small.length === 0, small.join(", "));
      // keyboard: focus a tray tool with Tab, press Enter -> it becomes selected
      await k.page.locator("#tools button.tool").nth(1).focus();
      await k.page.keyboard.press("Enter");
      const sel = await k.page.locator("#tools button.tool").nth(1).getAttribute("aria-pressed");
      const ring = await k.page
        .locator("#tools button.tool")
        .nth(1)
        .evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth));
      check(
        "AC-15c",
        "tray tools are keyboard operable (Enter picks) with a visible focus ring",
        sel === "true" && ring >= 2,
        `outline ${ring}px`,
      );
      // keyboard painting: go to eye shadow, focus the stage, hold Space + arrows
      await S(k.page, () => window.__salon.debug.completeStep());
      await goNext(k.page);
      await k.page.locator("#stage").focus();
      const before = await progress(k.page);
      // walk the keyboard cursor (8 art units per press) onto the left eyelid, then hold Space and sweep
      const cells = await S(k.page, () => window.__salon.debug.regionCells());
      const target = cells[Math.floor(cells.length * 0.12)];
      const at = await S(k.page, () => window.__salon.kbd);
      const walk = async (dx, dy) => {
        const key = (n, neg, pos) => (n < 0 ? neg : pos);
        for (let i = 0; i < Math.round(Math.abs(dx) / 8); i++)
          await k.page.keyboard.press(key(dx, "ArrowLeft", "ArrowRight"));
        for (let i = 0; i < Math.round(Math.abs(dy) / 8); i++)
          await k.page.keyboard.press(key(dy, "ArrowUp", "ArrowDown"));
      };
      await walk(target[0] - at.x, target[1] - at.y);
      await k.page.keyboard.down("Space");
      for (let i = 0; i < 12; i++) await k.page.keyboard.press(i % 2 ? "ArrowLeft" : "ArrowRight");
      await k.page.keyboard.up("Space");
      const after = await progress(k.page);
      check(
        "AC-15d",
        "keyboard: arrow keys move the tool and Space paints (progress rises)",
        after > before + 0.02,
        `progress ${before.toFixed(2)} -> ${after.toFixed(2)}`,
      );
      await k.page.keyboard.press("Escape");
      const leave = await k.page.locator("#leaveModal.open").count();
      check("AC-15e", "Esc opens the leave sheet (Esc again closes it)", leave === 1);
      await k.page.keyboard.press("Escape");
      await k.ctx.close();
    }

    // ------------------------------------------------------------------ AC-15f reduced motion
    {
      const r = await open(browser, { reduced: true });
      await begin(r.page);
      await S(r.page, () => window.__salon.debug.skipToResults());
      await r.page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10000,
      });
      const lit = await r.page.locator("#stars .star.lit").count();
      const vis = await r.page.locator("#againBtn").isVisible();
      check(
        "AC-15f",
        "prefers-reduced-motion: the whole flow still reaches the results with stars lit and buttons visible",
        lit >= 1 && vis && r.errors.length === 0,
        r.errors.join(" | "),
      );
      await r.ctx.close();
    }

    // ------------------------------------------------------------------ AC-15g touch: tool sits above the fingertip
    {
      const t = await open(browser, { touch: true });
      await begin(t.page);
      const p = await S(t.page, () => window.__salon.debug.unitsToClient(226, 232));
      await t.page.touchscreen.tap(p.x, p.y + 46);
      const prog = await progress(t.page);
      check(
        "AC-15g",
        "touch: a fingertip tap paints at the lifted tool tip (cleanse progress rises)",
        prog > 0,
        `progress ${prog.toFixed(3)}`,
      );
      await t.ctx.close();
    }

    // ------------------------------------------------------------------ AC-16 responsive + screenshots
    const viewports = [
      ["390x844", 390, 844],
      ["844x390", 844, 390],
      ["820x1180", 820, 1180],
      ["1280x800", 1280, 800],
      ["360x640", 360, 640],
    ];
    for (const [label, w, hgt] of viewports) {
      const v = await open(browser, { viewport: { width: w, height: hgt } });
      const sb = await startBtn(v.page).boundingBox();
      const noScroll = await S(
        v.page,
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.body.scrollWidth <= innerWidth,
      );
      await begin(v.page);
      await S(v.page, () => window.__salon.debug.completeStep());
      await goNext(v.page);
      const trayVisible = await v.page.locator("#tools button.tool").first().isVisible();
      const nextBox = await nextBtn(v.page).boundingBox();
      const nextInside =
        nextBox &&
        nextBox.x >= 0 &&
        nextBox.x + nextBox.width <= w &&
        nextBox.y + nextBox.height <= hgt;
      if (label === "1280x800" || label === "844x390") await shot(v.page, label + "-play");
      await S(v.page, () => window.__salon.debug.skipToResults());
      await v.page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10000,
      });
      const againBox = await v.page.locator("#againBtn").boundingBox();
      const againInside = againBox && againBox.y + againBox.height <= hgt + 1 && againBox.y >= 0;
      if (label === "1280x800" || label === "844x390") await shot(v.page, label + "-results");
      check(
        `AC-16 ${label}`,
        "no horizontal scroll; Start, tray, Next and Play again are all reachable on screen",
        sb &&
          sb.y + sb.height <= hgt &&
          noScroll &&
          trayVisible &&
          nextInside &&
          againInside &&
          v.errors.length === 0,
        `start ${sb ? Math.round(sb.y + sb.height) : "?"}/${hgt}, next ${nextInside}, again ${againInside}`,
      );
      await v.ctx.close();
    }
    {
      const v = await open(browser, { viewport: { width: 1280, height: 800 } });
      await shot(v.page, "1280-title");
      await v.ctx.close();
    }

    // ------------------------------------------------------------------ QA-panel regression checks
    await checkFocusKept(browser);
    await checkStageAndDots(browser);
    await checkContrast(browser);
    await checkTargets(browser);
    await checkSheetsFit(browser);
    await checkResultsCta(browser);
    await checkKbdLatch(browser);
    await checkAccessoriesAndGuards(browser);
    await checkMultiTab(browser);

    // ------------------------------------------------------------------ AC-18 file:// works
    {
      const f = await open(browser, {
        url: pathToFileURL(resolve(ROOT, "games/sparkle-salon/index.html")).href,
      });
      await startBtn(f.page).click();
      await f.page.waitForFunction(() => window.__salon.phase === "playing");
      check(
        "AC-18",
        "opens from file:// and Start works, with no errors",
        f.errors.length === 0,
        f.errors.join(" | "),
      );
      await f.ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nscreenshots: ${SHOTS}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
