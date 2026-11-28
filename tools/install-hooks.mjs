// Git hook installer (PLAY-015), run by `npm install` through the "prepare" script.
// Points git at the repo's tracked hooks (.githooks/: secret scan + lint on commit, commit-message check)
// so a fresh clone gets them without a manual `git config`. It must never break an install: outside a
// git work tree (a tarball, a CI cache) or without git it does nothing and exits 0.
import { execFileSync } from "node:child_process";

/** True when the current directory is inside a git work tree and git is available. */
function inGitWorkTree() {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() === "true";
  } catch {
    return false;
  }
}

if (inGitWorkTree()) {
  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
    console.warn("git hooks: core.hooksPath -> .githooks");
  } catch {
    console.warn("git hooks: could not set core.hooksPath (skipped)");
  }
}
