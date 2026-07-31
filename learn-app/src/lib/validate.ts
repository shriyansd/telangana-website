// Runtime content validation. Lightweight by design (no schema library):
// content shapes are simple and the checks that matter are semantic ones —
// missing correct answers, duplicate choices, dangling concept ids.

import type { Course, Exercise, Lesson, Story } from '../types/content';

export interface ValidationIssue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

const EXERCISE_TYPES = new Set([
  'listen_select', 'multiple_choice', 'image_match', 'word_tiles', 'fill_blank',
  'translate', 'dictation', 'script_build', 'sound_compare', 'dialogue',
  'story_checkpoint', 'match_pairs', 'categorize', 'speaking',
]);

const STATUSES = new Set(['draft', 'needs-review', 'reviewed', 'published', 'archived']);

export function validateExercise(ex: Exercise, where: string, knownConcepts?: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string) => issues.push({ level: 'error', where, message });
  const warn = (message: string) => issues.push({ level: 'warning', where, message });

  if (!ex.id) err('Exercise is missing an id.');
  if (!EXERCISE_TYPES.has(ex.type)) err(`Unknown exercise type "${ex.type}".`);
  if (!Array.isArray(ex.conceptIds) || ex.conceptIds.length === 0) warn('Exercise has no conceptIds: it will not affect mastery.');
  if (knownConcepts) {
    for (const c of ex.conceptIds ?? []) {
      if (!knownConcepts.has(c)) err(`Unknown concept id "${c}".`);
    }
  }

  const anyEx = ex as any;
  if (ex.type === 'fill_blank' && Array.isArray(anyEx.choices)) {
    // fill_blank choices are plain strings
    if (new Set(anyEx.choices).size !== anyEx.choices.length) err('Duplicate answer choices.');
    if (anyEx.answer && !anyEx.choices.includes(anyEx.answer)) err('fill_blank answer not present in choices.');
  } else if ('choices' in anyEx && Array.isArray(anyEx.choices)) {
    const texts = anyEx.choices.map((c: any) => c.telugu ?? c.english ?? c.id);
    if (new Set(texts).size !== texts.length) err('Duplicate answer choices.');
    if (Array.isArray(anyEx.correctChoiceIds)) {
      if (anyEx.correctChoiceIds.length === 0) err('No correct choice marked.');
      const ids = new Set(anyEx.choices.map((c: any) => c.id));
      for (const cid of anyEx.correctChoiceIds) {
        if (!ids.has(cid)) err(`correctChoiceIds references missing choice "${cid}".`);
      }
    }
  }
  if ((ex.type === 'translate' || ex.type === 'dictation') && (!anyEx.acceptedAnswers || anyEx.acceptedAnswers.length === 0)) {
    err('No acceptedAnswers provided.');
  }
  if (ex.type === 'word_tiles') {
    if (!Array.isArray(anyEx.tiles) || anyEx.tiles.length < 2) err('word_tiles needs at least 2 tiles.');
  }
  if ((ex.type === 'listen_select' || ex.type === 'dictation' || ex.type === 'sound_compare') && !anyEx.spoken?.telugu) {
    err('Audio exercise is missing "spoken" Telugu text (needed for transcript and fallback).');
  }
  return issues;
}

export function validateLesson(lesson: Lesson, knownConcepts?: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const where = `lesson ${lesson.id ?? '(no id)'}`;
  const err = (message: string) => issues.push({ level: 'error', where, message });
  const warn = (message: string) => issues.push({ level: 'warning', where, message });

  if (!lesson.id) err('Lesson missing id.');
  if (!lesson.title) err('Lesson missing title.');
  if (!STATUSES.has(lesson.status)) err(`Invalid status "${lesson.status}".`);
  if (!Array.isArray(lesson.exercises) || lesson.exercises.length === 0) err('Lesson has no exercises.');

  const ids = new Set<string>();
  for (const ex of lesson.exercises ?? []) {
    if (ids.has(ex.id)) err(`Duplicate exercise id "${ex.id}".`);
    ids.add(ex.id);
    issues.push(...validateExercise(ex, `${where} > exercise ${ex.id}`, knownConcepts));
  }

  const newLimit = lesson.newConceptLimit ?? 4;
  if ((lesson.conceptIds?.length ?? 0) > newLimit + 4) {
    warn(`Lesson introduces ${lesson.conceptIds.length} concepts: consider splitting (soft limit ${newLimit}).`);
  }
  return issues;
}

export function validateCourse(course: Course, lessonIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const where = `course ${course.id}`;
  if (!course.id) issues.push({ level: 'error', where, message: 'Course missing id.' });
  for (const unit of course.units ?? []) {
    for (const lid of unit.lessonIds ?? []) {
      if (!lessonIds.has(lid)) {
        issues.push({ level: 'error', where: `${where} > unit ${unit.id}`, message: `References missing lesson "${lid}".` });
      }
    }
  }
  return issues;
}

export function validateStory(story: Story): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const where = `story ${story.id}`;
  if (!story.id) issues.push({ level: 'error', where, message: 'Story missing id.' });
  if (!Array.isArray(story.lines) || story.lines.length === 0) issues.push({ level: 'error', where, message: 'Story has no lines.' });
  for (const cp of story.checkpoints ?? []) {
    if (cp.afterLine < 0 || cp.afterLine >= (story.lines?.length ?? 0)) {
      issues.push({ level: 'error', where, message: `Checkpoint afterLine ${cp.afterLine} is out of range.` });
    }
    issues.push(...validateExercise(cp.exercise, `${where} > checkpoint`));
  }
  return issues;
}
