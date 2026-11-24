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
  const all = await contrastOf(k.page, {
    "Start button": "#startBtn",
    tagline: ".tagline",
    // v2 additions (QA round): the album's gold count, its empty message and caption, the saved note (the wish labels are
    // checked below, on the client card, where they exist)
    "album count": ".album-btn .count",
    "album empty": ".album-empty",
    "album caption": ".album-cap",
    "saved note": ".saved-note",
  });
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
      "coin pill": ".coin-pill",
      "earn line": ".earn",
      "play again": "#againBtn",
    }),
  );
  await k.page.evaluate(() => document.getElementById("againBtn").click());
  await k.page.waitForFunction(() => document.querySelector("#reqModal.open"));
  Object.assign(
    all,
    await contrastOf(k.page, {
      "sheet title": "#reqTitle",
      "look pill": "#reqLook",
      "wish label": ".wants small",
    }),
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
  // localStorage writes reach other tabs asynchronously (browser process -> renderers, no cross-tab mutex), so
  // A can still read its old copy for a few ms after B's setItem returns. Wait on that state, not on time:
  // once A's own storage view shows rev 99, A's next write is a real "stale in memory, newer on disk" case.
  const seenRev99 = await a
    .waitForFunction(
      () => JSON.parse(localStorage.getItem("playpad.sparkleSalon.v1") || "{}").rev === 99,
      null,
      { timeout: 4000 },
    )
    .then(
      () => true,
      () => false,
    );
  await a.evaluate(() => window.__salon.debug.addCoins(1)); // A still believes rev ~2 (or just adopted 99): add on top of rev 99
  const merged = await a.evaluate(() => ({
    coins: window.__salon.coins,
    rev: window.__salon.saved.rev,
  }));
  // Deterministic stale-in-memory case: a page's own setItem raises no storage event in that page, so A's memory
  // is guaranteed behind the disk copy here (the cross-tab write above may be adopted by the event first).
  await a.evaluate(() =>
    localStorage.setItem(
      "playpad.sparkleSalon.v1",
      JSON.stringify({
        v: 1,
        rev: 150,
        coins: 20,
        unlocked: [],
        sound: true,
        looks: [],
        bestOverall: 0,
      }),
    ),
  );
  await a.evaluate(() => window.__salon.debug.addCoins(1));
  const stale = await a.evaluate(() => ({
    coins: window.__salon.coins,
    rev: window.__salon.saved.rev,
  }));
  check(
    "SS-QA-05",
    "two tabs: a write in one shows up in the other, and a stale tab adopts the newer revision instead of overwriting it",
    seenByA &&
      seenByB &&
      seenRev99 &&
      revs[0] === revs[1] &&
      merged.coins === 8 &&
      merged.rev === 100 &&
      stale.coins === 21 &&
      stale.rev === 151,
    JSON.stringify({ seenByA, seenByB, seenRev99, revs, merged, stale }),
  );
  await ctx.close();
}

// ================================================================== RT-1 + round-2 checks (RT1-*, R2-*)
/** The visible tool's drawn extent (union of its parts' boxes: the svg itself is a bigger empty canvas). */
const toolBox = (page) =>
  S(page, () => {
    const t = document.getElementById("tool");
    const svg = [...t.querySelectorAll("svg")].find((e) => getComputedStyle(e).display !== "none");
    if (!svg || !t.classList.contains("on")) return null;
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    for (const e of svg.querySelectorAll(":scope > g > *")) {
      const r = e.getBoundingClientRect();
      x0 = Math.min(x0, r.left);
      y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right);
      y1 = Math.max(y1, r.bottom);
    }
    const fab = document.querySelector(".fab-row").getBoundingClientRect();
    return { tool: t.dataset.tool, x0, y0, x1, y1, fabTop: fab.top, vw: innerWidth };
  });

/** Wait (the camera glides, the tool eases to its resting spot) until the tool is fully on screen above Redo / Skip. */
async function settleTool(page) {
  await page
    .waitForFunction(
      () => {
        const t = document.getElementById("tool");
        const svg = [...t.querySelectorAll("svg")].find(
          (e) => getComputedStyle(e).display !== "none",
        );
        if (!svg || !t.classList.contains("on")) return false;
        const fab = document.querySelector(".fab-row").getBoundingClientRect().top;
        return [...svg.querySelectorAll(":scope > g > *")].every((e) => {
          const r = e.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= fab;
        });
      },
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
  return toolBox(page);
}
/** Walk the eight steps; for each one that has a tool, record whether it rests fully on screen. */
async function restOnEachStep(page, label, bad, seen) {
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction((n) => window.__salon.step === n, i);
    const stepId = await S(page, () => window.__salon.stepId);
    if (!["lens", "acc"].includes(stepId)) {
      const box = await settleTool(page);
      const ok = box && box.x0 >= 0 && box.x1 <= box.vw && box.y0 >= 0 && box.y1 <= box.fabTop;
      if (box) seen.add(box.tool);
      if (!ok) bad.push(`${label} step ${i} ${JSON.stringify(box)}`);
      if (label === "390x844" && i === 3) await shot(page, "390-wand-at-rest");
      if (label === "390x844" && i === 5) await shot(page, "390-lipstick-at-rest");
    }
    await S(page, () => window.__salon.debug.nextStep());
  }
}
/** RT1-props: at rest every tool (incl. the mascara wand's red heart tube and the lipstick) is fully on screen,
 *  above the Redo / Skip row, at 390x844 and 360x640 on every step that has a tool. */
async function checkToolsAtRest(browser) {
  const bad = [];
  const seen = new Set();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 640 },
  ]) {
    const k = await open(browser, { viewport, touch: true });
    await begin(k.page);
    await restOnEachStep(k.page, `${viewport.width}x${viewport.height}`, bad, seen);
    await k.ctx.close();
  }
  check(
    "RT1-props",
    "every tool (sponge, brush, wand with its heart tube, lipstick, sticker) rests fully on screen above Redo/Skip at 390x844 and 360x640",
    bad.length === 0 &&
      ["sponge", "brush", "wand", "lipstick", "sticker"].every((t) => seen.has(t)),
    bad.join(" | ") || [...seen].join(","),
  );
}

/** RT1-hair: the owner's reference hair is lemon yellow, brightly lit with little dark shading. Same pixel measure as
 *  the product panel's: pixels with hue 28-62deg, saturation >= .45 and value >= .5 on the 390x844 title screen. */
async function checkHairPalette(browser) {
  const k = await open(browser);
  await k.page.waitForTimeout(400); // title entrance
  const png = await k.page.screenshot({ type: "png" });
  const probe = await browser.newPage();
  const m = await probe.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    let hue = 0;
    let val = 0;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255;
      const gg = d[i + 1] / 255;
      const b = d[i + 2] / 255;
      const mx = Math.max(r, gg, b);
      const df = mx - Math.min(r, gg, b);
      if (mx < 0.5 || df === 0 || df / mx < 0.45) continue;
      let h = mx === r ? ((gg - b) / df + 6) % 6 : mx === gg ? (b - r) / df + 2 : (r - gg) / df + 4;
      h *= 60;
      if (h < 28 || h > 62) continue;
      n++;
      hue += h;
      val += mx;
      if (mx < 0.85) dark++;
    }
    return { n, hue: hue / n, val: val / n, dark: (dark / n) * 100 };
  }, png.toString("base64"));
  await probe.close();
  check(
    "RT1-hair",
    "hair reads lemon like the reference: mean brightness >= 0.96, <= 4% darkened pixels, hue 42-45 degrees",
    m.n > 20000 && m.val >= 0.96 && m.dark <= 4 && m.hue >= 41.8 && m.hue <= 45.2,
    `n=${m.n} hue=${m.hue.toFixed(1)} brightness=${m.val.toFixed(3)} darkened=${m.dark.toFixed(2)}%`,
  );
  await k.ctx.close();
}

// ---- real touch strokes (Playwright's touchscreen only taps), as the product panel's driver sends them ----
async function touchPen(k) {
  const cdp = await k.ctx.newCDPSession(k.page);
  const send = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  return {
    down: (x, y) => send("touchStart", [{ x, y, id: 1 }]),
    up: () => send("touchEnd", []),
    async stroke(points) {
      for (const [x, y] of points) {
        await send("touchMove", [{ x, y, id: 1 }]);
        await k.page.waitForTimeout(10); // pacing only: the outcome is read from the page afterwards
      }
    },
  };
}
/** Rows of a zigzag over a box: `rows`+1 horizontal passes of `per`+1 points, alternating direction. */
function zigzag([x0, y0, x1, y1], rows, per) {
  const pts = [];
  for (let r = 0; r <= rows; r++) {
    const y = y0 + ((y1 - y0) * r) / rows;
    for (let i = 0; i <= per; i++)
      pts.push([x0 + ((x1 - x0) * (r % 2 === 0 ? i : per - i)) / per, y]);
  }
  return pts;
}
/** Client-px box of the current step's paint region, once the camera has stopped gliding. */
async function settledBox(page) {
  const read = () =>
    S(page, () => {
      const d = window.__salon.debug;
      const c = d.regionCells().map(([x, y]) => d.unitsToClient(x, y));
      const xs = c.map((p) => p.x);
      const ys = c.map((p) => p.y);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(Math.round);
    });
  let prev = await read();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const now = await read();
    if (now.every((v, j) => Math.abs(v - prev[j]) <= 1)) return now;
    prev = now;
  }
  return prev;
}
const tipLift = (page) => S(page, () => window.__salon.debug.touchLift());

/** RT2-finger: a child who puts a FINGER on the target and scrubs (4 rows over the target's box, real touch events)
 *  paints it (>= 70%); one who aims the visible tool tip still completes it. The tool tip sits only a short, per-tool
 *  distance above the fingertip, shorter on the small targets. */
async function checkFingerOnTarget(browser) {
  const k = await open(browser, { touch: true });
  await begin(k.page);
  const pen = await touchPen(k);
  const rows = {};
  for (const id of ["shadow", "mascara", "blush", "lips"]) {
    await playTo(k.page, id);
    const box = await settledBox(k.page);
    const lift = await tipLift(k.page);
    await pen.down(box[0], box[1]);
    await pen.stroke(zigzag(box, 3, 10));
    await pen.up();
    const on = await progress(k.page);
    await k.page.locator("#clearBtn").click();
    const aimBox = [box[0], box[1] + lift, box[2], box[3] + lift];
    await pen.down(aimBox[0], aimBox[1]);
    await pen.stroke(zigzag(aimBox, 3, 10));
    await pen.up();
    rows[id] = { lift, on: +on.toFixed(2), aimed: +(await progress(k.page)).toFixed(2) };
  }
  const ids = Object.keys(rows);
  check(
    "RT2-finger",
    "finger ON the target, 4 scrub rows: shadow, mascara, blush and lips all reach >= 70%; aiming the visible tip completes them; the lift is <= 34px on the small targets (lips, blush, mascara)",
    ids.every((id) => rows[id].on >= 0.7 && rows[id].aimed >= 0.9) &&
      rows.lips.lift <= 30 &&
      rows.blush.lift <= 34 &&
      rows.mascara.lift <= 34,
    JSON.stringify(rows),
  );
  await k.ctx.close();
}

/** RT1-guide: a finger down on a paint step whose tip has not painted yet shows the dotted line + pulse and "Paint with
 *  the tip!"; it STAYS (no timer) until a stroke adds coverage, hides when the finger lifts, and never returns on a
 *  step where a stroke already painted; the next paint step shows it again. */
async function checkTipGuide(browser) {
  const k = await open(browser, { touch: true });
  await begin(k.page);
  const pen = await touchPen(k);
  const guideOn = () =>
    S(k.page, () => document.getElementById("tipGuide").classList.contains("on"));
  const guideOff = () =>
    k.page
      .waitForFunction(() => !document.getElementById("tipGuide").classList.contains("on"), null, {
        timeout: 2000,
      })
      .then(
        () => true,
        () => false,
      );
  await playTo(k.page, "shadow");
  const box = await settledBox(k.page);
  const lift = await tipLift(k.page);
  const away = [box[0] + 20, box[1] - 100]; // a fingertip well above the lids: the tip cannot reach them
  const before = await guideOn();
  await pen.down(...away);
  const first = await guideOn();
  const geometry = await S(k.page, () => ({
    line: Math.round(document.querySelector("#tipGuide i").getBoundingClientRect().height),
    said: document.getElementById("bubble").textContent,
  }));
  await k.page.waitForTimeout(2400); // longer than the old fixed 1.8 s timer
  const stays = await guideOn();
  const lid = await S(k.page, () => window.__salon.debug.regionPoint(0.5)); // a real eyelid cell
  await pen.stroke([
    [lid.x, lid.y + lift],
    [lid.x + 12, lid.y + lift + 2],
  ]); // the tip now reaches the lids
  const hidden = await guideOff();
  await pen.up();
  await pen.down(...away);
  const again = await guideOn(); // this step is learned: not again
  await pen.up();
  await playTo(k.page, "mascara");
  const box2 = await settledBox(k.page);
  const away2 = [box2[0] + 20, box2[1] - 100];
  await pen.down(...away2);
  const nextStep = await guideOn(); // a new paint step: shown again
  await pen.up();
  const liftedHides = await guideOff();
  await pen.down(...away2);
  const reshown = await guideOn(); // nothing painted yet, so a second touch shows it again
  await pen.up();
  check(
    "RT1-guide",
    "touch guide (dotted line + pulse + 'Paint with the tip!') shows while a finger is down until a stroke adds coverage; no fixed timer; not again once painted; next paint step shows it",
    !before &&
      first &&
      geometry.line === lift &&
      /tip/i.test(geometry.said) &&
      stays &&
      hidden &&
      !again &&
      nextStep &&
      liftedHides &&
      reshown,
    JSON.stringify({
      before,
      first,
      geometry,
      lift,
      stays,
      hidden,
      again,
      nextStep,
      liftedHides,
      reshown,
    }),
  );
  await k.ctx.close();
}

/** RT1-nudge: after ~4 s of nothing on a paint step a ring pulses on the target; a touch hides it; never with reduced
 *  motion. */
async function checkNudge(browser) {
  // idle nudge (mouse is fine: nothing is touched)
  const n = await open(browser);
  await begin(n.page);
  await playTo(n.page, "blush");
  const shown = await n.page
    .waitForFunction(() => document.getElementById("nudge").classList.contains("on"), null, {
      timeout: 8000,
    })
    .then(
      () => true,
      () => false,
    );
  const ring = await S(n.page, () => {
    const r = document.getElementById("nudge").getBoundingClientRect();
    return { w: Math.round(r.width), inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 };
  });
  const c = await S(n.page, () => window.__salon.debug.regionPoint(0.5));
  await n.page.mouse.move(c.x, c.y);
  await n.page.mouse.down();
  const hidden = await n.page
    .waitForFunction(() => !document.getElementById("nudge").classList.contains("on"), null, {
      timeout: 1500,
    })
    .then(
      () => true,
      () => false,
    );
  await n.page.mouse.up();
  await n.ctx.close();
  const r = await open(browser, { reduced: true });
  await begin(r.page);
  await playTo(r.page, "blush");
  const reducedShown = await r.page
    .waitForFunction(() => document.getElementById("nudge").classList.contains("on"), null, {
      timeout: 5500,
    })
    .then(
      () => true,
      () => false,
    );
  const reducedDisplay = await S(
    r.page,
    () => getComputedStyle(document.getElementById("nudge")).display,
  );
  await r.ctx.close();
  check(
    "RT1-nudge",
    "after ~4 s idle on a paint step a ring pulses on the target; a touch hides it; reduced motion never shows it",
    shown &&
      ring.w >= 60 &&
      ring.inside &&
      hidden &&
      reducedShown === false &&
      reducedDisplay === "none",
    JSON.stringify({ shown, ring, hidden, reducedShown, reducedDisplay }),
  );
}

/** AC-8c: before the step is done the button reads "Skip" on every step, the last one included. */
async function checkSkipLabel(browser) {
  const k = await open(browser);
  await begin(k.page);
  const labels = [];
  for (let i = 0; i < 8; i++) {
    labels.push(await k.page.locator("#nextTxt").innerText());
    if (i < 7) await goNext(k.page);
  }
  const aria = await k.page.locator("#nextBtn").getAttribute("aria-label");
  check(
    "AC-8c",
    "the Next button reads 'Skip' on all eight steps until the step is done (the last step's label says it takes the photo)",
    labels.every((t) => t === "Skip") && /photo/i.test(aria),
    labels.join(",") + " | " + aria,
  );
  await k.ctx.close();
}

/** R2-01 + R2-04: another tab unlocks the same item while our sheet is open -> the sheet closes, the item is used and
 *  nothing is charged; another tab muting the sound also silences this one (master gain follows). */
async function checkOtherTab(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(withCoins(200));
  const a = await ctx.newPage();
  const b = await ctx.newPage();
  await a.goto(URL);
  await b.goto(URL);
  await a.waitForFunction(() => window.__salon);
  await b.waitForFunction(() => window.__salon);
  await begin(a);
  await playTo(a, "shadow");
  await a.getByRole("button", { name: /Eye shadow: Mint, locked/ }).click();
  await a.waitForFunction(() => document.querySelector("#unlockModal.open"));
  await begin(b);
  await playTo(b, "shadow");
  await b.getByRole("button", { name: /Eye shadow: Mint, locked/ }).click();
  await b.locator("#unlockYes").click();
  await b.waitForFunction(() => window.__salon.saved.unlocked.includes("shadow:mint"));
  const closed = await a
    .waitForFunction(() => !document.querySelector("#unlockModal.open"), null, { timeout: 4000 })
    .then(
      () => true,
      () => false,
    );
  const bCoins = await S(b, () => window.__salon.coins); // 200 + the step coins both tabs earned - the 50 B paid
  const st = await S(a, () => ({
    coins: window.__salon.coins,
    saved: window.__salon.saved.coins,
    mints: window.__salon.saved.unlocked.filter((u) => u === "shadow:mint").length,
    used: !!document.querySelector('#tools .tool[data-opt="mint"][aria-pressed="true"]'),
  }));
  check(
    "R2-01",
    "another tab unlocked the item while our sheet was open: sheet closes, the item is used, no second charge",
    closed && st.coins === bCoins && st.saved === bCoins && st.mints === 1 && st.used,
    JSON.stringify({ closed, bCoins, ...st }),
  );
  // sound: A is playing music (a gesture unlocked audio); B mutes
  await a
    .waitForFunction(() => window.__salon.audio.gain > 0.5, null, { timeout: 8000 })
    .catch(() => {});
  const gain0 = await S(a, () => window.__salon.audio.gain);
  await b.locator("#soundBtn2").click();
  const muted = await a
    .waitForFunction(
      () => window.__salon.audio.on === false && window.__salon.audio.gain < 0.05,
      null,
      {
        timeout: 4000,
      },
    )
    .then(
      () => true,
      () => false,
    );
  const pressed = await a.locator("#soundBtn2").getAttribute("aria-pressed");
  await b.locator("#soundBtn2").click();
  const back = await a
    .waitForFunction(
      () => window.__salon.audio.on === true && window.__salon.audio.gain > 0.5,
      null,
      {
        timeout: 4000,
      },
    )
    .then(
      () => true,
      () => false,
    );
  check(
    "R2-04",
    "sound switched in another tab reaches this tab's audio graph (master gain 0 / 0.9), not just its toggle",
    gain0 > 0.5 && muted && pressed === "false" && back,
    JSON.stringify({ gain0, muted, pressed, back }),
  );
  await ctx.close();
}

/** R2-02: the request sheet's wishes grid is 2 columns unless there is room for 4 (short AND >= 480 wide), and never
 *  overflows sideways. */
async function checkWantsGrid(browser) {
  const bad = [];
  for (const [w, h, cols] of [
    [320, 480, 2],
    [375, 540, 2],
    [390, 500, 2],
    [360, 300, 2],
    [479, 400, 2],
    [568, 320, 4],
    [844, 390, 4],
    [390, 844, 2],
  ]) {
    const k = await open(browser, { viewport: { width: w, height: h } });
    await startBtn(k.page).click();
    await k.page.waitForFunction(() => document.querySelector("#reqModal.open"));
    const r = await S(k.page, () => {
      const m = document.getElementById("reqModal");
      const sheet = m.querySelector(".sheet").getBoundingClientRect();
      const ul = document.getElementById("reqWants");
      return {
        cols: getComputedStyle(ul).gridTemplateColumns.split(" ").length,
        over:
          m.scrollWidth > m.clientWidth ||
          document.documentElement.scrollWidth > innerWidth ||
          [...ul.children].some(
            (li) =>
              li.getBoundingClientRect().right > sheet.right + 0.5 ||
              li.scrollWidth > li.clientWidth + 1,
          ),
      };
    });
    if (r.cols !== cols || r.over) bad.push(`${w}x${h} ${JSON.stringify(r)}`);
    await k.ctx.close();
  }
  check(
    "R2-02",
    "request sheet wishes: 2 columns below 480px wide (4 only on short landscape), no horizontal overflow at 320x480 .. 844x390",
    bad.length === 0,
    bad.join(" | "),
  );
}

/** R2-03: on short phones "New best" is not under the sticky button bar, and the landscape stars row is not clipped. */
async function checkResultsLayout(browser) {
  const bad = [];
  for (const [w, h] of [
    [360, 640],
    [320, 568],
    [375, 667],
    [568, 320],
  ]) {
    const k = await open(browser, { viewport: { width: w, height: h } });
    await begin(k.page);
    await S(k.page, () => window.__salon.debug.skipToResults());
    await k.page.waitForFunction(
      () =>
        window.__salon.phase === "results" &&
        document.getElementById("resBest").textContent &&
        !document.getElementById("resActions").hidden,
      null,
      { timeout: 12000 },
    );
    const at = (top) =>
      S(
        k.page,
        (t) => {
          const res = document.getElementById("results");
          res.scrollTop = t ? res.scrollHeight : 0;
          const R = (id) => document.querySelector(id).getBoundingClientRect();
          return {
            bestBottom: R("#resBest").bottom,
            barTop: R("#resActions").top,
            starsTop: R("#stars").top,
            titleTop: R(".res-title").top,
            hscroll: res.scrollWidth > res.clientWidth,
          };
        },
        top,
      );
    const top = await at(false);
    const end = await at(true);
    const portrait = h > w;
    const covered = portrait && top.bestBottom > top.barTop + 1;
    const coveredEnd = end.bestBottom > end.barTop + 1;
    const clipped = top.starsTop < 0 || top.titleTop < 0;
    if (covered || coveredEnd || clipped || top.hscroll)
      bad.push(`${w}x${h} ${JSON.stringify({ top, end })}`);
    await k.ctx.close();
  }
  check(
    "R2-03",
    "results at 360x640, 320x568, 375x667 and 568x320: 'New best' clear of the button bar (at the top on portrait, always at the end), stars/title not clipped",
    bad.length === 0,
    bad.join(" | "),
  );
}

/** R2-05 + R2-06: the "+10 coins" cheer only when coins were paid; unique ids; every --sp token is used; the lock
 *  glyph clears 3:1 on its badge. */
async function checkHousekeeping(browser) {
  const k = await open(browser);
  await begin(k.page);
  await playTo(k.page, "acc");
  const tiara = k.page.getByRole("button", { name: /Tiara: Pearl tiara/ });
  await tiara.click();
  const first = await S(k.page, () => document.getElementById("bubble").textContent);
  await tiara.click(); // off: the step re-opens
  await S(k.page, () => {
    document.getElementById("bubble").textContent = "";
  });
  await tiara.click(); // on again: completes a second time, already paid
  const second = await S(k.page, () => document.getElementById("bubble").textContent);
  await k.ctx.close();

  const t = await open(browser);
  await begin(t.page);
  await playTo(t.page, "shadow");
  const css = await S(t.page, () => {
    const lin = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const badge = document.querySelector(".tool.locked .badge");
    const bg = getComputedStyle(badge)
      .backgroundColor.match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
    const contrast = (lum([255, 255, 255]) + 0.05) / (lum(bg) + 0.05);
    const text = [...document.querySelectorAll("style")].map((e) => e.textContent).join("\n");
    const defined = [...text.matchAll(/^\s*(--sp-[a-z0-9-]+):/gm)].map((m) => m[1]);
    const unused = defined.filter((d) => !text.includes(`var(${d}`));
    const ids = {};
    for (const e of document.querySelectorAll("[id]")) ids[e.id] = (ids[e.id] || 0) + 1;
    return {
      contrast,
      unused,
      dupes: Object.keys(ids).filter((i) => ids[i] > 1),
    };
  });
  await t.ctx.close();
  check(
    "R2-05",
    "the '+10 coins' cheer appears only when the step actually paid (not when Accessories is re-completed)",
    /\+10 coins/.test(first) && second.length > 0 && !/coins/.test(second),
    JSON.stringify({ first, second }),
  );
  check(
    "R2-06",
    "no duplicate ids, no unused --sp-* token, the lock glyph clears 3:1 on its badge",
    css.dupes.length === 0 && css.unused.length === 0 && css.contrast >= 3,
    JSON.stringify(css),
  );
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
    // poll instead of sleeping a fixed 400 ms: a loaded machine runs fewer frames per second but still advances them
    const t0 = Date.now();
    const advanced = await page
      .waitForFunction((from) => window.__salon.frame - from >= 8, fA, { timeout: 4000 })
      .then(
        () => true,
        () => false,
      );
    const fB = await S(page, () => window.__salon.frame);
    check(
      "AC-2b",
      "RAF loop runs while playing (frame increments)",
      advanced,
      `+${fB - fA} frames in ${Date.now() - t0}ms`,
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
      "Play again starts a new makeover (new client card, phase=playing); the hub link (now the round 'Back to PlayPad' icon) still goes to the hub",
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
          /\/(games\/sparkle-salon\/(index\.html)?|styles\/(tokens|base)\.css|icons\/favicon\.svg|scripts\/viewport\.js)$/.test(
            u.split("?")[0],
          ) || u === BASE + "/",
      );
    check(
      "AC-17",
      "no console errors / failed requests, and nothing fetched beyond the page + shared css + favicon + viewport.js (no theme.js: the salon is pinned light)",
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
      await t.page.touchscreen.tap(p.x, p.y + (await tipLift(t.page)));
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
      ["1024x1366", 1024, 1366], // iPad portrait (v2 AC-22.5)
      ["1366x1024", 1366, 1024], // iPad landscape: the right-hand tool bar (v2 AC-22.5)
      ["1024x768", 1024, 768], // iPad landscapes of the 9th / 10th gen, Air and Pro 11 (v2 AC-22.5, AC-22.6)
      ["1080x810", 1080, 810],
      ["1180x820", 1180, 820],
      ["1194x834", 1194, 834],
      ["768x1024", 768, 1024], // ... and their portraits
      ["810x1080", 810, 1080],
      ["834x1194", 834, 1194],
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
      if (["1280x800", "844x390", "1024x1366", "1366x1024"].includes(label))
        await shot(v.page, label + "-play");
      await S(v.page, () => window.__salon.debug.skipToResults());
      await v.page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10000,
      });
      const againBox = await v.page.locator("#againBtn").boundingBox();
      const againInside = againBox && againBox.y + againBox.height <= hgt + 1 && againBox.y >= 0;
      if (["1280x800", "844x390", "1024x1366", "1366x1024"].includes(label))
        await shot(v.page, label + "-results");
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

    // ------------------------------------------------------------------ RT-1 (product panel) + round-2 QA
    await checkToolsAtRest(browser);
    await checkHairPalette(browser);
    await checkFingerOnTarget(browser);
    await checkTipGuide(browser);
    await checkNudge(browser);
    await checkSkipLabel(browser);
    await checkOtherTab(browser);
    await checkWantsGrid(browser);
    await checkResultsLayout(browser);
    await checkHousekeeping(browser);

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
