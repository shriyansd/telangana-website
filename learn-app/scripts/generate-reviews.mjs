#!/usr/bin/env node
// Gives every unit the full learning-design treatment:
//  1. communicationGoal / canDoStatement / scenario written into courses.json
//  2. a generated "<unitId>-review" checkpoint lesson (varied retrieval over the
//     unit's own concepts — no new Telugu, so nothing new to review)
//  3. finalPerformanceTaskLessonId wiring where a performance task exists
// Idempotent: re-running overwrites generated review lessons.
//
//   node scripts/generate-reviews.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const contentDir = join(root, 'src', 'content');
const lessonsDir = join(contentDir, 'lessons');

const courses = JSON.parse(readFileSync(join(contentDir, 'courses.json'), 'utf8'));
const concepts = JSON.parse(readFileSync(join(contentDir, 'concepts.json'), 'utf8'));
const conceptById = new Map(concepts.map((c) => [c.id, c]));

/** Unit learning designs (D1/R11). Performance tasks are separate lessons. */
const UNIT_DESIGNS = {
  'c0-u1': { goal: 'Understand how Telugu works and where to start.', canDo: 'I know what the course covers and where my starting point is.' },
  'c6-u1': { goal: 'Recognize your first Telugu letters inside real words.', canDo: 'I can recognize అ, ఆ, ఇ, క and మ, and read అమ్మ.' },
  'c6-u2': { goal: 'Recognize every Telugu vowel by sight and sound.', canDo: 'I can name all the Telugu vowels when I see or hear them.' },
  'c6-u3': { goal: 'Recognize the Telugu consonants row by row.', canDo: 'I can identify the consonants and tell hard (ట) from soft (త) sounds.' },
  'c6-u4': { goal: 'Read any consonant with any vowel sign.', canDo: 'I can read syllables like కా, కి, మా, తో on sight.' },
  'c6-u5': { goal: 'Read doubled letters (vattulu) inside words.', canDo: 'I can read words with doubles like అక్క and అమ్మ.' },
  'c6-u6': { goal: 'Read real Telugu words without help.', canDo: 'I can read familiar words (అమ్మ, పాలు, నమస్కారం) without transliteration.', task: 'c6-u6-l3' },
  'c1-u1': { goal: 'Greet an elder respectfully, introduce yourself, and ask how they are.', canDo: 'I can greet someone respectfully, say my name, ask theirs, ask how they are, and say goodbye.', task: 'c1-u1-l6', skipReview: true },
  'c1-u2': { goal: 'Answer politely and talk about your family.', canDo: 'I can say yes and no politely and name the people in my family.', task: 'c1-u2-task' },
  'c10-u1': { goal: 'Use the little words that glue every sentence together.', canDo: 'I can point things out, say what is mine and yours, and say where people are.', task: 'c10-u1-task' },
  'c3-u1': { goal: 'Count and use numbers in real requests.', canDo: 'I can count to one hundred and ask for a number of things.', task: 'c3-u1-task' },
  'c2-u1': { goal: 'Ask for food and drink and say what you like.', canDo: 'I can ask for what I want at the table and say what I like or have had enough of.', task: 'c2-u1-task' },
  'c2-u2': { goal: 'Describe your home and the colors around you.', canDo: 'I can name the rooms and things at home and the colors I see.' },
  'c4-u1': { goal: 'Talk about the days of the week.', canDo: 'I can say which day it is and name the whole week.' },
  'c4-u2': { goal: 'Place events in time.', canDo: 'I can say today, tomorrow, yesterday, and the time of day.' },
  'c5-u1': { goal: 'Ask the five essential questions.', canDo: 'I can ask what, who, where, why and how.' },
  'c5-u2': { goal: 'Talk about places and where things are.', canDo: 'I can name places in town and say if they are near, far, left or right.' },
  'c8-u1': { goal: 'Use everyday verbs and make polite requests.', canDo: 'I can use basic verbs, make respectful requests, and say what I am doing.' },
  'c11-u1': { goal: 'Build your own correct Telugu sentences.', canDo: 'I can build sentences with the verb last, make plurals, join ideas, ask yes/no questions, and use past and future.', task: 'c11-u1-task' },
  'c7-u1': { goal: 'Hold a warm conversation with family elders.', canDo: 'I can visit an elder, respond politely, and follow everyday family talk.' },
};

function reviewLesson(courseId, unit, conceptIds) {
  const pool = conceptIds.map((id) => conceptById.get(id)).filter((c) => c && c.english);
  if (pool.length < 3) return null;
  const pick = pool.slice(0, 8);
  const ex = [];
  let n = 0;
  const eid = () => `${unit.id}-review-e${++n}`;
  const others = (i, k) => {
    const out = [];
    for (let d = 1; out.length < k && d <= pick.length; d++) out.push(pick[(i + d) % pick.length]);
    return out;
  };

  pick.forEach((c, i) => {
    const ds = others(i, 2);
    if (i % 3 === 0) {
      ex.push({
        id: eid(), type: 'multiple_choice', conceptIds: [c.id],
        prompt: 'Quick check, what does this mean?',
        question: { telugu: c.telugu, transliteration: c.transliteration },
        choices: [{ id: 'a', english: c.english }, ...ds.map((d, j) => ({ id: 'bc'[j], english: d.english }))],
        correctChoiceIds: ['a'],
      });
    } else if (i % 3 === 1) {
      ex.push({
        id: eid(), type: 'multiple_choice', conceptIds: [c.id],
        prompt: `How do you say “${c.english}”?`,
        choices: [{ id: 'a', telugu: c.telugu, transliteration: c.transliteration }, ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.telugu, transliteration: d.transliteration }))],
        correctChoiceIds: ['a'],
      });
    } else {
      ex.push({
        id: eid(), type: 'translate', direction: 'to-english', conceptIds: [c.id],
        prompt: 'Translate to English.',
        source: { telugu: c.telugu, transliteration: c.transliteration },
        acceptedAnswers: [...new Set([c.english, ...c.english.split(/\s*\/\s*/), c.english.replace(/\s*\([^)]*\)/g, '').trim()])].filter(Boolean),
      });
    }
  });
  ex.push({
    id: eid(), type: 'match_pairs', mode: 'telugu-english',
    conceptIds: pick.slice(0, 4).map((c) => c.id),
    prompt: 'One last sweep, match them all.',
    pairs: pick.slice(0, 4).map((c) => ({ a: { telugu: c.telugu, transliteration: c.transliteration }, b: { telugu: c.english } })),
  });

  return {
    id: `${unit.id}-review`,
    courseId, unitId: unit.id,
    title: `Unit Review: ${unit.title.replace(/\s*·.*$/, '')}`,
    teluguTitle: 'పునశ్చరణ',
    description: 'Everything from this unit, retrieved in a mixed order.',
    estimatedMinutes: 5,
    status: 'draft',
    difficulty: 'beginner',
    learnerPaths: ['complete-beginner', 'heritage-learner', 'family'],
    prerequisites: unit.lessonIds.filter((id) => !id.endsWith('-review') && !id.endsWith('-task')),
    conceptIds: pick.map((c) => c.id),
    newConceptLimit: 0,
    kind: 'checkpoint',
    exercises: ex,
    author: 'seed-content',
    updatedAt: '2026-07-03',
  };
}

// unit → concepts, from the lesson files themselves
const lessonConcepts = new Map();
for (const f of readdirSync(lessonsDir).filter((x) => x.endsWith('.json'))) {
  const l = JSON.parse(readFileSync(join(lessonsDir, f), 'utf8'));
  if (!lessonConcepts.has(l.unitId)) lessonConcepts.set(l.unitId, new Set());
  for (const c of l.conceptIds ?? []) lessonConcepts.get(l.unitId).add(c);
}

let made = 0;
for (const course of courses) {
  for (const unit of course.units) {
    const design = UNIT_DESIGNS[unit.id];
    if (design) {
      unit.communicationGoal = design.goal;
      unit.canDoStatement = design.canDo;
      if (design.task) unit.finalPerformanceTaskLessonId = design.task;
    }
    if (design?.skipReview) continue;
    const reviewId = `${unit.id}-review`;
    const conceptIds = [...(lessonConcepts.get(unit.id) ?? [])];
    const lesson = reviewLesson(course.id, unit, conceptIds);
    if (!lesson) continue;
    writeFileSync(join(lessonsDir, `${reviewId}.json`), JSON.stringify(lesson, null, 2) + '\n');
    made++;
    if (!unit.lessonIds.includes(reviewId)) {
      // review goes after teaching lessons, before the performance task
      const taskIdx = design?.task ? unit.lessonIds.indexOf(design.task) : -1;
      if (taskIdx >= 0) unit.lessonIds.splice(taskIdx, 0, reviewId);
      else unit.lessonIds.push(reviewId);
    }
  }
}

writeFileSync(join(contentDir, 'courses.json'), JSON.stringify(courses, null, 2) + '\n');
console.log(`✅ ${made} unit reviews generated; unit designs written to courses.json`);
