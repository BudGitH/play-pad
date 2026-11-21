// Secret scan (CODE_QUALITY.md #14). Blocks value-shaped secrets in tracked/staged files.
// Usage: node tools/secret-scan.mjs [--staged]
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const staged = process.argv.includes("--staged");
const cmd = staged ? "git diff --cached --name-only --diff-filter=ACM" : "git ls-files";
const files = execSync(cmd, { encoding: "utf8" }).split("\n").filter(Boolean);
const valueShaped = /(secret|token|password|api[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_\-/+=]{12,}["']/i;
const knownPrefixes = /(ghp_|github_pat_|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|xox[bp]-)/;
const skip =
  /\.(glb|ogg|png|jpg|ico|woff2?)$|three\.min\.js$|package-lock\.json$|secret-scan\.mjs$/;

let hits = 0;
for (const file of files) {
  if (skip.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (valueShaped.test(line) || knownPrefixes.test(line)) {
      console.error(`Possible secret: ${file}:${i + 1}`);
      hits++;
    }
  });
}
if (hits) {
  console.error(`\n${hits} possible secret(s). Move them to env/untracked files and rotate them.`);
  process.exit(1);
}
console.log("Secret scan: clean");
