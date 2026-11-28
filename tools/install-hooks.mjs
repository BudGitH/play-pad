// Git hook installer (PLAY-015), run by `npm install` through the "prepare" script.
// Points git at the repo's tracked hooks (.githooks/: secret scan + lint on commit, commit-message check)
// so a fresh clone gets them without a manual `git config`. It must never break an install: outside a
// git work tree (a tarball, a CI cache) or without git it does nothing and exits 0.
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";

/**
 * True only when this directory is the ROOT of its own git work tree and has .githooks/, so a copy
 * nested inside some other repository (a monorepo, a vendored checkout) never rewires that repo's hooks.
 */
function isOwnRepoRoot() {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return realpathSync(top) === realpathSync(process.cwd()) && existsSync(join(top, ".githooks"));
  } catch {
    return false;
  }
}

if (isOwnRepoRoot()) {
  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
    console.warn("git hooks: core.hooksPath -> .githooks");
  } catch {
    console.warn("git hooks: could not set core.hooksPath (skipped)");
  }
}
