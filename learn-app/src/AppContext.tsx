// App-wide state: settings (sync, localStorage) and async learner stats.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { LearnerProfile, LearnerSettings, StreakState, TransliterationMode, XPState } from './types/progress';
import { DEFAULT_PROFILE } from './types/progress';
import { getProfile, getSettings, getStreak, getXP, saveProfile, saveSettings, ensureSchemaVersion, storageHealthy, getAllMastery } from './lib/storage';

interface AppState {
  settings: LearnerSettings;
  updateSettings: (patch: Partial<LearnerSettings>) => void;
  profile: LearnerProfile;
  updateProfile: (patch: Partial<LearnerProfile>) => Promise<void>;
  xp: XPState | null;
  streak: StreakState | null;
  refreshStats: () => Promise<void>;
  storageOk: boolean;
  loaded: boolean;
  /** settings.transliteration with 'auto' resolved from reading mastery (H2):
   *  fades to tap-to-reveal once the learner reads Telugu reasonably well. */
  translitMode: Exclude<TransliterationMode, 'auto'>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<LearnerSettings>(() => getSettings());
  const [profile, setProfile] = useState<LearnerProfile>(DEFAULT_PROFILE);
  const [xp, setXp] = useState<XPState | null>(null);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [storageOk, setStorageOk] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [readingScore, setReadingScore] = useState(0);

  const refreshStats = useCallback(async () => {
    setXp(await getXP());
    setStreak(await getStreak());
    try {
      const mastery = await getAllMastery();
      let total = 0, n = 0;
      for (const m of mastery) {
        for (const k of ['reading', 'script'] as const) {
          const s = m.skills?.[k];
          if (s && s.successes + s.failures > 0) { total += s.score; n++; }
        }
      }
      setReadingScore(n >= 10 ? total / n : 0); // need real evidence before fading
    } catch { /* keep previous */ }
  }, []);

  const translitMode: Exclude<TransliterationMode, 'auto'> =
    settings.transliteration === 'auto'
      ? (readingScore >= 50 ? 'tap' : 'always')
      : settings.transliteration;

  useEffect(() => {
    ensureSchemaVersion();
    (async () => {
      setStorageOk(await storageHealthy());
      setProfile(await getProfile());
      await refreshStats();
      setLoaded(true);
    })();
  }, [refreshStats]);

  const updateSettings = useCallback((patch: Partial<LearnerSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateProfile = useCallback(async (patch: Partial<LearnerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      void saveProfile(next);
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ settings, updateSettings, profile, updateProfile, xp, streak, refreshStats, storageOk, loaded, translitMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
