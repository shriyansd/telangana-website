#!/usr/bin/env node
// Content validation + CSV lesson import for Telugu Bata.
//
//   npm run validate-content              → validate all lessons/courses/stories
//   npm run validate-content -- --csv path/to/lessons.csv
//                                         → also convert a CSV into lesson JSON drafts
//
// The validator checks: JSON parse, required fields, duplicate ids, missing
// concept references, exercises without correct answers, duplicate choices,
// missing audio/image files, and lessons that introduce too many concepts.

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const contentDir = join(root, 'src', 'content');
const lessonsDir = join(contentDir, 'lessons');
const storiesDir = join(contentDir, 'stories');
const publicDir = join(root, 'public');

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const EXERCISE_TYPES = new Set([
  'listen_select', 'multiple_choice', 'image_match', 'word_tiles', 'fill_blank',
  'translate', 'dictation', 'script_build', 'sound_compare', 'dialogue',
  'story_checkpoint', 'match_pairs', 'categorize', 'speaking',
]);
const STATUSES = new Set(['draft', 'needs-review', 'reviewed', 'published', 'archived']);

function loadJson(path, where) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(where, `invalid JSON — ${e.message}`);
    return null;
  }
}

// ── load base content ──
const concepts = loadJson(join(contentDir, 'concepts.json'), 'concepts.json') ?? [];
const conceptIds = new Set(concepts.map((c) => c.id));
const courses = loadJson(join(contentDir, 'courses.json'), 'courses.json') ?? [];

const conceptIdDupes = concepts.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
for (const d of new Set(conceptIdDupes)) err('concepts.json', `duplicate concept id "${d}"`);

// example sentences: must have all three faces of the display pattern
for (const c of concepts) {
  if (c.example === undefined) continue;
  const where = `concepts.json:${c.id}`;
  for (const key of ['telugu', 'transliteration', 'english']) {
    if (typeof c.example[key] !== 'string' || c.example[key].trim() === '') {
      err(where, `example is missing "${key}" — sentences need Telugu, romanization and English`);
    }
  }
}

// ── audio helpers ──
const missingAudio = new Set();
function checkAudio(ref, where) {
  if (!ref) return;
  for (const key of ['normal', 'slow']) {
    const p = ref[key];
    if (p && !existsSync(join(publicDir, p))) missingAudio.add(p);
  }
}

// ── validate exercises ──
function validateExercise(ex, where) {
  if (!ex.id) err(where, 'exercise missing id');
  if (!EXERCISE_TYPES.has(ex.type)) err(where, `unknown exercise type "${ex.type}"`);
  if (!Array.isArray(ex.conceptIds) || ex.conceptIds.length === 0) warn(where, 'no conceptIds — will not affect mastery');
  for (const c of ex.conceptIds ?? []) {
    if (!conceptIds.has(c)) err(where, `unknown concept id "${c}"`);
  }
  if (ex.type === 'fill_blank' && ex.choices) {
    // fill_blank choices are plain strings; the answer must be among them
    if (new Set(ex.choices).size !== ex.choices.length) err(where, 'duplicate answer choices');
    if (ex.answer && !ex.choices.includes(ex.answer)) err(where, 'fill_blank answer not present in choices');
  } else if (ex.choices) {
    const texts = ex.choices.map((c) => c.telugu ?? c.english ?? c.id);
    if (new Set(texts).size !== texts.length) err(where, 'duplicate answer choices');
    if (ex.correctChoiceIds) {
      if (ex.correctChoiceIds.length === 0) err(where, 'no correct choice marked');
      const ids = new Set(ex.choices.map((c) => c.id));
      for (const cid of ex.correctChoiceIds) if (!ids.has(cid)) err(where, `correctChoiceIds references missing choice "${cid}"`);
    } else if (!['match_pairs', 'categorize'].includes(ex.type)) {
      err(where, 'choices present but no correctChoiceIds');
    }
  }
  if (['translate', 'dictation'].includes(ex.type) && !(ex.acceptedAnswers?.length)) err(where, 'no acceptedAnswers');
  if (ex.type === 'word_tiles' && (!ex.tiles || ex.tiles.length < 2)) err(where, 'word_tiles needs ≥2 tiles');
  if (['listen_select', 'dictation', 'sound_compare'].includes(ex.type) && !ex.spoken?.telugu) err(where, 'audio exercise missing spoken.telugu');
  checkAudio(ex.audio, where);
  if (ex.spoken?.audio) checkAudio(ex.spoken.audio, where);
  for (const t of ex.turns ?? []) if (t.line?.audio) checkAudio(t.line.audio, where);
  for (const c of ex.choices ?? []) {
    if (c.image && c.image.includes('/') && !existsSync(join(publicDir, c.image))) err(where, `missing image file ${c.image}`);
  }
}

// ── validate lessons ──
const lessonFiles = existsSync(lessonsDir) ? readdirSync(lessonsDir).filter((f) => f.endsWith('.json')) : [];
const lessonIds = new Set();
let exerciseCount = 0;
for (const file of lessonFiles) {
  const where = `lessons/${file}`;
  const lesson = loadJson(join(lessonsDir, file), where);
  if (!lesson) continue;
  if (!lesson.id) err(where, 'missing lesson id');
  if (lesson.id && file !== `${lesson.id}.json`) warn(where, `filename does not match lesson id "${lesson.id}"`);
  if (lessonIds.has(lesson.id)) err(where, `duplicate lesson id "${lesson.id}"`);
  lessonIds.add(lesson.id);
  if (!lesson.title) err(where, 'missing title');
  if (!STATUSES.has(lesson.status)) err(where, `invalid status "${lesson.status}"`);
  if (lesson.status === 'published' && !lesson.reviewer) err(where, 'published lesson has no reviewer recorded');
  if (!Array.isArray(lesson.exercises) || lesson.exercises.length === 0) err(where, 'no exercises');

  const exIds = new Set();
  for (const ex of lesson.exercises ?? []) {
    exerciseCount++;
    if (exIds.has(ex.id)) err(where, `duplicate exercise id "${ex.id}"`);
    exIds.add(ex.id);
    validateExercise(ex, `${where} › ${ex.id ?? '(no id)'}`);
  }
  const newLimit = lesson.newConceptLimit ?? 4;
  // newConceptLimit 0 = review/checkpoint lesson: conceptIds are practiced, not introduced.
  if (newLimit > 0 && (lesson.conceptIds?.length ?? 0) > newLimit + 4) {
    warn(where, `introduces ${lesson.conceptIds.length} concepts (soft limit ${newLimit})`);
  }

  // ── learning-quality checks (configurable warnings, not laws) ──
  // A unit shouldn't be all recognition (R4), should include listening and
  // some production (R7), and shouldn't over-use one exercise type (D2).
  const exs = lesson.exercises ?? [];
  // Performance tasks (checkpoint kind) are legitimately dialogue-heavy.
  if (exs.length >= 4 && lesson.kind !== 'checkpoint') {
    const PRODUCTION = new Set(['word_tiles', 'fill_blank', 'translate', 'dictation', 'speaking']);
    const LISTENING = new Set(['listen_select', 'sound_compare', 'dictation']);
    const typeCounts = {};
    for (const ex of exs) typeCounts[ex.type] = (typeCounts[ex.type] ?? 0) + 1;
    const [topType, topCount] = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const SINGLE_TYPE_MAX = 0.7;
    if (topCount / exs.length > SINGLE_TYPE_MAX) {
      warn(where, `${Math.round((topCount / exs.length) * 100)}% of exercises are "${topType}" — vary exercise types`);
    }
    const hasProduction = exs.some((e) => PRODUCTION.has(e.type) || (e.type === 'dialogue' && (e.responseMode === 'tiles' || e.responseMode === 'type')));
    if (!hasProduction && lesson.kind !== 'story' && lesson.kind !== 'checkpoint') {
      warn(where, 'no production exercise (tiles/blank/translate/dictation/speaking) — recognition alone cannot build production (R4)');
    }
    const hasListening = exs.some((e) => LISTENING.has(e.type));
    if (!hasListening && lesson.kind !== 'script') {
      warn(where, 'no listening exercise — add listen_select/dictation where audio permits (R8)');
    }
  }
  for (const c of lesson.conceptIds ?? []) if (!conceptIds.has(c)) err(where, `unknown concept id "${c}"`);
}

// ── validate courses ──
for (const course of courses) {
  const where = `courses.json › ${course.id}`;
  for (const unit of course.units ?? []) {
    for (const lid of unit.lessonIds ?? []) {
      if (!lessonIds.has(lid)) err(where, `unit ${unit.id} references missing lesson "${lid}"`);
    }
  }
}

// ── validate stories ──
const storyFiles = existsSync(storiesDir) ? readdirSync(storiesDir).filter((f) => f.endsWith('.json')) : [];
for (const file of storyFiles) {
  const where = `stories/${file}`;
  const story = loadJson(join(storiesDir, file), where);
  if (!story) continue;
  if (!story.id) err(where, 'missing story id');
  if (!STATUSES.has(story.status)) err(where, `invalid status "${story.status}"`);
  if (!Array.isArray(story.lines) || story.lines.length === 0) err(where, 'no lines');
  for (const l of story.lines ?? []) if (l.line?.audio) checkAudio(l.line.audio, where);
  for (const cp of story.checkpoints ?? []) {
    if (cp.afterLine < 0 || cp.afterLine >= (story.lines?.length ?? 0)) err(where, `checkpoint afterLine ${cp.afterLine} out of range`);
    validateExercise(cp.exercise, `${where} › checkpoint`);
  }
}

// ── optional CSV import ──
const csvFlag = process.argv.indexOf('--csv');
if (csvFlag !== -1 && process.argv[csvFlag + 1]) {
  importCsv(process.argv[csvFlag + 1]);
}

function parseCsv(text) {
  // Minimal CSV parser with quoted-field support.
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f.trim() !== '')) rows.push(row); }
  return rows;
}

function importCsv(csvPath) {
  console.log(`\nImporting CSV: ${csvPath}`);
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const header = rows[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const required = ['courseId', 'unitId', 'lessonId', 'lessonTitle', 'exerciseId', 'exerciseType', 'conceptIds'];
  for (const r of required) {
    if (idx(r) === -1) { err(`csv`, `missing required column "${r}"`); return; }
  }
  const lessons = new Map();
  for (const row of rows.slice(1)) {
    const get = (name) => (idx(name) === -1 ? '' : (row[idx(name)] ?? '').trim());
    const lessonId = get('lessonId');
    if (!lessons.has(lessonId)) {
      lessons.set(lessonId, {
        id: lessonId,
        courseId: get('courseId'),
        unitId: get('unitId'),
        title: get('lessonTitle'),
        description: get('lessonDescription') || get('lessonTitle'),
        estimatedMinutes: Number(get('estimatedMinutes') || 8),
        status: 'draft', // CSV imports always start as drafts
        difficulty: get('difficulty') || 'beginner',
        learnerPaths: (get('learnerPaths') || 'complete-beginner,heritage-learner').split(/[;,]/).map((s) => s.trim()),
        prerequisites: [],
        conceptIds: [],
        exercises: [],
        author: get('author') || 'csv-import',
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    }
    const lesson = lessons.get(lessonId);
    const conceptList = get('conceptIds').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    for (const c of conceptList) if (!lesson.conceptIds.includes(c)) lesson.conceptIds.push(c);

    const type = get('exerciseType');
    const ex = { id: get('exerciseId'), type, conceptIds: conceptList, prompt: get('prompt') || undefined };
    const telugu = get('telugu');
    const translit = get('transliteration');
    const english = get('english');
    const audio = get('audioFile') ? { normal: get('audioFile'), reviewStatus: 'draft' } : undefined;
    const answers = get('acceptedAnswers').split('|').map((s) => s.trim()).filter(Boolean);
    const wrong = get('incorrectChoices').split('|').map((s) => s.trim()).filter(Boolean);
    const fb = {};
    if (get('correctFeedback')) fb.correct = get('correctFeedback');
    if (get('incorrectFeedback')) fb.incorrect = get('incorrectFeedback');
    if (get('grammarNote')) fb.grammar = get('grammarNote');
    if (Object.keys(fb).length) ex.feedback = fb;

    switch (type) {
      case 'multiple_choice':
      case 'listen_select': {
        ex.choices = [
          { id: 'a', telugu, transliteration: translit, english },
          ...wrong.map((w, i) => ({ id: `w${i}`, telugu: w })),
        ];
        ex.correctChoiceIds = ['a'];
        if (type === 'listen_select') { ex.audio = audio ?? {}; ex.spoken = { telugu, transliteration: translit, english }; }
        else ex.question = { telugu, transliteration: translit, english };
        break;
      }
      case 'word_tiles':
        ex.direction = 'to-telugu';
        ex.source = { telugu, transliteration: translit, english };
        ex.tiles = telugu.split(/\s+/);
        ex.distractors = wrong;
        break;
      case 'translate':
        ex.direction = get('direction') === 'to-english' ? 'to-english' : 'to-telugu';
        ex.source = { telugu, transliteration: translit, english };
        ex.acceptedAnswers = answers.length ? answers : [ex.direction === 'to-english' ? english : telugu];
        break;
      case 'dictation':
        ex.audio = audio ?? {};
        ex.spoken = { telugu, transliteration: translit };
        ex.acceptedAnswers = answers.length ? answers : [telugu];
        break;
      case 'fill_blank':
        ex.sentence = { telugu, transliteration: translit, english };
        ex.answer = answers[0] ?? '';
        ex.choices = wrong.length ? [answers[0], ...wrong] : undefined;
        break;
      default:
        warn(`csv › ${ex.id}`, `type "${type}" not supported by the CSV importer — author it as JSON`);
        continue;
    }
    lesson.exercises.push(ex);
  }

  const outDir = join(root, 'scripts', 'imported');
  mkdirSync(outDir, { recursive: true });
  for (const [id, lesson] of lessons) {
    const outPath = join(outDir, `${id}.json`);
    writeFileSync(outPath, JSON.stringify(lesson, null, 2));
    console.log(`  wrote ${outPath}`);
  }
  console.log(`  → review the drafts, then move them into src/content/lessons/ and add ids to courses.json`);
}

// ── report ──
console.log(`\nTelugu Bata content check`);
console.log(`  ${lessonFiles.length} lessons, ${exerciseCount} exercises, ${concepts.length} concepts, ${storyFiles.length} stories`);
if (missingAudio.size) {
  console.log(`\n⏳ ${missingAudio.size} audio file(s) referenced but not yet recorded:`);
  for (const a of [...missingAudio].sort()) console.log(`   - ${a}`);
  console.log('   (allowed — the app shows a labelled placeholder until recordings land)');
}
if (warnings.length) {
  console.log(`\n⚠️  ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`   - ${w}`);
}
if (errors.length) {
  console.log(`\n❌ ${errors.length} error(s):`);
  for (const e of errors) console.log(`   - ${e}`);
  process.exit(1);
} else {
  console.log('\n✅ No blocking content errors.');
}
