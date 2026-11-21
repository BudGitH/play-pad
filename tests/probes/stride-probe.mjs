// stride-probe.mjs — headless WebGL probes for Sunset Stride (dev-only; not part of `npm run smoke`).
//
// Drives the game through its deterministic test hook (window.__stride) and prints one PASS/FAIL line per
// acceptance criterion in features/sunset-stride/test-plan.md. Exit code 1 if anything fails.
//
//   node tools/serve.mjs 5599 &                       # static server (same one the smoke test uses)
//   PW_CHROMIUM_PATH=/path/to/chrome node tests/probes/stride-probe.mjs   # PW_CHROMIUM_PATH optional
//
// WebGL runs in software (SwiftShader), so this is slow-ish (~1–2 min) but needs no GPU.
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:5599";
const URL = `${BASE}/games/sunset-stride/`;
const ARGS = [
  "--use-angle=swiftshader",
  "--use-gl=angle",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--no-sandbox",
];

const results = [];
function check(id, name, ok, detail = "") {
  results.push({ id, name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}${detail ? "  — " + detail : ""}`);
}

async function launch() {
  return chromium.launch({ args: ARGS, executablePath: process.env.PW_CHROMIUM_PATH || undefined });
}
async function openGame(
  browser,
  { viewport = { width: 1000, height: 620 }, init, url = URL, mobile = false } = {},
) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  await page.goto(url);
  return { ctx, page, errors };
}
const S = (page, fn, arg) => page.evaluate(fn, arg);
async function waitModels(page) {
  await page.waitForFunction(
    () => window.__stride && window.__stride.world.glbRunner && window.__stride.world.glbDogs,
    null,
    {
      timeout: 30000,
    },
  );
}
// Keep the run alive and uncluttered while a probe inspects a state.
const calm = (page) =>
  S(page, () => {
    const s = window.__stride;
    s.clearObstacles();
    s.three.player.invulnT = 0;
  });

// AC1 (static): the rename is complete in everything that ships. History (docs/, features/) is exempt.
function staticChecks() {
  const redirects = readFileSync("_redirects", "utf8");
  check(
    "AC1",
    "_redirects 301s the old URL (bare, slash and nested) to the new game",
    /\/games\/neon-rush\s+\/games\/sunset-stride\/\s+301/.test(redirects) &&
      /\/games\/neon-rush\/\*\s+\/games\/sunset-stride\/\s+301/.test(redirects),
  );
  const shipped = [
    "README.md",
    "LICENSE",
    "CLAUDE.md",
    "games.js",
    "_headers",
    "index.html",
    "tests/round-drivers.mjs",
    "docs/ARCHITECTURE.md",
    "docs/CONVENTIONS.md",
  ];
  const walk = (dir) =>
    readdirSync(dir).flatMap((f) => {
      const p = `${dir}/${f}`;
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  walk("games/sunset-stride")
    .filter((p) => /\.(html|js|md|txt|css)$/.test(p) && !p.endsWith("three.min.js"))
    .forEach((p) => shipped.push(p));
  // The ONLY allowed mentions: the rename notes and the one-time legacy-key import (exact phrases, not "any
  // line that says legacy"). Everything else, e.g. a stale games/neon-rush/ path, is a failure.
  const ALLOWED = [
    /formerly Neon Rush/i,
    /was Neon Rush/,
    /ex-Neon Rush/,
    /Neon Rush → Sunset Stride/,
    /playpad\.neonRush\.v1/,
  ];
  const STALE = /neon[\s-]*rush|neonRush|__neon/i;
  const real = shipped.filter((p) =>
    readFileSync(p, "utf8")
      .split("\n")
      .some((l) => STALE.test(l) && !ALLOWED.some((a) => a.test(l))),
  );
  check(
    "AC1",
    "no stale Neon Rush references in shipped files (except documented rename notes)",
    real.length === 0,
    real.join(", "),
  );
  const reg = readFileSync("games.js", "utf8");
  check(
    "AC1",
    "registry entry is Sunset Stride with the new path and save key",
    /id: "sunset-stride"/.test(reg) &&
      /title: "Sunset Stride"/.test(reg) &&
      /playpad\.sunsetStride\.v1/.test(reg),
  );
}

async function main() {
  staticChecks();
  const browser = await launch();

  /* ---- main session: AC1 AC2 AC3 AC4 AC5 AC6 AC9 ---- */
  const { ctx, page, errors } = await openGame(browser);
  await waitModels(page);

  const title = await page.locator("h1").first().textContent();
  check(
    "AC1",
    "setup H1 + document title say Sunset Stride",
    title.trim() === "Sunset Stride" && (await page.title()).startsWith("Sunset Stride"),
    `h1="${title.trim()}"`,
  );
  const visible = await page.locator("body").innerText();
  check("AC1", "no user-visible 'Neon Rush' on the setup screen", !/neon\s*rush/i.test(visible));

  // the countdown ("ready" pose) must also never show a bind pose. Click and read in ONE page task: the
  // real 3-2-1 is only ~1.2 s and software WebGL frames are slow, so polling for it would race.
  const cd = await S(page, () => {
    document.getElementById("startBtn").click();
    return window.__stride.skin;
  });
  check(
    "AC3",
    "countdown: GLB runner in the ready pose at weight 1 (no bind pose)",
    cd.kind === "glb" && cd.state === "ready" && Math.abs(cd.weights.__sum - 1) < 0.01,
    `state=${cd.state} sum=${cd.weights.__sum}`,
  );
  await page.waitForFunction(() => window.__stride.state.phase === "running", null, {
    timeout: 30000,
  });
  await page.evaluate(() => window.__stride.freeze(true));
  const dogKinds = await S(page, () => window.__stride.dogs.list.map((d) => d.kind));
  check(
    "AC5",
    "the pack is the GLB dogs (not the primitive fallback)",
    dogKinds.length === 3 && dogKinds.every((k) => k === "glb"),
    dogKinds.join(","),
  );
  await S(page, () => window.__stride.seed(7));
  await calm(page);

  // AC3/AC4: animation truth — clip weights always sum to 1, never a bind pose
  const samples = [];
  await S(page, () => window.__stride.step(400));
  for (let i = 0; i < 6; i++) {
    await S(page, () => window.__stride.step(90));
    samples.push(await S(page, () => window.__stride.skin));
  }
  const sumsOk = samples.every(
    (k) => k.kind === "glb" && Math.abs(k.weights.__sum - 1) < 0.01 && k.visible,
  );
  const legGaps = samples.map((k) => k.legGap);
  const spans = samples.map((k) => k.handSpan);
  check(
    "AC3",
    "running: GLB runner visible, clip weights sum to 1",
    sumsOk,
    `sums=${samples.map((k) => k.weights.__sum).join(",")}`,
  );
  check(
    "AC3",
    "running: not a T-pose (hand span well under arm span)",
    Math.max(...spans) < 1.3,
    `handSpan max=${Math.max(...spans)}`,
  );
  check(
    "AC4",
    "running: legs move between frames",
    Math.max(...legGaps) - Math.min(...legGaps) > 0.15,
    `legGap ${Math.min(...legGaps)}..${Math.max(...legGaps)}`,
  );

  // jump → land
  await S(page, () => window.__stride.input("jump"));
  const jumpSamples = [];
  for (let i = 0; i < 12; i++) {
    await S(page, () => window.__stride.step(80));
    jumpSamples.push(
      await S(page, () => ({
        w: window.__stride.skin.weights.__sum,
        y: window.__stride.state.playerY,
        st: window.__stride.skin.state,
      })),
    );
  }
  check(
    "AC3",
    "jump + landing never dips below weight 1 (no bind-pose frame)",
    jumpSamples.every((k) => Math.abs(k.w - 1) < 0.01),
    `min=${Math.min(...jumpSamples.map((k) => k.w))}`,
  );
  check(
    "AC4",
    "jump leaves the ground and comes back",
    jumpSamples.some((k) => k.y > 1.2) && jumpSamples[jumpSamples.length - 1].y === 0,
    `apex=${Math.max(...jumpSamples.map((k) => k.y)).toFixed(2)}`,
  );

  // slide: authored pose, no squash
  await calm(page);
  await S(page, () => {
    window.__stride.input("slide");
    window.__stride.step(220);
  });
  const sl = await S(page, () => ({ k: window.__stride.skin, st: window.__stride.state }));
  check(
    "AC4",
    "slide: pose layer at ~1, model uniformly scaled (not squashed)",
    sl.k.weights.slide > 0.9 && sl.k.scaleUniform === true && sl.st.sliding,
    `slide=${sl.k.weights.slide} uniform=${sl.k.scaleUniform}`,
  );
  check(
    "AC4",
    "slide: body is low (lowest bone near the ground, torso height small)",
    sl.k.lowestBoneY <= 0.3 && sl.k.spread.y < 1.05,
    `lowest=${sl.k.lowestBoneY} spreadY=${sl.k.spread.y}`,
  );
  check("AC3", "slide: weights still sum to 1", Math.abs(sl.k.weights.__sum - 1) < 0.01);
  await S(page, () => window.__stride.step(900));

  // AC6d: a jump cancels a slide
  await calm(page);
  const cancel = await S(page, () => {
    const s = window.__stride;
    s.input("slide");
    s.step(100);
    const wasSliding = s.state.sliding;
    s.input("jump");
    s.step(32);
    return { wasSliding, sliding: s.state.sliding, y: s.state.playerY };
  });
  check(
    "AC6",
    "jump during a slide cancels it",
    cancel.wasSliding && !cancel.sliding && cancel.y > 0,
    JSON.stringify(cancel),
  );
  await S(page, () => window.__stride.step(1200));

  // AC6c: buffered jump fires on landing
  await calm(page);
  const buf = await S(page, () => {
    const s = window.__stride;
    s.input("jump");
    s.step(700); // near the end of the ~0.78 s airtime
    s.input("jump"); // too early: buffered
    s.step(200);
    return { y: s.state.playerY };
  });
  check(
    "AC6",
    "a jump pressed just before landing is buffered and fires",
    buf.y > 0.15,
    `y=${buf.y.toFixed(2)}`,
  );
  await S(page, () => window.__stride.step(1400));

  // AC5 + AC6a: chasers behind the runner, stumble then caught
  await calm(page);
  await S(page, () => window.__stride.setGap(3.8));
  const before = await S(page, () => window.__stride.dogs);
  await S(page, () => window.__stride.hit());
  await S(page, () => window.__stride.step(250));
  const afterHit = await S(page, () => ({ d: window.__stride.dogs, st: window.__stride.state }));
  const behind = afterHit.d.list.every((d) => d.z > 0);
  const near = Math.min(...afterHit.d.list.map((d) => d.z));
  check(
    "AC5",
    "dogs are always behind the runner (z > 0), before and after a hit",
    before.list.every((d) => d.z > 0) && behind,
    `nearest z=${near}`,
  );
  check(
    "AC5",
    "after a hit the nearest dog closes to ≤ 2.2 m and is on screen",
    near <= 2.2 && afterHit.d.list.some((d) => d.onScreen),
    `near=${near} onScreen=${afterHit.d.list.map((d) => d.onScreen)}`,
  );
  check(
    "AC6",
    "first frontal hit is a stumble: run continues, speed drops, i-frames on",
    afterHit.st.phase === "running" &&
      afterHit.st.hits === 1 &&
      afterHit.st.speedMul < 0.9 &&
      afterHit.st.invulnT > 0,
    JSON.stringify({
      ph: afterHit.st.phase,
      hits: afterHit.st.hits,
      mul: +afterHit.st.speedMul.toFixed(2),
    }),
  );
  const stum = await S(page, () => window.__stride.skin.weights.stumble);
  check("AC3", "stumble pose engages while hit", stum > 0.3, `stumble=${stum}`);
  await S(page, () => {
    window.__stride.clearObstacles();
    window.__stride.step(1700); // i-frames over, dogs still close
  });
  const close = await S(page, () => window.__stride.state);
  await S(page, () => window.__stride.hit());
  const caught = await S(page, () => window.__stride.state.phase);
  check(
    "AC6",
    "second hit while the dogs are close ends the run",
    close.gap < 2.7 && caught === "crashed",
    `gap=${close.gap.toFixed(2)} phase=${caught}`,
  );
  const dead = await S(page, () => {
    window.__stride.step(200);
    return window.__stride.skin;
  });
  check(
    "AC3",
    "caught: death animation plays at weight 1, no bind pose",
    dead.weights.Death > 0.9 && Math.abs(dead.weights.__sum - 1) < 0.01,
    `Death=${dead.weights.Death}`,
  );

  // results screen + persistence write
  await page.waitForFunction(
    () => document.getElementById("results").classList.contains("active"),
    null,
    { timeout: 8000 },
  );
  check(
    "AC6",
    "results screen shows 'Caught!'",
    (await page.locator("#resTitle").textContent()).trim() === "Caught!",
  );

  // retry → clean run for the remaining mechanics
  await page.locator("#againBtn").click();
  await page.waitForFunction(() => window.__stride.state.phase === "running", null, {
    timeout: 15000,
  });
  await S(page, () => window.__stride.seed(11));

  // AC5 recovery: clean running makes the pack fall back
  await S(page, () => {
    const s = window.__stride;
    s.clearObstacles();
    s.hit();
  });
  for (let i = 0; i < 10; i++) {
    await S(page, () => {
      window.__stride.clearObstacles();
      window.__stride.step(600);
    });
  }
  const rec = await S(page, () => window.__stride.state);
  check(
    "AC5",
    "after ~6 s clean the dogs fall back to ≥ 3.5 m",
    rec.gap >= 3.5 && rec.phase === "running",
    `gap=${rec.gap.toFixed(2)}`,
  );

  // AC6b: side-scrape bounce, never fatal
  await S(page, () => {
    const s = window.__stride;
    s.clearObstacles();
    s.setGap(3.8);
    s.three.player.invulnT = 0;
  });
  const scrape = await S(page, () => {
    const s = window.__stride;
    s.forceSpawn("van", 0, -2.4);
    s.input("left");
    s.step(120);
    return { st: s.state, hits: s.state.hits };
  });
  check(
    "AC6",
    "lane-change into a van bounces you back, never fatal",
    scrape.st.phase === "running" && scrape.st.lane === 1 && scrape.st.gap < 3.5,
    JSON.stringify({ ph: scrape.st.phase, lane: scrape.st.lane, gap: +scrape.st.gap.toFixed(2) }),
  );

  // AC6e: close call
  await S(page, () => {
    const s = window.__stride;
    s.clearObstacles();
    s.setGap(3.0);
    s.three.player.invulnT = 0;
  });
  const cc = await S(page, () => {
    const s = window.__stride;
    const before = s.state;
    s.forceSpawn("van", 1, -3.5);
    s.input("left");
    s.step(1500);
    return { before, after: s.state };
  });
  check(
    "AC6",
    "late dodge past a van = close call: +10 score, dogs pushed back",
    cc.after.closeCalls === cc.before.closeCalls + 1 && cc.after.gap > cc.before.gap,
    `closeCalls=${cc.after.closeCalls} gap ${cc.before.gap.toFixed(2)}→${cc.after.gap.toFixed(2)}`,
  );

  // AC6: slide passes under a bar, a standing runner does not
  await S(page, () => {
    const s = window.__stride;
    s.clearObstacles();
    s.three.player.invulnT = 0;
    s.setGap(3.8);
  });
  const under = await S(page, () => {
    const s = window.__stride;
    const hits0 = s.state.hits;
    s.forceSpawn("bar", s.state.lane, -9);
    s.step(380);
    s.input("slide");
    s.step(900);
    return { st: s.state, hits0 };
  });
  check(
    "AC6",
    "sliding under an overhead bar is safe",
    under.st.hits === under.hits0 && under.st.phase === "running",
    `hits ${under.hits0}→${under.st.hits}`,
  );
  const over = await S(page, () => {
    const s = window.__stride;
    s.clearObstacles();
    s.three.player.invulnT = 0;
    s.setGap(3.8); // calm: the hit is a stumble, not a catch
    const hits0 = s.state.hits;
    s.forceSpawn("bar", s.state.lane, -9);
    s.step(1200); // standing (and not sliding): the bar is a hit
    return { hits0, hits: s.state.hits };
  });
  check(
    "AC6",
    "a standing runner does hit the overhead bar (stumble)",
    over.hits === over.hits0 + 1,
    `hits ${over.hits0}→${over.hits}`,
  );

  // AC12: game feel — every effect fires its sound and its particles
  await S(page, () => {
    const s = window.__stride;
    s.clearObstacles();
    s.setGap(3.8);
    s.three.player.invulnT = 0;
  });
  const feelBefore = await S(page, () => ({
    a: window.__stride.audio.played,
    e: window.__stride.fx.emitted,
  }));
  const feel = await S(page, () => {
    const s = window.__stride;
    s.step(1500); // footfalls
    s.input("jump");
    s.step(900); // take-off + landing
    const first = s.state.lane === 0 ? "right" : "left"; // never push against a wall: both moves must switch lanes
    s.input(first);
    s.step(300);
    s.input(first === "left" ? "right" : "left");
    s.step(300); // lane swooshes
    s.input("slide");
    s.step(500); // skid
    s.forceSpawn("coinRow", s.state.lane, -3);
    s.step(1500); // a run of coins: the chime climbs
    const mid = { a: s.audio, e: s.fx };
    s.three.player.invulnT = 0;
    s.hit(); // stumble: thud + bark + debris + stars
    s.step(120);
    return { mid, after: { a: s.audio, fx: s.fx } };
  });
  const d = (k) => (feel.after.a.played[k] || 0) - (feelBefore.a[k] || 0);
  check(
    "AC12",
    "audio fires for footsteps, jump, landing, swooshes, skid, coins, thud and barks (wind bed on, music tempo follows speed)",
    d("step") >= 3 &&
      d("jump") >= 1 &&
      d("land") >= 1 &&
      d("swoosh") >= 2 &&
      d("slide") >= 1 &&
      d("coin") >= 3 &&
      d("bump") >= 1 &&
      d("bark") >= 1 &&
      feel.mid.a.streak >= 3 &&
      feel.after.a.wind === true &&
      feel.after.a.musicRate >= 1,
    JSON.stringify({
      step: d("step"),
      land: d("land"),
      swoosh: d("swoosh"),
      coin: d("coin"),
      streak: feel.mid.a.streak,
      bump: d("bump"),
      wind: feel.after.a.wind,
    }),
  );
  check(
    "AC12",
    "particles: dust, sparkles and impact debris are emitted and alive (pool never overflows)",
    feel.after.fx.emitted - feelBefore.e > 40 &&
      feel.after.fx.soft > 0 &&
      feel.after.fx.glow > 0 &&
      feel.after.fx.soft <= 360 &&
      feel.after.fx.glow <= 200,
    JSON.stringify(feel.after.fx),
  );
  const tiers = await S(page, () => {
    const s = window.__stride,
      out = {};
    ["low", "medium", "high"].forEach((t) => {
      s.setQuality(t);
      out[t] = s.fx.mult;
    });
    return out;
  });
  check(
    "AC12",
    "particle density scales with the quality tier (low < medium < high)",
    tiers.low < tiers.medium && tiers.medium < tiers.high,
    JSON.stringify(tiers),
  );

  // AC2: legibility — mean luminance of the rendered frame, and obstacle shapes visible
  const lum = await S(page, () => {
    const s = window.__stride,
      T = window.THREE,
      r = s.three.renderer;
    s.clearObstacles();
    ["hurdle", "crates", "bar"].forEach((t, i) => s.forceSpawn(t, i, -14));
    s.forceSpawn("van", 1, -34);
    s.step(16);
    const rt = new T.WebGLRenderTarget(96, 54);
    rt.texture.encoding = T.sRGBEncoding;
    r.setRenderTarget(rt);
    r.render(s.three.scene, s.three.camera);
    const px = new Uint8Array(96 * 54 * 4);
    r.readRenderTargetPixels(rt, 0, 0, 96, 54, px);
    r.setRenderTarget(null);
    let sum = 0;
    for (let i = 0; i < px.length; i += 4)
      sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    return sum / (px.length / 4);
  });
  check(
    "AC2",
    "scene is bright (mean luminance ≥ 0.40; the neon night was ≈ 0.12)",
    lum >= 0.4,
    `mean luminance=${lum.toFixed(3)}`,
  );

  // AC9: draw-call budget + camera + pause
  await S(page, () => window.__stride.setQuality("high"));
  await S(page, () => window.__stride.step(100));
  const hi = await S(page, () => window.__stride.render);
  await S(page, () => window.__stride.setQuality("low"));
  await S(page, () => window.__stride.step(100));
  const lo = await S(page, () => window.__stride.render);
  check(
    "AC9",
    "draw calls ≤ 170 on high and ≤ 110 on low",
    hi.drawCalls <= 170 && lo.drawCalls <= 110,
    `high=${hi.drawCalls} low=${lo.drawCalls}`,
  );
  const cam = await S(page, () => window.__stride.camera);
  check(
    "AC9",
    "all three lanes visible ahead",
    cam.laneVisible.every(Boolean),
    JSON.stringify(cam.laneVisible),
  );
  await S(page, () => window.dispatchEvent(new Event("blur")));
  const paused = await S(page, () => window.__stride.state.paused);
  await S(page, () => window.__stride.resume());
  check(
    "AC9",
    "window blur pauses the run; resume replays the countdown",
    paused === true && (await S(page, () => window.__stride.state.phase)) === "countdown",
  );

  // soak: 3 minutes of sim at speed with i-frames held on — pools stable, no NaN
  await S(page, () => {
    window.__stride.forceRun();
    window.__stride.setSpeed(24);
  });
  let geo0 = null;
  let soakOk = true;
  let maxObs = 0;
  for (let i = 0; i < 90; i++) {
    const st = await S(page, () => {
      const s = window.__stride;
      s.three.player.invulnT = 99;
      s.step(2000);
      return { st: s.state, g: s.render.geometries };
    });
    if (i === 60) geo0 = st.g; // pools reach steady state by then (new obstacle kinds unlock with distance)
    if (!Number.isFinite(st.st.score) || !Number.isFinite(st.st.speed)) soakOk = false;
    maxObs = Math.max(maxObs, st.st.activeObstacles);
    // Pools grow only while a new worst-case overlap shows up (a slalom needs ~8 vans at once), then stop.
    if (i === 89)
      check(
        "AC9",
        "3-minute soak: no NaN, geometry count bounded, active obstacles bounded",
        soakOk && st.g <= geo0 + 24 && st.g < 220 && maxObs <= 24,
        `geometries ${geo0}→${st.g} maxObs=${maxObs}`,
      );
  }
  check(
    "AC9",
    "no uncaught page errors / console errors in the main session",
    errors.length === 0,
    errors.slice(0, 3).join(" | "),
  );
  await ctx.close();

  /* ---- AC7 persistence ---- */
  {
    const a = await openGame(browser);
    await waitModels(a.page);
    await S(a.page, () => window.__stride.grantCoins(120));
    await a.page.reload();
    await a.page.waitForFunction(() => window.__stride);
    const saved = await S(a.page, () => window.__stride.save);
    check(
      "AC7",
      "coins persist under playpad.sunsetStride.v1",
      saved.coins === 120,
      `coins=${saved.coins}`,
    );
    await a.ctx.close();

    const legacy = await openGame(browser, {
      init: () => {
        if (!localStorage.getItem("playpad.sunsetStride.v1"))
          localStorage.setItem(
            "playpad.neonRush.v1",
            JSON.stringify({
              v: 1,
              coins: 777,
              unlocked: ["urban"],
              equipped: "urban",
              highScore: 4321,
              muted: true,
            }),
          );
      },
    });
    await legacy.page.waitForFunction(() => window.__stride);
    const imp = await S(legacy.page, () => window.__stride.save);
    check(
      "AC7",
      "legacy coins / best / mute imported once; old skins dropped",
      imp.coins === 777 &&
        imp.highScore === 4321 &&
        imp.muted === true &&
        imp.equipped === "morning",
      JSON.stringify(imp),
    );
    await legacy.ctx.close();

    const bad = await openGame(browser, {
      init: () => localStorage.setItem("playpad.sunsetStride.v1", "{not json"),
    });
    await bad.page.waitForFunction(() => window.__stride);
    const def = await S(bad.page, () => window.__stride.save);
    check(
      "AC7",
      "corrupt save falls back to defaults",
      def.coins === 0 && def.equipped === "morning" && bad.errors.length === 0,
      bad.errors.join("|"),
    );
    await bad.ctx.close();
  }

  /* ---- hostile save + hardened test hook (RISK lens) ---- */
  {
    const evil = await openGame(browser, {
      init: () =>
        localStorage.setItem(
          "playpad.sunsetStride.v1",
          JSON.stringify({
            v: 1,
            coins: "7",
            unlocked: ["morning", "morning", "morning", "bogus", "__proto__"],
            equipped: "__proto__",
            highScore: 1e308,
            muted: "false",
          }),
        ),
    });
    await evil.page.waitForFunction(() => window.__stride);
    const e = await S(evil.page, () => {
      const s = window.__stride;
      s.grantCoins("abc");
      s.grantCoins(NaN);
      s.setQuality("__proto__");
      return { save: s.save, tier: s.quality.tier, dpr: s.quality.dpr };
    });
    check(
      "AC7",
      "hostile save: strings / dupes / proto keys sanitised; hook rejects NaN coins and a bogus quality tier",
      e.save.coins === 7 &&
        e.save.unlocked.length === 1 &&
        e.save.equipped === "morning" &&
        e.save.highScore === 1e9 && // 1e308 is clamped to the 1e9 ceiling, not trusted
        e.save.muted === false &&
        e.tier === "medium" &&
        Number.isFinite(e.dpr),
      JSON.stringify({ save: e.save, tier: e.tier }),
    );
    await evil.ctx.close();
  }

  /* ---- shop + skins: buy, equip, 3D thumbnails ---- */
  {
    const shop = await openGame(browser, {
      init: () =>
        localStorage.setItem(
          "playpad.sunsetStride.v1",
          JSON.stringify({
            v: 1,
            coins: 5000,
            unlocked: ["morning"],
            equipped: "morning",
            highScore: 0,
            muted: true,
          }),
        ),
    });
    await waitModels(shop.page);
    await shop.page.waitForFunction(() => window.__stride.world.skinTextures.length === 6, null, {
      timeout: 20000,
    });
    await shop.page.locator("#setupShopBtn").click();
    const thumbs = await S(shop.page, () => window.__stride.thumbs());
    check(
      "AC4",
      "shop renders a 3D thumbnail for every outfit",
      thumbs.every((t) => t.ok && t.bytes > 1500),
      JSON.stringify(thumbs.map((t) => t.bytes)),
    );
    await shop.page.getByRole("button", { name: /Buy Park Ranger/ }).click();
    const after = await S(shop.page, () => window.__stride.save);
    check(
      "AC7",
      "buying an outfit spends coins, unlocks and equips it",
      after.equipped === "ranger" && after.coins === 4750 && after.unlocked.includes("ranger"),
      JSON.stringify({ eq: after.equipped, coins: after.coins }),
    );
    await shop.ctx.close();
  }

  /* ---- AC8 fallbacks: every asset request fails; and file:// ---- */
  {
    const ctx2 = await browser.newContext({ viewport: { width: 1000, height: 620 } });
    await ctx2.route("**/assets/**", (r) => r.abort());
    const p2 = await ctx2.newPage();
    const errs = [];
    p2.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    await p2.goto(URL);
    await p2.waitForFunction(() => window.__stride);
    await p2.getByRole("button", { name: "Start running" }).click();
    await p2.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 30000,
    });
    await S(p2, () => window.__stride.step(1500));
    const fb = await S(p2, () => ({
      skin: window.__stride.skin,
      dogs: window.__stride.dogs,
      world: window.__stride.world,
    }));
    check(
      "AC8",
      "all assets blocked: primitive runner + dogs, procedural textures, run proceeds",
      fb.skin.kind === "primitive" &&
        fb.dogs.list.every((d) => d.kind === "primitive") &&
        Object.values(fb.world.tex).every((v) => v === "proc" || v === "failed") &&
        errs.length === 0,
      JSON.stringify({ skin: fb.skin.kind, tex: [...new Set(Object.values(fb.world.tex))], errs }),
    );
    await ctx2.close();

    const fileUrl = pathToFileURL(resolve("games/sunset-stride/index.html")).href;
    const f = await openGame(browser, { url: fileUrl });
    await f.page.waitForFunction(() => window.__stride);
    await f.page.getByRole("button", { name: "Start running" }).click();
    await f.page.waitForFunction(
      () => window.__stride && window.__stride.state.phase === "running",
      null,
      { timeout: 30000 },
    );
    await S(f.page, () => window.__stride.step(1200));
    const fk = await S(f.page, () => window.__stride.skin.kind);
    check(
      "AC8",
      "file:// runs on fallbacks with no uncaught errors",
      fk === "primitive" && f.errors.filter((e) => e.startsWith("pageerror")).length === 0,
      f.errors.slice(0, 2).join(" | "),
    );
    await f.ctx.close();
  }

  /* ---- AC2 phone portrait: lanes visible, dogs on screen after a hit ---- */
  {
    const ph = await openGame(browser, { viewport: { width: 390, height: 844 }, mobile: true });
    await waitModels(ph.page);
    await ph.page.getByRole("button", { name: "Start running" }).tap();
    await ph.page.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 30000,
    });
    await S(ph.page, () => {
      window.__stride.clearObstacles();
      window.__stride.hit();
      window.__stride.step(250);
    });
    const pc = await S(ph.page, () => ({
      cam: window.__stride.camera,
      dogs: window.__stride.dogs,
    }));
    check(
      "AC2",
      "phone portrait: lanes visible ahead and the pack is on screen after a hit",
      pc.cam.laneVisible.every(Boolean) && pc.dogs.list.filter((d) => d.onScreen).length >= 2,
      JSON.stringify({ lanes: pc.cam.laneVisible, dogs: pc.dogs.list.map((d) => d.onScreen) }),
    );
    check(
      "AC9",
      "phone session: no uncaught errors",
      ph.errors.length === 0,
      ph.errors.slice(0, 2).join(" | "),
    );
    await ph.ctx.close();
  }

  /* ---- AC13 usability (persona findings): Start always in reach, labels follow the input, swipes act on
         the drag, keyboard loop (P / Esc pause, M mute, retry by key) ---- */
  {
    const ph = await openGame(browser, { viewport: { width: 390, height: 844 }, mobile: true });
    await ph.page.locator("#startBtn").waitFor();
    const startPh = await S(ph.page, () => {
      const r = document.getElementById("startBtn").getBoundingClientRect();
      const vis = (sel) => getComputedStyle(document.querySelector(sel)).display !== "none";
      return {
        bottom: Math.round(r.bottom),
        top: Math.round(r.top),
        vh: innerHeight,
        swipe: vis(".how .tc"),
        keys: vis(".how .kb"),
      };
    });
    check(
      "AC13",
      "phone: Start is inside the first screen (no scrolling), labels say swipe",
      startPh.bottom <= startPh.vh && startPh.top >= 0 && startPh.swipe && !startPh.keys,
      JSON.stringify(startPh),
    );
    await waitModels(ph.page);
    await ph.page.getByRole("button", { name: "Start running" }).tap();
    await ph.page.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 30000,
    });
    const sw = await S(ph.page, async () => {
      const s = window.__stride,
        cv = document.getElementById("glCanvas");
      s.freeze(true);
      s.clearObstacles();
      s.setGap(4);
      const fire = (type, x, y) =>
        cv.dispatchEvent(
          new PointerEvent(type, {
            clientX: x,
            clientY: y,
            pointerId: 7,
            pointerType: "touch",
            bubbles: true,
          }),
        );
      const lane0 = s.state.lane;
      fire("pointerdown", 200, 500);
      fire("pointermove", 190, 500); // 10 px: below the threshold, nothing yet
      const early = s.state.lane;
      fire("pointermove", 150, 502); // 50 px left, finger still down
      const duringDrag = s.state.lane;
      fire("pointermove", 100, 500);
      fire("pointerup", 100, 500);
      const afterLift = s.state.lane;
      return { lane0, early, duringDrag, afterLift };
    });
    check(
      "AC13",
      "swipe acts the moment the finger passes the threshold (before it lifts), exactly once",
      sw.early === sw.lane0 && sw.duringDrag === sw.lane0 - 1 && sw.afterLift === sw.duringDrag,
      JSON.stringify(sw),
    );
    await ph.ctx.close();
  }
  {
    const dk = await openGame(browser, { viewport: { width: 1280, height: 720 } });
    await dk.page.locator("#startBtn").waitFor();
    const startDk = await S(dk.page, () => {
      const r = document.getElementById("startBtn").getBoundingClientRect();
      const vis = (sel) => getComputedStyle(document.querySelector(sel)).display !== "none";
      return {
        bottom: Math.round(r.bottom),
        vh: innerHeight,
        swipe: vis(".how .tc"),
        keys: vis(".how .kb"),
      };
    });
    check(
      "AC13",
      "desktop 1280x720: Start is inside the first screen, labels name the keys",
      startDk.bottom <= startDk.vh && startDk.keys && !startDk.swipe,
      JSON.stringify(startDk),
    );
    await waitModels(dk.page);
    await dk.page.getByRole("button", { name: "Start running" }).click();
    await dk.page.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 30000,
    });
    // Esc pauses (HUD becomes inert under the modal dialog), Esc again resumes WITHOUT quitting, P also resumes
    await dk.page.keyboard.press("Escape");
    const paused = await S(dk.page, () => window.__stride.state.paused);
    const inert = await S(dk.page, () => document.getElementById("hud").inert === true);
    await dk.page.keyboard.press("Escape");
    const escResume = await S(dk.page, () => ({
      paused: window.__stride.state.paused,
      phase: window.__stride.state.phase,
      inert: document.getElementById("hud").inert,
    }));
    await dk.page.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 15000,
    });
    await dk.page.keyboard.press("Escape");
    await dk.page.keyboard.press("p");
    const resumed = await S(dk.page, () => window.__stride.state.paused);
    await dk.page.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 15000,
    });
    // modifier chords (Ctrl+Left ...) are not game input
    const chords = await S(dk.page, () => window.__stride.state.lane);
    await dk.page.keyboard.press("Control+ArrowLeft");
    await dk.page.keyboard.press("Alt+ArrowLeft");
    const chordsAfter = await S(dk.page, () => window.__stride.state.lane);
    check(
      "AC13",
      "keys: Esc / Esc pauses then resumes (no accidental quit), HUD inert while paused, Ctrl / Alt chords ignored",
      paused === true &&
        inert === true &&
        escResume.paused === false &&
        escResume.inert === false &&
        escResume.phase !== "idle" &&
        chordsAfter === chords,
      JSON.stringify({ paused, inert, escResume, chords, chordsAfter }),
    );
    const m0 = await S(dk.page, () => window.__stride.state.muted);
    await dk.page.keyboard.press("m");
    const m1 = await S(dk.page, () => window.__stride.state.muted);
    await dk.page.keyboard.press("m");
    const m2 = await S(dk.page, () => window.__stride.state.muted);
    check(
      "AC13",
      "keyboard: Esc pauses, P resumes, M mutes / unmutes",
      paused === true && resumed === false && m1 === !m0 && m2 === m0,
      JSON.stringify({ paused, resumed, m0, m1, m2 }),
    );
    // caught -> results: focus lands on Try again (after a short guard), Enter retries; R retries too
    // resuming replays a 3-2-1, and a hit during it is ignored: wait for the run to be live again
    await dk.page.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 15000,
    });
    const caught = () =>
      S(dk.page, () => {
        const s = window.__stride;
        s.clearObstacles();
        s.three.player.invulnT = 0;
        s.setGap(1.9);
        s.hit();
        s.step(100);
      });
    await caught();
    await dk.page.waitForFunction(
      () => document.getElementById("results").classList.contains("active"),
      null,
      { timeout: 15000 },
    );
    await dk.page.waitForFunction(
      () => document.activeElement && document.activeElement.id === "againBtn",
      null,
      { timeout: 5000 },
    );
    await dk.page.keyboard.press("Enter");
    await dk.page.waitForFunction(
      () => ["countdown", "running"].includes(window.__stride.state.phase),
      null,
      { timeout: 15000 },
    );
    await dk.page.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 15000,
    });
    await caught();
    await dk.page.waitForFunction(
      () => document.getElementById("results").classList.contains("active"),
      null,
      { timeout: 15000 },
    );
    await dk.page.keyboard.press("r");
    const again = await dk.page
      .waitForFunction(() => ["countdown", "running"].includes(window.__stride.state.phase), null, {
        timeout: 15000,
      })
      .then(() => true)
      .catch(() => false);
    check(
      "AC13",
      "keyboard loop: results focus Try again (Enter retries) and R retries",
      again,
      "",
    );
    check(
      "AC13",
      "desktop session: no uncaught errors",
      dk.errors.length === 0,
      dk.errors.slice(0, 2).join(" | "),
    );
    await dk.ctx.close();
  }

  {
    const sh = await openGame(browser, {
      viewport: { width: 1000, height: 700 },
      init: () =>
        localStorage.setItem(
          "playpad.sunsetStride.v1",
          JSON.stringify({
            v: 1,
            coins: 5000,
            unlocked: ["morning", "ranger"],
            equipped: "morning",
            highScore: 0,
            muted: true,
          }),
        ),
    });
    await sh.page.locator("#setupShopBtn").click();
    const eq = sh.page.locator('#skinGrid button[aria-label^="Equip "]').first();
    await eq.waitFor();
    const label = await eq.getAttribute("aria-label");
    await eq.click();
    const after = await S(sh.page, () => {
      const a = document.activeElement;
      return {
        id: a && a.dataset ? a.dataset.btn : null,
        label: a && a.getAttribute("aria-label"),
        aria: a && a.getAttribute("aria-disabled"),
      };
    });
    check(
      "AC13",
      "shop: Equip has a name; after equipping, focus stays on that card's (now 'equipped') button",
      /^Equip \S/.test(label) &&
        after.id &&
        /equipped$/.test(after.label || "") &&
        after.aria === "true",
      JSON.stringify({ label, after }),
    );
    await sh.ctx.close();
  }
  {
    const html = readFileSync(resolve("games/sunset-stride/index.html"), "utf8");
    const beat = (html.match(/@keyframes beat\s*\{[\s\S]*?\n {6}\}/) || [""])[0];
    check(
      "AC13",
      "countdown numeral never fades out (no ~3 Hz brightness pulse, WCAG 2.3.1)",
      beat.length > 20 && !/opacity/.test(beat),
      beat.replace(/\s+/g, " ").slice(0, 90),
    );
  }

  /* ---- AC9: WebGL missing -> the game explains instead of a blank screen ---- */
  {
    const nogl = await openGame(browser, {
      init: () => {
        const real = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          return /webgl/i.test(type) ? null : real.call(this, type, ...rest);
        };
      },
    });
    await nogl.page.locator("#startBtn").waitFor();
    await nogl.page.getByRole("button", { name: "Start running" }).click();
    const shown = await nogl.page.locator("#glFail").isVisible();
    check(
      "AC9",
      "no WebGL: Start shows the 'turn on WebGL' notice, no crash",
      shown && nogl.errors.filter((e) => e.startsWith("pageerror")).length === 0,
      nogl.errors.slice(0, 2).join(" | "),
    );
    await nogl.ctx.close();
  }

  /* ---- reduced motion: normal mode kicks the FOV (control), reduced motion does not ---- */
  {
    // Own browser per scenario: software WebGL leaves queued GPU work behind, which stalls the NEXT page load
    // in the same browser for tens of seconds (a test-harness artefact, not a game issue).
    const fovKick = async (reduced) => {
      const own = await launch();
      const c = await own.newContext({
        viewport: { width: 1000, height: 620 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      const pg = await c.newPage();
      const errs = [];
      pg.on("pageerror", (e) => errs.push(e.message));
      await pg.goto(URL);
      await pg.getByRole("button", { name: "Start running" }).click();
      await pg.waitForFunction(() => window.__stride.state.phase === "running", null, {
        timeout: 30000,
      });
      const kick = await S(pg, () => {
        const s = window.__stride;
        s.freeze(true);
        s.clearObstacles();
        s.setSpeed(24);
        const f0 = s.camera.fov;
        for (let i = 0; i < 180; i++) {
          s.step(16); // one render per step: the FOV eases ~3 % per frame toward the speed kick
          s.three.player.invulnT = 99;
        }
        return s.camera.fov - f0;
      });
      await c.close();
      await own.close();
      return { kick, errs };
    };
    const normal = await fovKick(false);
    const reduced = await fovKick(true);
    check(
      "AC9",
      "prefers-reduced-motion: no speed FOV kick (normal mode kicks > 3°, the control)",
      normal.kick > 3 && reduced.kick < 0.5 && reduced.errs.length === 0,
      `normal +${normal.kick.toFixed(2)}° reduced +${reduced.kick.toFixed(2)}°`,
    );
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
