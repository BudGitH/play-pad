// table.mjs — merge measure.mjs result files into a before/after Markdown table of medians (dev-only).
// Usage: node features/kampung-quest-playability/ipad/table.mjs before=a.json,b.json after=c.json,d.json
import { readFileSync } from "node:fs";

const median = (xs) => {
  const s = xs.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};

const COLS = [
  ["Start enabled (ms)", (r) => r.loadedMs],
  ["Start tap to playing (ms)", (r) => r.readyMs],
  ["longest load task (ms)", (r) => r.longLoad.max],
  ["load tasks > 400 ms", (r) => r.longLoad.over400],
  ["play: median task (ms)", (r) => r.longPlay.median],
  ["play: longest task (ms)", (r) => r.longPlay.max],
  ["play: spikes (>400 & >2x median)", (r) => r.longPlay.spikes],
  ["JS heap peak (MB)", (r) => r.heapPeakMB],
  ["textures (MB est.)", (r) => (r.tex ? r.tex.mb : null)],
  ["programs at Start", (r) => r.programsAtLoad],
  ["draw calls", (r) => r.calls],
];

const sets = {};
process.argv.slice(2).forEach((a) => {
  const [label, files] = a.split("=");
  sets[label] = files.split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8")).rows);
});
const labels = Object.keys(sets);
const keys = [
  ...new Set(Object.values(sets).flatMap((rows) => rows.map((r) => r.device + " / " + r.region))),
];
for (const key of keys) {
  const runs = labels.map((l) => sets[l].filter((r) => r.device + " / " + r.region === key));
  console.log(`\n**${key}** (median of ${runs.map((r) => r.length).join(" / ")} runs)\n`);
  console.log("| metric | " + labels.join(" | ") + " |");
  console.log("|---|" + labels.map(() => "---:").join("|") + "|");
  for (const [name, f] of COLS)
    console.log(`| ${name} | ${runs.map((rs) => median(rs.map(f))).join(" | ")} |`);
}
