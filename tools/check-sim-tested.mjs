// "No untested public functions" for the Kampung Quest sim layer (CODE_QUALITY.md section 18 / ENFORCEMENT.md
// row 25, ledger row unenforced-checkable-rules). Dev-only; never shipped. This is what `npm run test:kq` runs.
//
// SCOPE: games/kampung-quest/js/sim/*.js, the pure no-DOM / no-THREE rules that tests/kampung-quest/*.test.mjs
//   load into a `vm` sandbox. The other games have no unit-test layer (their logic lives in one HTML file and
//   is covered by the browser specs and probes), so there is nothing here to measure for them.
//
// HOW: Node's built-in test coverage (V8 precise coverage) over the unit tests. The tests load the sims with
//   `vm.runInContext(..., { filename: <absolute path> })`, which is what lets V8 attribute the code to the
//   file (a bare filename is silently dropped from the report; see LEARNINGS 2026-11-28). Three gates:
//     1. Every `sim/*.js` file shows up in the coverage report, i.e. some test loads it.
//     2. Global floors on the report (Node's own --test-coverage-lines / --test-coverage-functions).
//     3. A per-function ratchet: every NAMED function with zero calls is "untested". Inner callbacks (V8's
//        `anonymous_N`) are not public and are skipped. The untested set may not grow beyond
//        tools/sim-untested-baseline.json; when tests are added and the set shrinks the check fails until the
//        baseline is lowered with `node tools/check-sim-tested.mjs --update` (same pattern as lint-ratchet).
//        The baseline is EMPTY today: every named sim function is called by at least one test, so a new
//        function that no test calls fails this check on the PR that adds it.
//   `npm run test:kq:fast` runs the same tests without coverage (a quicker loop while writing them).
//
// Usage: node tools/check-sim-tested.mjs [--update]
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIM_DIR = "games/kampung-quest/js/sim";
const BASELINE = join(ROOT, "tools", "sim-untested-baseline.json");
const LINE_FLOOR = 99; // measured 99.8 % when this was wired; raise it, never lower it
const FUNC_FLOOR = 98; // measured 99.6 % (the per-function ratchet below is the precise gate)

/** Run the unit tests with coverage; stream their report, return the lcov text (or exit on a test failure). */
function runTests() {
  const dir = mkdtempSync(join(tmpdir(), "kq-cov-"));
  const lcov = join(dir, "lcov.info");
  const args = [
    "--test",
    "--experimental-test-coverage",
    `--test-coverage-include=${SIM_DIR}/*.js`,
    `--test-coverage-lines=${LINE_FLOOR}`,
    `--test-coverage-functions=${FUNC_FLOOR}`,
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=lcov",
    `--test-reporter-destination=${lcov}`,
    "tests/kampung-quest/*.test.mjs",
  ];
  const run = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
  });
  let text = "";
  try {
    text = readFileSync(lcov, "utf8");
  } catch {
    /* the tests crashed before writing a report; the exit status below says so */
  }
  rmSync(dir, { recursive: true, force: true });
  if (run.status !== 0) {
    console.error("\nKampung Quest sim tests / coverage floors failed (see above).");
    process.exit(run.status || 1);
  }
  return text;
}

/** { "file": { "name": neverCalledCount } } for the named functions, from lcov text. */
function parseLcov(text) {
  const files = {};
  let file = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      file = line.slice(3);
      files[file] = {};
    } else if (line.startsWith("FNDA:") && file) {
      const comma = line.indexOf(",");
      const calls = Number(line.slice(5, comma));
      const name = line.slice(comma + 1);
      if (name.startsWith("anonymous_")) continue;
      files[file][name] = (files[file][name] || 0) + (calls > 0 ? 0 : 1); // count the never-called ones
    }
  }
  return files;
}

/** { "file::name": untestedCount } built from the parse (a name may occur more than once in a file). */
function untested(files) {
  const out = {};
  for (const [file, names] of Object.entries(files))
    for (const [name, zero] of Object.entries(names))
      if (zero > 0) out[`${file.split("/").pop()}::${name}`] = zero;
  return out;
}

/** The problems with the report: sim files no test loads, and growth or shrinkage of the untested set. */
function problems(files, now, base) {
  const out = [];
  const loaded = new Set(Object.keys(files).map((f) => f.split("/").pop()));
  for (const f of readdirSync(join(ROOT, SIM_DIR)).filter((n) => n.endsWith(".js")))
    if (!loaded.has(f))
      out.push(
        `${SIM_DIR}/${f}: no unit test loads this file (add one under tests/kampung-quest/)`,
      );
  for (const key of [...new Set([...Object.keys(now), ...Object.keys(base)])].sort()) {
    const was = base[key] || 0;
    const have = now[key] || 0;
    if (have > was)
      out.push(`${key}: untested ${was} -> ${have} (call it from a test in tests/kampung-quest/)`);
    if (have < was)
      out.push(
        `${key}: untested ${was} -> ${have} (now tested! run: node tools/check-sim-tested.mjs --update)`,
      );
  }
  return out;
}

const files = parseLcov(runTests());
const now = untested(files);
if (process.argv.includes("--update")) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
  console.log(`sim untested baseline updated: ${Object.keys(now).length} functions`);
} else {
  const found = problems(files, now, JSON.parse(readFileSync(BASELINE, "utf8")));
  if (found.length) {
    console.error("Sim coverage ratchet failed:\n  " + found.join("\n  "));
    process.exit(1);
  }
  console.log(
    `Sim coverage: ok (${Object.keys(now).length} baselined untested functions, none new)`,
  );
}
