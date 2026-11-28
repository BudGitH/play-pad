// Dev-only: before / after issue counts per category (hero, cast, guides, event actors, crowd,
// pilgrims) from audit-before.json and audit-after.json (written by audit.mjs).
// Run: node features/kampung-quest-playability/figures/audit-summary.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CATS = ["hero", "cast", "guides", "event", "crowd", "pilgrims"];

/** The issue kinds a head-piece row raises. */
function pieceIssues(p) {
  const out = [];
  if (p.poke > 4) out.push("head pokes through the piece");
  if (p.bare > 4) out.push("head uncovered where the piece should cover it");
  if (p.zfight > 4) out.push("z-fighting with the head (> 4 samples)");
  if (p.floating > 0) out.push("rim floating > 3 mm off the head");
  return out;
}

/** The issue kinds a pose row raises. */
function poseIssues(p) {
  const parts = (p.floorParts || []).map((x) => x.split(":")[0]);
  const out = [];
  if (parts.some((x) => /headPiece|hat7/.test(x)))
    out.push(`head piece below the floor (${p.pose})`);
  if (parts.some((x) => /hand/.test(x))) out.push(`hands below the floor (${p.pose})`);
  if (parts.some((x) => /knee|leg|shin|Shin|ihram/.test(x)))
    out.push(`legs / feet below the floor (${p.pose})`);
  if (p.body > 4) out.push(`head piece inside the shoulders / torso (${p.pose})`);
  return out;
}

/** Count issue kinds per category for one audit run. */
function count(tag) {
  const r = JSON.parse(readFileSync(resolve(HERE, `audit-${tag}.json`), "utf8"));
  const c = {};
  const add = (cat, k) => {
    c[cat] = c[cat] || {};
    c[cat][k] = (c[cat][k] || 0) + 1;
  };
  r.pieces.forEach((p) => pieceIssues(p).forEach((k) => add(p.cat, k)));
  r.poses.forEach((p) => poseIssues(p).forEach((k) => add(p.cat, k)));
  return { c, face: r.faceBand };
}

const b = count("before");
const a = count("after");
console.log(`| category | issue | before | after |\n|---|---|---|---|`);
for (const cat of CATS) {
  const keys = [...new Set([...Object.keys(b.c[cat] || {}), ...Object.keys(a.c[cat] || {})])];
  let tb = 0;
  let ta = 0;
  keys.sort().forEach((k) => {
    const x = (b.c[cat] || {})[k] || 0;
    const y = (a.c[cat] || {})[k] || 0;
    tb += x;
    ta += y;
    console.log(`| ${cat} | ${k} | ${x} | ${y} |`);
  });
  console.log(`| **${cat}** | **total** | **${tb}** | **${ta}** |`);
}
console.log(`\nFace band before ${JSON.stringify(b.face)}, after ${JSON.stringify(a.face)}`);
