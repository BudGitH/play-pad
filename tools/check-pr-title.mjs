// Commit / PR-title format check (CODE_QUALITY.md section 15 / ENFORCEMENT.md row section 15, ledger row unenforced-checkable-rules). Dev-only.
//
// Format (docs/PR-STANDARD.md 1.2, Conventional Commits):  type(scope): imperative summary
//   type     one of feat fix refactor perf test docs chore build ci revert
//   scope    required, lowercase words joined by - . / _  (e.g. kampung-quest, ci, docs)
//   `!`      allowed after the scope for a breaking change:  feat(save)!: drop the v1 format
//   summary  non-empty, at most 72 characters (wording is a review matter: imperative, says what + why)
//
// This repo squash-merges, so the PR TITLE becomes the one commit on main: CI checks the title
// (.github/workflows/pr-title.yml). The title is read from the PR_TITLE environment variable (set from the
// event payload by the workflow, never interpolated into a shell command); pass it as an argument to try it
// locally:   node tools/check-pr-title.mjs "fix(billing): stop duplicate records on retry"
// The same function backs the commit-msg hook in .githooks/, which only WARNS (agents' WIP commits do not
// follow the format).
import { fileURLToPath } from "node:url";

export const TYPES = [
  "feat",
  "fix",
  "refactor",
  "perf",
  "test",
  "docs",
  "chore",
  "build",
  "ci",
  "revert",
];
const MAX_SUMMARY = 72;
const SHAPE = new RegExp(`^(${TYPES.join("|")})\\(([a-z0-9][a-z0-9._/-]*)\\)(!?): (.+)$`);

/** The problem with a title, or null when it is valid. */
export function titleProblem(title) {
  const text = String(title ?? "");
  const m = SHAPE.exec(text);
  if (!m) return `does not match "type(scope): summary" with a type from: ${TYPES.join(", ")}`;
  const summary = m[4];
  if (summary.length > MAX_SUMMARY)
    return `summary is ${summary.length} characters (max ${MAX_SUMMARY})`;
  if (summary !== summary.trim()) return "summary has leading or trailing spaces";
  return null;
}

/** CLI entry: title from argv or PR_TITLE; exit 1 with the reason when it is not valid. */
function main() {
  const title = process.argv[2] ?? process.env.PR_TITLE;
  const problem = titleProblem(title);
  if (problem) {
    console.error(
      `PR title check failed: "${title ?? ""}"\n  ${problem}\n` +
        "  Example: fix(billing): prevent duplicate record creation on retry\n  See docs/PR-STANDARD.md section 1.2.",
    );
    process.exit(1);
  }
  console.log(`PR title ok: ${title}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
