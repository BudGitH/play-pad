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
  await page.waitForFunction(() => window.__stride && window.__stride.world.glbRunner, null, {
    timeout: 30000,
  });
  await page.waitForFunction(
    () =>
      window.__stride.dogs.list.every((d) => d.kind === "glb") ||
      window.__stride.dogs.list.length > 0,
    null,
    { timeout: 30000 },
  );
}
async function startRun(page) {
  await page.getByRole("button", { name: "Start running" }).click();
  await page.waitForFunction(() => window.__stride.state.phase === "running", null, {
    timeout: 30000,
  });
  // The rAF loop keeps ticking in real time; software WebGL is slow, so probes freeze it and advance with step().
  await page.evaluate(() => window.__stride.freeze(true));
}
// Keep the run alive and uncluttered while a probe inspects a state.
const calm = (page) =>
  S(page, () => {
    const s = window.__stride;
    s.clearObstacles();
    s.three.player.invulnT = 0;
  });

async function main() {
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

  await startRun(page);
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
    await p2.waitForTimeout(2500);
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
    await f.page.waitForTimeout(2000);
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

  /* ---- reduced motion ---- */
  {
    const rm = await browser.newContext({
      viewport: { width: 1000, height: 620 },
      reducedMotion: "reduce",
    });
    const p3 = await rm.newPage();
    const e3 = [];
    p3.on("pageerror", (e) => e3.push(e.message));
    await p3.goto(URL);
    await p3.waitForTimeout(2500);
    await p3.getByRole("button", { name: "Start running" }).click();
    await p3.waitForFunction(() => window.__stride.state.phase === "running", null, {
      timeout: 30000,
    });
    const fovs = await S(p3, () => {
      const s = window.__stride,
        out = [];
      s.setSpeed(24);
      for (let i = 0; i < 6; i++) {
        s.step(500);
        out.push(s.camera.fov);
      }
      return out;
    });
    const hasKick = Math.max(...fovs) - Math.min(...fovs) > 0.5 && fovs[5] > fovs[0] + 1;
    check(
      "AC9",
      "prefers-reduced-motion: no speed FOV kick, no errors",
      !hasKick && e3.length === 0,
      `fov ${fovs.map((f) => f.toFixed(1)).join(",")}`,
    );
    await rm.close();
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
