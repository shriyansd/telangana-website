// Content loading. Course/concept metadata is eager (small); lesson and story
// bodies are code-split by Vite via import.meta.glob and loaded on demand,
// so the main bundle stays lean. Everything is validated on load in dev.

import type { Concept, Course, Lesson, Story } from '../types/content';
import { validateLesson, validateStory } from '../lib/validate';
import coursesJson from './courses.json';
import conceptsJson from './concepts.json';

export const courses = coursesJson as unknown as Course[];
export const concepts = conceptsJson as unknown as Concept[];
export const conceptById = new Map(concepts.map((c) => [c.id, c]));

const lessonModules = import.meta.glob('./lessons/*.json');
const storyModules = import.meta.glob('./stories/*.json');

const lessonCache = new Map<string, Lesson>();
let allLessonsCache: Lesson[] | null = null;

function warnIssues(issues: { level: string; where: string; message: string }[]): void {
  if (!(import.meta as any).env?.DEV) return;
  for (const i of issues) {
    // Developer-facing: surface content problems with their lesson/exercise ids.
    console[i.level === 'error' ? 'error' : 'warn'](`[content] ${i.where}: ${i.message}`);
  }
}

export async function loadLesson(lessonId: string): Promise<Lesson | null> {
  if (lessonCache.has(lessonId)) return lessonCache.get(lessonId)!;
  const path = `./lessons/${lessonId}.json`;
  const loader = lessonModules[path];
  if (!loader) return null;
  try {
    const mod: any = await loader();
    const lesson = (mod.default ?? mod) as Lesson;
    warnIssues(validateLesson(lesson, new Set(concepts.map((c) => c.id))));
    lessonCache.set(lessonId, lesson);
    return lesson;
  } catch (e) {
    console.error(`[content] failed to load lesson ${lessonId}`, e);
    return null;
  }
}

export async function loadAllLessons(): Promise<Lesson[]> {
  if (allLessonsCache) return allLessonsCache;
  const ids = allLessonIds();
  const loaded = await Promise.all(ids.map((id) => loadLesson(id)));
  allLessonsCache = loaded.filter((l): l is Lesson => l !== null);
  return allLessonsCache;
}

export function allLessonIds(): string[] {
  return courses.flatMap((c) => c.units.flatMap((u) => u.lessonIds));
}

export function findLessonMeta(lessonId: string): { course: Course; unitId: string } | null {
  for (const course of courses) {
    for (const unit of course.units) {
      if (unit.lessonIds.includes(lessonId)) return { course, unitId: unit.id };
    }
  }
  return null;
}

export async function loadStories(): Promise<Story[]> {
  const out: Story[] = [];
  for (const loader of Object.values(storyModules)) {
    try {
      const mod: any = await loader();
      const story = (mod.default ?? mod) as Story;
      warnIssues(validateStory(story));
      out.push(story);
    } catch (e) {
      console.error('[content] failed to load a story', e);
    }
  }
  return out;
}

/** Filter content by review status: production shows published only, unless the dev setting allows drafts. */
export function statusVisible(status: string, showDrafts: boolean): boolean {
  if (status === 'archived') return false;
  if (status === 'published' || status === 'reviewed') return true;
  return showDrafts;
}
