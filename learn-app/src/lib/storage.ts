// IndexedDB persistence with a tiny promise wrapper (no external dependency).
// localStorage is used only for small preferences and the schema-version flag.

import {
  ConceptMastery, ExerciseAttempt, LessonProgress, MistakeRecord,
  StreakState, XPState, LearnerProfile, LearnerSettings,
  DEFAULT_SETTINGS, DEFAULT_PROFILE, PROGRESS_SCHEMA_VERSION, ProgressExport,
} from '../types/progress';

const DB_NAME = 'telugu-bata';
const DB_VERSION = 1;
const LS_PREFIX = 'telugu-bata:';

let dbPromise: Promise<IDBDatabase> | null = null;
let memoryFallback: Map<string, Map<string, any>> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('mastery')) db.createObjectStore('mastery', { keyPath: 'conceptId' });
      if (!db.objectStoreNames.contains('lessons')) db.createObjectStore('lessons', { keyPath: 'lessonId' });
      if (!db.objectStoreNames.contains('mistakes')) db.createObjectStore('mistakes', { keyPath: 'exerciseId' });
      if (!db.objectStoreNames.contains('attempts')) db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Graceful degradation: if IndexedDB fails (private mode, quota), fall back to
// in-memory storage so a lesson still works; the UI warns that saving is off.
async function db(): Promise<IDBDatabase | null> {
  try {
    return await openDb();
  } catch {
    if (!memoryFallback) memoryFallback = new Map();
    return null;
  }
}

export async function storageHealthy(): Promise<boolean> {
  return (await db()) !== null;
}

function mem(store: string): Map<string, any> {
  if (!memoryFallback) memoryFallback = new Map();
  if (!memoryFallback.has(store)) memoryFallback.set(store, new Map());
  return memoryFallback.get(store)!;
}

async function put(store: string, value: any, key?: string): Promise<void> {
  const d = await db();
  if (!d) { mem(store).set(key ?? value[keyPathOf(store)] ?? JSON.stringify(value), value); return; }
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite');
    const req = key !== undefined ? tx.objectStore(store).put(value, key) : tx.objectStore(store).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function keyPathOf(store: string): string {
  return store === 'mastery' ? 'conceptId' : store === 'lessons' ? 'lessonId' : store === 'mistakes' ? 'exerciseId' : 'id';
}

async function get<T>(store: string, key: string): Promise<T | undefined> {
  const d = await db();
  if (!d) return mem(store).get(key);
  return new Promise((resolve, reject) => {
    const req = d.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  const d = await db();
  if (!d) return Array.from(mem(store).values());
  return new Promise((resolve, reject) => {
    const req = d.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(store: string): Promise<void> {
  const d = await db();
  if (!d) { mem(store).clear(); return; }
  await new Promise<void>((resolve, reject) => {
    const req = d.transaction(store, 'readwrite').objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Mastery ──
export const getMastery = (conceptId: string) => get<ConceptMastery>('mastery', conceptId);
export const getAllMastery = () => getAll<ConceptMastery>('mastery');
export const saveMastery = (m: ConceptMastery) => put('mastery', m);

// ── Lessons ──
export const getLessonProgress = (lessonId: string) => get<LessonProgress>('lessons', lessonId);
export const getAllLessonProgress = () => getAll<LessonProgress>('lessons');
export const saveLessonProgress = (lp: LessonProgress) => put('lessons', lp);

// ── Mistakes ──
export const getAllMistakes = () => getAll<MistakeRecord>('mistakes');
export const saveMistake = (m: MistakeRecord) => put('mistakes', m);

// ── Attempts (log; capped pruning could be added later) ──
export const logAttempt = (a: ExerciseAttempt) => put('attempts', a);

// ── KV (streak, xp, profile) ──
export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const v = await get<T>('kv', key);
  return v === undefined ? fallback : v;
}
export const setKV = (key: string, value: any) => put('kv', value, key);

export const getStreak = () => getKV<StreakState>('streak', { current: 0, longest: 0, lastActiveDay: null });
export const saveStreak = (s: StreakState) => setKV('streak', s);
export const getXP = () =>
  getKV<XPState>('xp', {
    total: 0, today: 0, todayDate: '', minutesToday: 0, badges: [],
    lessonsCompleted: 0, reviewSessions: 0, speakingRecordings: 0, storiesCompleted: 0,
  });
export const saveXP = (x: XPState) => setKV('xp', x);
export const getProfile = () => getKV<LearnerProfile>('profile', DEFAULT_PROFILE);
export const saveProfile = (p: LearnerProfile) => setKV('profile', p);

// ── Settings (localStorage — small, synchronous) ──
export function getSettings(): LearnerSettings {
  try {
    const raw = localStorage.getItem(LS_PREFIX + 'settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: LearnerSettings): void {
  try { localStorage.setItem(LS_PREFIX + 'settings', JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Schema version + migrations ──
export function ensureSchemaVersion(): void {
  try {
    const v = Number(localStorage.getItem(LS_PREFIX + 'schema') || '0');
    if (v < PROGRESS_SCHEMA_VERSION) {
      // Future migrations run here, keyed on the stored version.
      localStorage.setItem(LS_PREFIX + 'schema', String(PROGRESS_SCHEMA_VERSION));
    }
  } catch { /* ignore */ }
}

// ── Export / import / reset ──
export async function exportProgress(): Promise<ProgressExport> {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: await getProfile(),
    settings: getSettings(),
    mastery: await getAllMastery(),
    lessons: await getAllLessonProgress(),
    mistakes: await getAllMistakes(),
    streak: await getStreak(),
    xp: await getXP(),
  };
}

export function validateImport(data: any): { ok: boolean; error?: string } {
  if (!data || typeof data !== 'object') return { ok: false, error: 'File is not a progress export.' };
  if (typeof data.schemaVersion !== 'number') return { ok: false, error: 'Missing schema version.' };
  if (data.schemaVersion > PROGRESS_SCHEMA_VERSION) return { ok: false, error: 'This export is from a newer app version. Update the app first.' };
  if (!Array.isArray(data.mastery) || !Array.isArray(data.lessons)) return { ok: false, error: 'Export is missing progress data.' };
  for (const m of data.mastery) {
    if (typeof m.conceptId !== 'string' || typeof m.masteryScore !== 'number') {
      return { ok: false, error: 'Mastery records are malformed.' };
    }
  }
  return { ok: true };
}

export async function importProgress(data: ProgressExport): Promise<void> {
  const check = validateImport(data);
  if (!check.ok) throw new Error(check.error);
  for (const m of data.mastery) await saveMastery(m);
  for (const l of data.lessons) await saveLessonProgress(l);
  for (const mi of data.mistakes ?? []) await saveMistake(mi);
  // Never lose the better streak/XP: keep the max of local and imported.
  const localXp = await getXP();
  const localStreak = await getStreak();
  if (data.xp) await saveXP(data.xp.total >= localXp.total ? data.xp : localXp);
  if (data.streak) await saveStreak(data.streak.current >= localStreak.current ? data.streak : localStreak);
  if (data.profile) await saveProfile(data.profile);
  if (data.settings) saveSettings(data.settings);
}

export async function resetProgress(): Promise<void> {
  for (const s of ['mastery', 'lessons', 'mistakes', 'attempts', 'kv']) await clearStore(s);
  try {
    localStorage.removeItem(LS_PREFIX + 'settings');
  } catch { /* ignore */ }
}
