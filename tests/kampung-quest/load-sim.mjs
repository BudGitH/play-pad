// Loads the classic-script Kampung Quest sim files into a fresh Node `vm` sandbox
// (no window, no DOM, no THREE), exactly the way a browser would run them in order.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const JS_DIR = path.resolve(import.meta.dirname, "../../games/kampung-quest/js");
const SIM_DIR = path.join(JS_DIR, "sim");
const DATA_DIR = path.join(JS_DIR, "data");

/** The shipped data files (real MUIS times, azan captions), loaded only by loadSimWithData(). */
export const DATA_FILES = ["prayer-times", "azan", "holy-sites", "ritual-text"];

/** Load order matters: see the header of save.js. */
export const SIM_FILES = [
  "ids",
  "clock",
  "prayer",
  "needs",
  "hints",
  "economy",
  "wardrobe",
  "hero",
  "missions-data",
  "missions-more",
  "missions",
  "schedule",
  "greet",
  "hi",
  "actions",
  "events",
  "ambience-mix",
  "recite",
  "ritual-walk",
  "umrah",
  "save",
];

/** Fixture times (clearly NOT the real MUIS values - those live in js/data/prayer-times.js). */
export const FIXTURE_TIMES = {
  date: "fixture",
  subuh: "05:00",
  syuruk: "06:30",
  zohor: "13:00",
  asar: "16:30",
  maghrib: "19:00",
  isyak: "20:15",
};

function runAll(sandbox, dir, files) {
  for (const name of files) {
    const source = fs.readFileSync(path.join(dir, name + ".js"), "utf8");
    vm.runInContext(source, sandbox, { filename: path.join(dir, name + ".js") });
  }
}

/** @param {string|null} region optional KQ.region to set first ("haramain" selects that region's save slot) */
/** @returns {object} the KQ namespace populated by the sim scripts */
export function loadSim(files = SIM_FILES, region = null) {
  const sandbox = region ? { KQ: { region } } : {};
  vm.createContext(sandbox);
  runAll(sandbox, SIM_DIR, files);
  return sandbox.KQ;
}

/** Like loadSim, plus the REAL js/data files (KQ.PRAYER_TIMES, KQ.AZAN_TEXT), data first as in index.html. */
export function loadSimWithData() {
  const sandbox = {};
  vm.createContext(sandbox);
  runAll(sandbox, DATA_DIR, DATA_FILES);
  runAll(sandbox, SIM_DIR, SIM_FILES);
  return sandbox.KQ;
}

/** The sim plus the game layer's pure text module (js/game/prayer-text.js): returns KQ.Game.PrayerText. */
export function loadPrayerText() {
  const sandbox = {};
  sandbox.window = sandbox; // game files attach to window.KQ
  vm.createContext(sandbox);
  runAll(sandbox, SIM_DIR, SIM_FILES);
  runAll(sandbox, path.join(JS_DIR, "game"), ["prayer-text"]);
  return sandbox.KQ.Game.PrayerText;
}

/** The pure collision maths (js/game/collide.js: resolve, settle, separate, openHeading, armLength). */
export function loadCollide() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  runAll(sandbox, path.join(JS_DIR, "game"), ["collide"]);
  return sandbox.KQ.Game.Collide;
}

/** Deep-clone across the vm realm boundary so assert.deepStrictEqual works. */
export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/** A tiny in-memory localStorage stand-in. */
export function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

/** Parse "HH:MM" to minutes. */
export function mins(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
