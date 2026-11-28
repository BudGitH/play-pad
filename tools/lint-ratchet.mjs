// Lint ratchet (PLAY-010, ledger `function-length`). Dev-only; never shipped.
//
// `max-lines-per-function` and `max-depth` are ERRORS for every file except the legacy offenders in
// eslint.config.mjs, where they stay warnings. `jsdoc/require-jsdoc` (CODE_QUALITY.md section 18 #2, ledger row unenforced-checkable-rules)
// is an ERROR for Kampung Quest `js/**` and a WARNING for the other games, hub page and scripts/ (their
// undocumented functions are baselined). This script keeps those warnings from growing: it runs
// ESLint, counts the rules' warnings per file and compares them with tools/lint-baseline.json.
//   - more than the baseline        -> fail (a new overlong function / deep block in a legacy file)
//   - fewer than the baseline       -> fail too, so the baseline is lowered in the same PR as the fix
//   - a file that is not baselined  -> any warning of these rules fails
// Run `node tools/lint-ratchet.mjs --update` to rewrite the baseline after fixing offenders.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(ROOT, "tools", "lint-baseline.json");
const RULES = ["max-lines-per-function", "max-depth", "jsdoc/require-jsdoc"];

function lint() {
  const eslint = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");
  let out;
  try {
    out = execFileSync(process.execPath, [eslint, ".", "-f", "json"], {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (e) {
    out = e.stdout; // ESLint exits 1 when anything is an error; the JSON is still on stdout
  }
  return JSON.parse(String(out));
}

/** { "path": { rule: count } } for the ratcheted rules (warnings and errors alike). */
function count(results) {
  const seen = {};
  for (const f of results)
    for (const m of f.messages) {
      if (!RULES.includes(m.ruleId)) continue;
      const file = relative(ROOT, f.filePath).split("\\").join("/");
      seen[file] ??= {};
      seen[file][m.ruleId] = (seen[file][m.ruleId] || 0) + 1;
    }
  return seen;
}

function compare(seen, base) {
  const problems = [];
  const files = new Set([...Object.keys(seen), ...Object.keys(base)]);
  for (const file of [...files].sort())
    for (const rule of RULES) {
      const now = seen[file]?.[rule] || 0;
      const was = base[file]?.[rule] || 0;
      if (now > was)
        problems.push(
          `${file}: ${rule} ${was} -> ${now} (new offender: ${rule === "jsdoc/require-jsdoc" ? "add a /** */ doc block" : "split it"})`,
        );
      if (now < was)
        problems.push(
          `${file}: ${rule} ${was} -> ${now} (fixed! run: node tools/lint-ratchet.mjs --update)`,
        );
    }
  return problems;
}

const seen = count(lint());
if (process.argv.includes("--update")) {
  writeFileSync(BASELINE, JSON.stringify(seen, null, 2) + "\n");
  console.log("lint baseline updated:", JSON.stringify(seen));
} else {
  const base = JSON.parse(readFileSync(BASELINE, "utf8"));
  const problems = compare(seen, base);
  if (problems.length) {
    console.error("Lint ratchet failed:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  const total = Object.values(seen).reduce(
    (a, r) => a + Object.values(r).reduce((x, y) => x + y, 0),
    0,
  );
  console.log(`Lint ratchet: ok (${total} legacy warnings, none new)`);
}
