#!/usr/bin/env node
// Native-speaker review report (spec §29): every draft/needs-review lesson's
// Telugu, with transliteration, meaning, teaching point, and a status column
// for reviewers to fill in. Regenerate any time:
//   node scripts/review-report.mjs   →  docs/content-review-report.md

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lessonsDir = join(root, 'src', 'content', 'lessons');
const storiesDir = join(root, 'src', 'content', 'stories');
const outPath = join(root, '..', 'docs', 'content-review-report.md');

function collectStrings(ex) {
  const out = [];
  const push = (t) => { if (t?.telugu?.trim()) out.push({ te: t.telugu, tr: t.transliteration ?? '', en: t.english ?? '' }); };
  push(ex.spoken); push(ex.question); push(ex.source); push(ex.model); push(ex.target); push(ex.sentence);
  for (const c of ex.choices ?? []) if (typeof c === 'object') push(c);
  for (const p of ex.pairs ?? []) { push(p.a); }
  for (const t of ex.turns ?? []) push(t.line);
  for (const a of ex.acceptedAnswers ?? []) if (/[ఀ-౿]/.test(a)) out.push({ te: a, tr: '', en: '(accepted answer)' });
  return out;
}

const lines = [];
lines.push('# Content review report — for native Telugu speakers');
lines.push('');
lines.push('Every lesson below is **unreviewed draft**. For each row: confirm or correct');
lines.push('the Telugu, note formality/regional issues, and initial the Reviewed column.');
lines.push('When a whole lesson is confirmed, a maintainer sets its `status` to');
lines.push('`reviewed` and records the reviewer in the lesson file.');
lines.push('');
lines.push('Formality default: **respectful/neutral standard Telugu** unless marked.');
lines.push('Telangana/colloquial variants are welcome — label them, never "fix" them.');
lines.push('');

let lessonCount = 0, stringCount = 0;
const files = readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort();
for (const f of files) {
  const l = JSON.parse(readFileSync(join(lessonsDir, f), 'utf8'));
  if (!['draft', 'needs-review'].includes(l.status)) continue;
  lessonCount++;
  const seen = new Set();
  const rows = [];
  for (const ex of l.exercises ?? []) {
    for (const s of collectStrings(ex)) {
      const key = s.te;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(s);
    }
  }
  if (rows.length === 0) continue;
  stringCount += rows.length;
  lines.push(`## ${l.id} — ${l.title} (${l.status})`);
  lines.push('');
  lines.push(`*Teaching point: ${l.description ?? ''}*`);
  lines.push('');
  lines.push('| Telugu | Transliteration | English | Formality/Region | Reviewed |');
  lines.push('|--------|-----------------|---------|------------------|----------|');
  for (const r of rows) {
    lines.push(`| ${r.te} | ${r.tr} | ${r.en.replace(/\|/g, '/')} | standard | |`);
  }
  lines.push('');
}

if (readdirSync(storiesDir ?? '.').length) {
  for (const f of readdirSync(storiesDir).filter((x) => x.endsWith('.json'))) {
    const s = JSON.parse(readFileSync(join(storiesDir, f), 'utf8'));
    if (!['draft', 'needs-review'].includes(s.status)) continue;
    lines.push(`## story: ${s.id} — ${s.title} (${s.status})`);
    lines.push('');
    lines.push('| Telugu | Transliteration | English | Formality/Region | Reviewed |');
    lines.push('|--------|-----------------|---------|------------------|----------|');
    for (const line of s.lines ?? []) {
      if (line.line?.telugu) {
        lines.push(`| ${line.line.telugu} | ${line.line.transliteration ?? ''} | ${(line.line.english ?? '').replace(/\|/g, '/')} | standard | |`);
        stringCount++;
      }
    }
    lines.push('');
  }
}

lines.splice(2, 0, `**${lessonCount} lessons · ${stringCount} unique Telugu strings awaiting review.**`, '');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`✅ wrote ${outPath} — ${lessonCount} lessons, ${stringCount} strings`);
