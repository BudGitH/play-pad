// PlayPad ESLint flat config. Lints standalone .js files AND is the gate for CI.
// Inline <script> blocks in *.html are linted too, via eslint-plugin-html.
import js from "@eslint/js";
import globals from "globals";
import html from "eslint-plugin-html";

export default [
  {
    ignores: [
      "dist/**",
      "Old prototype/**",
      "node_modules/**",
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
      // CODE_QUALITY.md #7: functions <= 40 lines (warn: existing games pre-date the rule) — do not remove without a DECISIONS.md entry
      "max-lines-per-function": ["warn", { max: 40, skipBlankLines: true, skipComments: true }],
      // CODE_QUALITY.md §10: nesting <= 3 — do not remove without a DECISIONS.md entry
      "max-depth": ["warn", 3],
      // Dead code in legacy games: warn (not error) until cleaned up — tracked in docs/IDEAS.md
      "no-unused-vars": ["warn", { caughtErrors: "none" }],
    },
  },
  {
    files: ["**/*.mjs", "tools/**"],
    languageOptions: { sourceType: "module", globals: globals.node },
    rules: { "no-console": "off" },
  },
];
