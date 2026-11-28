// Commented-out-code check (CODE_QUALITY.md section 18 / ENFORCEMENT.md row 10, ledger row unenforced-checkable-rules). Dev-only; never shipped.
//
// "No commented-out code on main." Dead code in comments rots silently and git already keeps history, so
// this fails `npm run check` (and so CI) when a `//` comment line is really a line of code.
//
// SCOPE: games/**/*.js, scripts/**/*.js, tests/**/*.mjs, tools/**/*.mjs (vendored three.js / GLTFLoader and
//   node_modules are skipped). Only `//` line comments are examined: `/* */` blocks hold the Tier-1/2 doc
//   blocks and are not scanned. Inline <script> blocks in .html files are not scanned either.
//
// HOW IT WORKS (a conservative heuristic, tuned to ZERO false positives on the current tree):
//   1. Comments are found with ESLint's own parser (Linter#getSourceCode().getAllComments()), so a `//` inside
//      a string, template or regex is never mistaken for a comment. A file that does not parse is an error.
//   2. A comment's text is "code" only when it matches one of these SHAPES, each of which prose rarely has:
//        closer   a line that is only closing punctuation: `}`  `});`  `])`  `},`  `} else {`  `} catch (e) {`
//        opener   starts with a block keyword and ends in `{`:  `if (x) {`  `for (...) {`  `function f(a) {`
//        stmt     ends in `;`, and the text parses as JavaScript statements (wrapped in an async function so
//                 `return` / `await` are legal): `x = y;`  `foo(bar);`  `const a = [1, 2];`  `return x;`
//        call     the whole text is one call on a dotted name, with no prose around it, and parses:
//                 `foo.bar(1, 2)`  `console.log(x)`
//        decl     starts with `const|let|var|function|class|import|export ` and parses as a statement
//                 (`const x = 1`)
//   3. Ordinary prose, `TODO(PLAY-12): ...` tags, ASCII diagrams, `e.g. foo(bar)`, ratio / formula comments
//      (`a = b / c` with no `;`) and one-word comments do NOT match any shape, so they pass.
//   The cost of a miss is small (review still applies, CODE_QUALITY.md section 17); the cost of a false positive
//   is a blocked commit, so every shape errs on the side of NOT flagging. A comment that must show code (an
//   example) belongs in a `/** */` doc block, which is not scanned; there is deliberately no ignore marker.
//
// Usage: node tools/check-commented-code.mjs [file ...]   (no args = the whole scope)
import { Linter } from "eslint";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE = [
  { dir: "games", ext: ".js" },
  { dir: "scripts", ext: ".js" },
  { dir: "tests", ext: ".mjs" },
  { dir: "tools", ext: ".mjs" },
];
const SKIP_DIRS = new Set(["node_modules", ".git", "assets"]);
const SKIP_FILES = new Set(["three.min.js", "GLTFLoader.js"]);

const CLOSER = /^[)\]}]+[;,)]*(\s*(else|catch|finally)\b.*\{)?$|^\}\s*(else|catch|finally)\b.*\{$/;
const OPENER =
  /^(if|for|while|switch|function|else|try|do|catch|class|async function)\b.*\{$|^\}\s*else\b.*\{$/;
const DECL = /^(const|let|var|function|class|import|export)\s/;
const CALL = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*\(.*\)$/;

/** True when `text` parses as JavaScript statements (syntax only; nothing is executed). */
function parses(text) {
  try {
    new vm.Script("(async function () {\n" + text + "\n})");
    return true;
  } catch {
    return false;
  }
}

/** Why a comment's text looks like code, or null when it reads as prose. */
export function codeShape(raw) {
  const text = raw.trim();
  if (!text) return null;
  if (CLOSER.test(text)) return "closer";
  if (OPENER.test(text)) return "opener";
  if (text.endsWith(";") && parses(text)) return "stmt";
  if (CALL.test(text) && parses(text)) return "call";
  if (DECL.test(text) && parses(text)) return "decl";
  return null;
}

/** The files in scope, as absolute paths, in a stable order. */
function listFiles() {
  const out = [];
  const walk = (dir, ext) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full, ext);
      } else if (name.endsWith(ext) && !SKIP_FILES.has(name)) out.push(full);
    }
  };
  for (const { dir, ext } of SCOPE) walk(join(ROOT, dir), ext);
  return out;
}

/** Every `//` comment of one file as { line, text }; throws when the file does not parse. */
function lineComments(file, linter) {
  const code = readFileSync(file, "utf8");
  const config = {
    languageOptions: { ecmaVersion: 2022, sourceType: file.endsWith(".mjs") ? "module" : "script" },
  };
  const messages = linter.verify(code, config, file);
  const fatal = messages.find((m) => m.fatal);
  if (fatal) throw new Error(`${file}:${fatal.line}: cannot parse (${fatal.message})`);
  return linter
    .getSourceCode()
    .getAllComments()
    .filter((c) => c.type === "Line")
    .map((c) => ({ line: c.loc.start.line, text: c.value }));
}

/** The offending comments of the given files: [{ file, line, shape, text }]. */
export function findCommentedCode(files) {
  const linter = new Linter();
  const found = [];
  for (const file of files)
    for (const c of lineComments(file, linter)) {
      const shape = codeShape(c.text);
      if (shape)
        found.push({ file: relative(ROOT, file), line: c.line, shape, text: c.text.trim() });
    }
  return found;
}

/** CLI entry: print each hit as file:line and exit 1 when there is any. */
function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const files = args.length ? args.map((a) => join(process.cwd(), a)) : listFiles();
  const found = findCommentedCode(files);
  if (!found.length) {
    console.log(`Commented-out code: none (${files.length} files checked)`);
    return;
  }
  console.error(
    "Commented-out code found (delete it; git keeps the history, CODE_QUALITY.md row 10):\n" +
      found.map((f) => `  ${f.file}:${f.line}  [${f.shape}]  // ${f.text}`).join("\n"),
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
