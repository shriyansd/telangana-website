import { describe, it, expect } from 'vitest';
import { validateLesson, validateExercise } from '../src/lib/validate';
import { transliterate } from '../src/lib/translit';
import { validateImport } from '../src/lib/storage';
import { PROGRESS_SCHEMA_VERSION } from '../src/types/progress';
import type { Lesson, Exercise } from '../src/types/content';

const goodLesson: Lesson = {
  id: 'l1', courseId: 'c1', unitId: 'u1', title: 'T', description: 'd', estimatedMinutes: 5,
  status: 'draft', difficulty: 'beginner', learnerPaths: ['complete-beginner'],
  prerequisites: [], conceptIds: ['x'],
  exercises: [
    {
      id: 'e1', type: 'multiple_choice', conceptIds: ['x'],
      question: { telugu: 'అ' },
      choices: [{ id: 'a', telugu: 'అ' }, { id: 'b', telugu: 'ఆ' }],
      correctChoiceIds: ['a'],
    } as Exercise,
  ],
} as Lesson;

describe('content validation', () => {
  it('accepts a valid lesson', () => {
    const issues = validateLesson(goodLesson, new Set(['x']));
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });

  it('rejects an exercise with no correct choice', () => {
    const bad = { ...goodLesson.exercises[0], correctChoiceIds: [] } as Exercise;
    const issues = validateExercise(bad, 'test');
    expect(issues.some((i) => i.level === 'error' && i.message.includes('correct'))).toBe(true);
  });

  it('rejects duplicate choices and unknown concepts', () => {
    const bad = {
      ...goodLesson.exercises[0],
      choices: [{ id: 'a', telugu: 'అ' }, { id: 'b', telugu: 'అ' }],
      conceptIds: ['nope'],
    } as Exercise;
    const issues = validateExercise(bad, 'test', new Set(['x']));
    expect(issues.some((i) => i.message.includes('Duplicate'))).toBe(true);
    expect(issues.some((i) => i.message.includes('nope'))).toBe(true);
  });

  it('rejects a lesson with duplicate exercise ids', () => {
    const bad = { ...goodLesson, exercises: [goodLesson.exercises[0], goodLesson.exercises[0]] };
    const issues = validateLesson(bad as Lesson);
    expect(issues.some((i) => i.message.includes('Duplicate exercise id'))).toBe(true);
  });
});

describe('progress import validation', () => {
  it('accepts a well-formed export', () => {
    expect(validateImport({ schemaVersion: PROGRESS_SCHEMA_VERSION, mastery: [], lessons: [] }).ok).toBe(true);
  });
  it('rejects junk and newer versions', () => {
    expect(validateImport(null).ok).toBe(false);
    expect(validateImport({}).ok).toBe(false);
    expect(validateImport({ schemaVersion: PROGRESS_SCHEMA_VERSION + 1, mastery: [], lessons: [] }).ok).toBe(false);
    expect(validateImport({ schemaVersion: 1, mastery: [{ conceptId: 1 }], lessons: [] }).ok).toBe(false);
  });
});

describe('transliteration', () => {
  it('produces Telugu candidates for simple words', () => {
    const cands = transliterate('amma');
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0]).toContain('మ');
  });
  it('offers alternates for ambiguous letters', () => {
    const cands = transliterate('nenu');
    expect(cands.length).toBeGreaterThan(1);
    expect(cands.some((c) => c.includes('నే') || c.includes('నె'))).toBe(true);
  });
  it('handles empty input', () => {
    expect(transliterate('')).toEqual([]);
  });
});
