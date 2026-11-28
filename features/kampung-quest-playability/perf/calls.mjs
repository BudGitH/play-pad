// calls.mjs — low-tier draw-call sweep with a breakdown per view (dev-only; AC-14 budget <= 400).
// Every spot x event x 4 yaws, plus the bus stop with the bus and traffic, and the Haramain views.
// Per view: total calls (shadow pass included), shadow / main split, and the top contributors by
// object name. Usage (server on PW_PORT):
//   PW_PORT=5617 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/kampung-quest-playability/perf/calls.mjs
//     [--region kampung|haramain] [--out file.json] [--top 12] [--events football,kompang,...]
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? def : argv[i + 1];
};
const PORT = Number(process.env.PW_PORT) || 5617;
const REGION = arg("region", "kampung");
const OUT = arg("out", null);
const TOP = Number(arg("top", 10));
const KAMPUNG_SPOTS = ["home", "block_b", "block_c", "hawker", "playground", "park", "pony_ride"];
const SPOTS = arg("spots", null);
const EVENTS = arg("events", null);

/** In the page: count calls per object (main vs shadow pass) by wrapping renderBufferDirect. */
function installCounter() {
  const r = window.KQ.Game.S.renderer;
  const C = (window.__calls = { by: {}, shadow: 0, main: 0 });
  const orig = r.renderBufferDirect.bind(r);
  r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    const shadow = !camera.isPerspectiveCamera;
    if (shadow) C.shadow += 1;
    else C.main += 1;
    const name = (object.name || object.type).replace(/@.*$/, "@cell").replace(/\d+$/, "#");
    const key = (shadow ? "S " : "M ") + name;
    C.by[key] = (C.by[key] || 0) + 1;
    return orig(camera, scene, geometry, material, object, group);
  };
}

/** In the page: a tiny render with the phone's aspect (same frustum), loop frozen. */
function phoneFrustum() {
  const G = window.KQ.Game;
  G.S.renderer.setPixelRatio(1);
  G.S.renderer.setSize(211, 98, false);
  G.Camera.resize(211, 98, 211 / 98);
  G.S.frozen = true;
}

/** In the page: run the sweep and return one row per view. */
function sweep(o) {
  const G = window.KQ.Game;
  const s = G.S;
  const k = window.__kq;
  const r = s.renderer;

  const rows = [];
  const measure = (view) => {
    const C = window.__calls;
    C.by = {};
    C.shadow = 0;
    C.main = 0;
    r.info.autoReset = false;
    r.info.reset();
    r.render(s.scene, s.camera);
    const top = Object.entries(C.by)
      .sort((a, b) => b[1] - a[1])
      .slice(0, o.top)
      .map(([n, c]) => c + " " + n);
    rows.push({ view, calls: r.info.render.calls, shadow: C.shadow, main: C.main, top });
  };
  const yaws = [0, 1.57, 3.14, 4.71];
  const at = (spot, ev) => {
    if (k.stopEvent) k.stopEvent();
    if (!k.teleport(spot)) return;
    if (ev && !k.forceEvent(ev)) return;
    k.step(4000);
    const st = k.state();
    yaws.forEach((yaw) => {
      k.place(st.x ?? st.pos.x, st.z ?? st.pos.z, yaw);
      k.step(200);
      measure(spot + (ev ? " +" + ev : "") + " y" + yaw);
    });
  };
  k.setMinute(600);
  k.step(500);
  o.spots.filter((p) => s.world.pois[p]).forEach((spot) => o.events.forEach((ev) => at(spot, ev)));
  if (k.stopEvent) k.stopEvent();
  return rows;
}

/** Busy extras: the bus stop with the bus in (kampung), the mosque gate at Maghrib. */
function extras(o) {
  const G = window.KQ.Game;
  const k = window.__kq;
  const rows = [];
  const yawsAt = (label) => {
    const st = k.state();
    [0, 1.57, 3.14, 4.71].forEach((yaw) => {
      k.place(st.x ?? st.pos.x, st.z ?? st.pos.z, yaw);
      k.step(200);
      const r = G.S.renderer;
      r.info.reset();
      r.render(G.S.scene, G.S.camera);
      rows.push({ view: label + " y" + yaw, calls: r.info.render.calls, top: [] });
    });
  };
  if (o.region === "kampung") {
    k.setMinute(600);
    k.teleport("bus_stop");
    for (let i = 0; i < 40 && !(G.Bus.debug().state === "stop"); i += 1) k.step(1500);
    yawsAt("bus_stop (bus " + Boolean(G.Bus.debug().state === "stop") + ")");
    k.forcePrayer("maghrib");
    k.teleport("mosque_gate");
    k.step(15000);
    yawsAt("mosque_gate maghrib");
  }
  return rows;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(
    `http://localhost:${PORT}/games/kampung-quest/index.html?still=1&autoq=0&q=low&region=${REGION}`,
  );
  await page.waitForFunction(() => window.__kq?.loaded, null, { timeout: 300_000 });
  await page.locator("#kq button.primary").first().click();
  await page.waitForFunction(() => window.__kq?.ready, null, { timeout: 120_000 });
  await page.evaluate(installCounter);
  const pois = await page.evaluate(() => Object.keys(window.KQ.Game.S.world.pois));
  const spots = SPOTS
    ? SPOTS.split(",")
    : REGION === "kampung"
      ? KAMPUNG_SPOTS.concat("mosque_gate")
      : pois;
  const events = [""].concat(
    EVENTS
      ? EVENTS.split(",")
      : await page.evaluate(() => Object.keys(window.KQ.Game.WorldEvents.SCRIPTS)),
  );
  await page.evaluate(phoneFrustum);
  const rows = await page.evaluate(sweep, { spots, events, top: TOP });
  rows.push(...(await page.evaluate(extras, { region: REGION })));
  report(rows, errs);
  if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
  await browser.close();
}

function report(rows, errs) {
  const worst = rows.slice().sort((a, b) => b.calls - a.calls);
  const byEvent = {};
  rows.forEach((r) => {
    const ev = (r.view.match(/\+(\w+)/) || [0, "none"])[1];
    byEvent[ev] = Math.max(byEvent[ev] || 0, r.calls);
  });
  console.log("worst per event:", JSON.stringify(byEvent));
  console.log("over 400:", rows.filter((r) => r.calls > 400).length, "of", rows.length);
  worst.slice(0, 6).forEach((r) => {
    console.log(`${r.calls} (S ${r.shadow} / M ${r.main})  ${r.view}`);
    r.top.forEach((t) => console.log("    " + t));
  });
  console.log("errors:", errs.length, errs.slice(0, 3));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
