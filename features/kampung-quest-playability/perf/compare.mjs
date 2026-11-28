// compare.mjs — before / after Markdown table from two calls.mjs result files (dev-only).
// Each cell is the worst of the four yaws at that spot. Usage:
//   node features/kampung-quest-playability/perf/compare.mjs before.json after.json
import { readFileSync } from "node:fs";

const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, "utf8")));

/** { spot -> { event -> worst calls } } from the view labels "spot +event yN". */
function grid(rows) {
  const g = {};
  rows.forEach((r) => {
    const m = r.view.match(/^(.*?)(?: \+(\w+))? y[\d.]+$/);
    if (!m) return;
    const spot = m[1];
    const ev = m[2] || "none";
    g[spot] = g[spot] || {};
    g[spot][ev] = Math.max(g[spot][ev] || 0, r.calls);
  });
  return g;
}

const ga = grid(a);
const gb = grid(b);
const events = [...new Set(Object.values(ga).flatMap((x) => Object.keys(x)))];
console.log("| view | " + events.join(" | ") + " |");
console.log("|---|" + events.map(() => "---:").join("|") + "|");
Object.keys(ga).forEach((spot) => {
  const cells = events.map((e) => {
    const x = ga[spot][e];
    const y = gb[spot] && gb[spot][e];
    return x === undefined ? "" : `${x} → ${y === undefined ? "?" : y}`;
  });
  console.log(`| ${spot} | ${cells.join(" | ")} |`);
});
const worst = (rows) => Math.max(...rows.map((r) => r.calls));
console.log(`\nworst view: ${worst(a)} → ${worst(b)}`);
