// Optional per-course offline audio downloads, layered on the Cache API.
// The service worker (public/sw.js) handles app-shell caching; this module
// manages explicit unit/course audio downloads the learner opts into.

const AUDIO_CACHE = 'telugu-bata-audio-v1';
const UNITS_KEY = 'telugu-bata:offline-units';

export function swSupported(): boolean {
  return typeof caches !== 'undefined';
}

function base(): string {
  return (import.meta as any).env?.BASE_URL ?? '/';
}

/** Course id → audio directory prefix, e.g. course-1 → audio/course-1/ */
function unitAudioPaths(coursePrefix: string): string[] {
  // Audio manifests per course would be ideal; for now derive from the known
  // content layout. Missing files fail silently (they don't exist yet).
  return [`${base()}audio/${coursePrefix}/`];
}

export async function cachedUnits(): Promise<Set<string>> {
  try {
    const raw = localStorage.getItem(UNITS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function saveUnits(units: Set<string>): Promise<void> {
  try { localStorage.setItem(UNITS_KEY, JSON.stringify(Array.from(units))); } catch { /* ignore */ }
}

/**
 * Best-effort download of a course's audio into the cache. Files that don't
 * exist yet (placeholder content) are skipped without failing the download.
 */
export async function cacheUnitAudio(coursePrefix: string): Promise<void> {
  if (!swSupported()) return;
  const cache = await caches.open(AUDIO_CACHE);
  for (const prefix of unitAudioPaths(coursePrefix)) {
    // Without a server directory listing we rely on the audio manifest file if
    // present; otherwise nothing to prefetch yet.
    try {
      const res = await fetch(`${prefix}manifest.json`);
      if (res.ok) {
        const files: string[] = await res.json();
        for (const f of files) {
          try { await cache.add(prefix + f); } catch { /* skip missing file */ }
        }
      }
    } catch { /* offline or no manifest yet */ }
  }
  const units = await cachedUnits();
  units.add(coursePrefix);
  await saveUnits(units);
}

export async function removeUnitCache(coursePrefix: string): Promise<void> {
  if (!swSupported()) return;
  const cache = await caches.open(AUDIO_CACHE);
  const keys = await cache.keys();
  for (const req of keys) {
    if (req.url.includes(`/audio/${coursePrefix}/`)) await cache.delete(req);
  }
  const units = await cachedUnits();
  units.delete(coursePrefix);
  await saveUnits(units);
}
