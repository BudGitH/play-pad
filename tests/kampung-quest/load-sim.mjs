// Loads the classic-script Kampung Quest sim files into a fresh Node `vm` sandbox
// (no window, no DOM, no THREE), exactly the way a browser would run them in order.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SIM_DIR = path.resolve(import.meta.dirname, "../../games/kampung-quest/js/sim");

/** Load order matters: see the header of save.js. */
export const SIM_FILES = [
  "ids",
  "clock",
  "prayer",
  "needs",
  "economy",
  "missions-data",
  "missions",
  "schedule",
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

/** @returns {object} the KQ namespace populated by the sim scripts */
export function loadSim(files = SIM_FILES) {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const name of files) {
    const source = fs.readFileSync(path.join(SIM_DIR, name + ".js"), "utf8");
    vm.runInContext(source, sandbox, { filename: name + ".js" });
  }
  return sandbox.KQ;
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
