// Turns a captured-strokes.json (from review/stroke-capture.html) into
// src/content/stroke-data.ts. Simplifies each stroke with Ramer–Douglas–Peucker
// so the data is compact, clamps to the 0..100 box, and preserves the letter
// order and concept mapping the app expects.
//
// Run: node scripts/apply-captured-strokes.mjs [path/to/captured-strokes.json]
//   (defaults to review/captured-strokes.json)

import { transform } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inPath = process.argv[2] || join(root, 'review', 'captured-strokes.json');

async function loadTs(rel) {
  const src = readFileSync(join(root, rel), 'utf8');
  const js = (await transform(src, { loader: 'ts', format: 'esm' })).code;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { VOWELS, CONSONANTS } = await loadTs('src/content/script-data.ts');
const { LETTER_STROKES } = await loadTs('src/content/stroke-data.ts');
const orderedGlyphs = [...VOWELS, ...CONSONANTS].map((l) => l.telugu).filter((g) => LETTER_STROKES[g]);

const captured = JSON.parse(readFileSync(inPath, 'utf8'));
const byConcept = new Map((captured.letters || []).map((l) => [l.conceptId, l]));

// ── Ramer–Douglas–Peucker ──
const clamp = (v) => Math.max(0, Math.min(100, v));
function perp(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perp(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const left = rdp(pts.slice(0, idx + 1), eps);
    const right = rdp(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}
const round = (v) => Math.round(clamp(v) * 10) / 10;
const simplify = (stroke) => rdp(stroke.map((p) => [clamp(p[0]), clamp(p[1])]), 1.6).map((p) => [round(p[0]), round(p[1])]);

// ── build data + report ──
const entries = [];
const missing = [];
let strokeTotal = 0;
for (const glyph of orderedGlyphs) {
  const conceptId = LETTER_STROKES[glyph].conceptId;
  const cap = byConcept.get(conceptId);
  const raw = (cap?.strokes || []).filter((s) => s.length >= 2);
  if (raw.length === 0) { missing.push(glyph); continue; }
  const strokes = raw.map(simplify).filter((s) => s.length >= 2);
  strokeTotal += strokes.length;
  entries.push({ glyph, conceptId, strokes });
}

if (missing.length) {
  console.warn(`⚠️  ${missing.length} letter(s) have no captured strokes and were left out: ${missing.join(' ')}`);
  console.warn('   Capture them in review/stroke-capture.html, re-export, and run this again.');
}
if (entries.length === 0) { console.error('No strokes found — nothing written.'); process.exit(1); }

const body = entries.map((e) =>
  `  ${JSON.stringify(e.glyph)}: {\n    conceptId: ${JSON.stringify(e.conceptId)},\n    strokes: [\n${
    e.strokes.map((s) => '      ' + JSON.stringify(s)).join(',\n')
  },\n    ],\n  },`).join('\n');

const out = `// Stroke-order data for the base letters (అచ్చులు + హల్లులు) shown in
// script-data.ts. Each stroke is an ordered point sequence on a 100×100 grid
// (0,0 = top-left); point order encodes stroke direction.
//
// GENERATED from a native writer's handwriting via review/stroke-capture.html
// and scripts/apply-captured-strokes.mjs. The faded guide glyph in the app is
// rendered at 72px with baseline y=79 in this same 100-box, so these strokes
// overlay it directly. To revise: recapture in the tool and re-run the script.
//
// Compound letters / conjuncts (వత్తులు) are a separate "level 2" module.

export type StrokePoints = [number, number][];

export interface LetterStrokeDef {
  /** Concept id from concepts.json — tracing feeds the same mastery record. */
  conceptId: string;
  strokes: StrokePoints[];
}

export const LETTER_STROKES: Record<string, LetterStrokeDef> = {
${body}
};

/** Ordered list of glyphs that have stroke data (vowels first, then consonants). */
export function strokeGlyphs(): string[] {
  return Object.keys(LETTER_STROKES);
}
`;

writeFileSync(join(root, 'src/content/stroke-data.ts'), out);
console.log(`✅ Wrote src/content/stroke-data.ts — ${entries.length} letters, ${strokeTotal} strokes.`);
console.log('   Next: npm test && npm run build');
