// Profile & settings for anonymous learners: preferences, progress export/
// import/reset, offline downloads, and privacy explanation.

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { Link } from '../router';
import { exportProgress, importProgress, validateImport, resetProgress, getAllMastery } from '../lib/storage';
import { BADGES } from '../lib/gamify';
import { cacheUnitAudio, cachedUnits, removeUnitCache, swSupported } from '../lib/offline';
import { courses } from '../content';
import { speechRecognitionSupported } from '../lib/speech';

export function Settings() {
  const { settings, updateSettings, profile, updateProfile, xp, streak } = useApp();
  const [conceptCount, setConceptCount] = useState(0);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [offline, setOffline] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllMastery().then((m) => setConceptCount(m.length)).catch(() => {});
    cachedUnits().then(setOffline).catch(() => {});
  }, []);

  const doExport = async () => {
    const data = await exportProgress();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telugu-bata-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    setImportMsg(null);
    try {
      const data = JSON.parse(await file.text());
      const check = validateImport(data);
      if (!check.ok) { setImportMsg(`❌ ${check.error}`); return; }
      const existing = await getAllMastery();
      if (existing.length > 0) {
        const ok = window.confirm(
          `You already have local progress (${existing.length} concepts). Importing will merge, keeping the better streak and XP. Continue?`,
        );
        if (!ok) return;
      }
      await importProgress(data);
      setImportMsg('✅ Progress imported. Reload to see everything updated.');
    } catch {
      setImportMsg('❌ That file could not be read as a progress export.');
    }
  };

  const toggleOffline = async (unitPrefix: string) => {
    if (offline.has(unitPrefix)) {
      await removeUnitCache(unitPrefix);
    } else {
      await cacheUnitAudio(unitPrefix);
    }
    setOffline(await cachedUnits());
  };

  return (
    <div className="settings-page">
      <h1>You & settings</h1>

      <section className="set-section">
        <h2>Progress</h2>
        <div className="profile-stats">
          <span>⭐ {xp?.total ?? 0} XP</span>
          <span>🔥 {streak?.current ?? 0}-day streak</span>
          <span>🧠 {conceptCount} concepts practiced</span>
          <span>📘 {xp?.lessonsCompleted ?? 0} lessons</span>
        </div>
        {xp && xp.badges.length > 0 && (
          <div className="badge-row">
            {xp.badges.map((id) => {
              const b = BADGES.find((x) => x.id === id);
              return b ? <span key={id} className="badge-chip" title={b.description}>{b.icon} {b.title}</span> : null;
            })}
          </div>
        )}
      </section>

      <section className="set-section">
        <h2>Learning</h2>
        <label className="set-row">
          <span>Daily goal</span>
          <select value={settings.dailyGoalMinutes} onChange={(e) => updateSettings({ dailyGoalMinutes: Number(e.target.value) as any })}>
            {[5, 10, 15, 20].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </label>
        <label className="set-row">
          <span>Transliteration (pronunciation text)</span>
          <select value={settings.transliteration} onChange={(e) => updateSettings({ transliteration: e.target.value as any })}>
            <option value="auto">Fade out as my reading improves</option>
            <option value="always">Always show</option>
            <option value="tap">Show when tapped</option>
            <option value="never">Telugu only</option>
          </select>
        </label>
        <label className="set-row">
          <span>Learner path</span>
          <select value={profile.path ?? 'complete-beginner'} onChange={(e) => void updateProfile({ path: e.target.value as any })}>
            <option value="complete-beginner">Complete beginner</option>
            <option value="heritage-learner">Heritage learner</option>
            <option value="family">Family learning</option>
          </select>
        </label>
      </section>

      <section className="set-section">
        <h2>Audio & speech</h2>
        <label className="set-row">
          <span>Auto-play exercise audio</span>
          <input type="checkbox" checked={settings.audioAutoplay} onChange={(e) => updateSettings({ audioAutoplay: e.target.checked })} />
        </label>
        <label className="set-row">
          <span>Audio speed</span>
          <select value={settings.audioRate} onChange={(e) => updateSettings({ audioRate: Number(e.target.value) })}>
            <option value={1}>Normal</option>
            <option value={0.85}>Slightly slow</option>
            <option value={0.7}>Slow</option>
          </select>
        </label>
        <label className="set-row">
          <span>Synthetic voice where recordings are missing <small>(clearly labelled placeholder)</small></span>
          <input type="checkbox" checked={settings.synthFallback} onChange={(e) => updateSettings({ synthFallback: e.target.checked })} />
        </label>
        <label className="set-row">
          <span>
            Experimental speech transcription
            <small>{speechRecognitionSupported() ? ' Uses your browser’s speech service.' : ' Not supported by this browser.'}</small>
          </span>
          <input type="checkbox" checked={settings.speechRecognition} disabled={!speechRecognitionSupported()}
            onChange={(e) => updateSettings({ speechRecognition: e.target.checked })} />
        </label>
      </section>

      <section className="set-section">
        <h2>Display & accessibility</h2>
        <label className="set-row">
          <span>Theme</span>
          <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as any })}>
            <option value="auto">Match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="set-row">
          <span>Text size</span>
          <select value={settings.textScale} onChange={(e) => updateSettings({ textScale: e.target.value as any })}>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="larger">Larger</option>
          </select>
        </label>
        <label className="set-row">
          <span>Show meanings during listening <small>Off = answer by ear first (meanings appear after). On = always visible (accessibility).</small></span>
          <input type="checkbox" checked={settings.listeningTranscripts === 'always'}
            onChange={(e) => updateSettings({ listeningTranscripts: e.target.checked ? 'always' : 'delayed' })} />
        </label>
        <label className="set-row">
          <span>Reduce motion</span>
          <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} />
        </label>
        <label className="set-row">
          <span>Sound effects</span>
          <input type="checkbox" checked={settings.soundEffects} onChange={(e) => updateSettings({ soundEffects: e.target.checked })} />
        </label>
        <label className="set-row">
          <span>Show draft (unreviewed) lessons <small>All sample content is draft until native speakers review it.</small></span>
          <input type="checkbox" checked={settings.showDraftContent} onChange={(e) => updateSettings({ showDraftContent: e.target.checked })} />
        </label>
      </section>

      <section className="set-section">
        <h2>Offline lessons</h2>
        {swSupported() ? (
          <>
            <p className="set-note">The app shell caches automatically. Download a course's audio for fully offline practice:</p>
            {courses.map((c) => (
              <label key={c.id} className="set-row">
                <span>{c.title}</span>
                <button type="button" className="btn-ghost" onClick={() => toggleOffline(c.id)}>
                  {offline.has(c.id) ? 'Remove download' : 'Download audio'}
                </button>
              </label>
            ))}
          </>
        ) : (
          <p className="set-note">Offline caching needs a browser with service-worker support and an HTTPS connection.</p>
        )}
      </section>

      <section className="set-section">
        <h2>Your data</h2>
        <p className="set-note">
          Everything lives in this browser. No account, no tracking, no uploads. Export a file to move
          progress to another device.
        </p>
        <div className="data-actions">
          <button type="button" className="btn-ghost" onClick={doExport}>⬇️ Export progress</button>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>⬆️ Import progress</button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
          {!confirmReset ? (
            <button type="button" className="btn-danger" onClick={() => setConfirmReset(true)}>Reset all progress</button>
          ) : (
            <span className="reset-confirm">
              Really erase everything? This cannot be undone.
              <button type="button" className="btn-danger" onClick={async () => { await resetProgress(); window.location.reload(); }}>Yes, erase</button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </span>
          )}
        </div>
        {importMsg && <p className="import-msg" role="status">{importMsg}</p>}
      </section>

      <p className="set-footer"><Link to="about">About the course, method & privacy →</Link></p>
    </div>
  );
}
