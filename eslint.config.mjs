// PlayPad ESLint flat config. Lints standalone .js files AND is the gate for CI.
// Inline <script> blocks in *.html are linted too, via eslint-plugin-html.
import js from "@eslint/js";
import globals from "globals";
import html from "eslint-plugin-html";
import jsdoc from "eslint-plugin-jsdoc";

// Files whose long functions / deep nesting pre-date the lint rules (see the ratchet note below).
const LEGACY = [
  "games/claw-catch/index.html",
  "games/sunset-stride/index.html",
  "tests/probes/stride-probe.mjs",
];

export default [
  {
    ignores: [
      "dist/**",
      "Old prototype/**",
      "node_modules/**",
      ".claude/**", // local Claude Code state, incl. agent worktrees (full copies of the repo)
      "docs/.brain-backup/**",
      "**/three.min.js",
      "**/GLTFLoader.js",
      "poly_robot.html",
      "s1.html",
      "s2.html",
    ],
  },
  js.configs.recommended,
  { files: ["**/*.html"], plugins: { html } },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, THREE: "readonly" },
    },
    rules: {
      // CODE_QUALITY.md #8: no empty catch blocks — do not remove without a DECISIONS.md entry
      "no-empty": ["error", { allowEmptyCatch: false }],
      // CODE_QUALITY.md #11: no console.log in shipped code (warn/error allowed) — do not remove without a DECISIONS.md entry
      "no-console": ["error", { allow: ["warn", "error"] }],
      // CODE_QUALITY.md #7: functions <= 40 lines — an ERROR everywhere except the legacy files listed in
      // LEGACY below, which are baselined and ratcheted (tools/lint-ratchet.mjs). PLAY-010. Do not remove without a DECISIONS.md entry
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      // CODE_QUALITY.md §10: nesting <= 3 — same enforcement as above
      "max-depth": ["error", 3],
      // Dead code in legacy games: warn (not error) until cleaned up — tracked in docs/IDEAS.md
      "no-unused-vars": ["warn", { caughtErrors: "none" }],
    },
  },
  {
    // Legacy offenders that pre-date the rule (PLAY-010). They stay warnings, but tools/lint-ratchet.mjs
    // (part of `npm run check`) fails if their count rises above tools/lint-baseline.json, and fails
    // when it falls so the baseline is lowered with the fix. New files and every other file get errors.
    files: LEGACY,
    rules: { "max-lines-per-function": "warn", "max-depth": "warn" },
  },
  {
    // R2-Q-07: Kampung Quest and its tests use const / let only. The older single-file games still
    // use `var` (about 3,000 sites), so the rules are scoped here until each game is converted;
    // widen the `files` list as they are. Do not remove without a DECISIONS.md entry.
    files: ["games/kampung-quest/**/*.js", "tests/kampung-quest*.mjs", "tests/kampung-quest/**"],
    rules: { "no-var": "error", "prefer-const": "error" },
  },
  {
    // CODE_QUALITY.md section 18 #2 (Tier-2 doc block on every function) — do not remove without a DECISIONS.md entry.
    // `jsdoc/require-jsdoc` on FunctionDeclaration (the form every named function in the shipped code takes).
    // Shipped code only: games, the hub page, scripts/. Dev tooling (tests/, tools/, features/) is not "public".
    // Warn here, ERROR for Kampung Quest in the next block; tools/lint-ratchet.mjs holds the warning count per
    // file at tools/lint-baseline.json so no new undocumented function can land in any game (ledger row unenforced-checkable-rules).
    files: ["games/**/*.{js,html}", "scripts/**/*.js", "index.html"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        { publicOnly: false, enableFixer: false, require: { FunctionDeclaration: true } },
      ],
    },
  },
  {
    // Kampung Quest is fully documented: a missing Tier-2 block is a hard error, not a ratcheted warning.
    files: ["games/kampung-quest/js/**/*.js"],
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        { publicOnly: false, enableFixer: false, require: { FunctionDeclaration: true } },
      ],
    },
  },
  {
    files: ["**/*.mjs", "tools/**"],
    languageOptions: { sourceType: "module", globals: globals.node },
    rules: { "no-console": "off" },
  },
];
