// Word Book: a searchable dictionary of every concept in the course, with the
// learner's mastery shown per word, plus personal "memory hooks" — learner-
// written mnemonics (P2: Memrise's mems; R12: keyword-mnemonic research).
// All local — hooks live in IndexedDB alongside the rest of progress.

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { concepts } from '../content';
import { getAllMastery, getKV, setKV } from '../lib/storage';
import { masteryLabel } from '../lib/srs';
import { TeluguText } from '../components/ui';
import { playPrompt } from '../lib/audio';
import type { ConceptMastery } from '../types/progress';

function SpeakButton({ telugu }: { telugu: string }) {
  return (
    <button
      type="button" className="word-speak"
      onClick={() => void playPrompt(undefined, telugu, { slow: false })}
      aria-label={`Hear ${telugu} (synthetic voice)`}
      title="Hear it (synthetic voice until recordings land)"
    >🔊</button>
  );
}

type Filter = 'all' | 'practiced' | 'letters';

export function Words() {
  const { settings, translitMode } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [mastery, setMastery] = useState<Map<string, ConceptMastery>>(new Map());
  const [hooks, setHooks] = useState<Record<string, string>>({});
  const [editingHook, setEditingHook] = useState<string | null>(null);
  const [hookDraft, setHookDraft] = useState('');

  useEffect(() => {
    getAllMastery().then((all) => setMastery(new Map(all.map((m) => [m.conceptId, m])))).catch(() => {});
    getKV<Record<string, string>>('mnemonics', {}).then(setHooks).catch(() => {});
  }, []);

  const saveHook = async (conceptId: string) => {
    const next = { ...hooks };
    if (hookDraft.trim()) next[conceptId] = hookDraft.trim();
    else delete next[conceptId];
    setHooks(next);
    setEditingHook(null);
    try { await setKV('mnemonics', next); } catch { /* memory-only fallback */ }
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return concepts.filter((c) => {
      const isLetter = c.id.startsWith('script-');
      if (filter === 'letters' && !isLetter) return false;
      if (filter === 'all' && isLetter) return false;
      if (filter === 'practiced' && !mastery.has(c.id)) return false;
      if (!q) return true;
      return (
        c.telugu.includes(query.trim()) ||
        (c.transliteration ?? '').toLowerCase().includes(q) ||
        c.english.toLowerCase().includes(q)
      );
    });
  }, [query, filter, mastery]);

  const practicedCount = useMemo(() => concepts.filter((c) => mastery.has(c.id)).length, [mastery]);

  return (
    <div className="words-page">
      <h1>Word book</h1>
      <p className="words-sub">{practicedCount} of {concepts.length} words practiced so far</p>

      <div className="words-controls">
        <input
          className="words-search"
          type="search"
          placeholder="Search Telugu, sound, or meaning…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search words"
        />
        <div className="words-filters" role="group" aria-label="Filter words">
          {([['all', 'Words'], ['letters', 'Letters'], ['practiced', 'Practiced']] as [Filter, string][]).map(([f, label]) => (
            <button
              key={f} type="button"
              className={`words-filter ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >{label}</button>
          ))}
        </div>
      </div>

      <ul className="words-list">
        {list.map((c) => {
          const m = mastery.get(c.id);
          const label = m ? masteryLabel(m.masteryScore) : null;
          return (
            <li key={c.id} className="word-row">
              <div className="word-main">
                <TeluguText value={{ telugu: c.telugu, transliteration: c.transliteration }} mode={translitMode} />
                <span className="word-english">{c.english}</span>
                {c.notes && <span className="word-notes">{c.notes}</span>}
                {editingHook === c.id ? (
                  <span className="word-hook-edit">
                    <input
                      value={hookDraft} autoFocus maxLength={140}
                      placeholder="Your memory hook, e.g. “kāvāli — I ‘cave in’ to what I want”"
                      onChange={(e) => setHookDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void saveHook(c.id); if (e.key === 'Escape') setEditingHook(null); }}
                      aria-label={`Memory hook for ${c.telugu}`}
                    />
                    <button type="button" className="btn-ghost" onClick={() => void saveHook(c.id)}>Save</button>
                  </span>
                ) : hooks[c.id] ? (
                  <button type="button" className="word-hook" onClick={() => { setEditingHook(c.id); setHookDraft(hooks[c.id]); }} title="Edit your memory hook">
                    💡 {hooks[c.id]}
                  </button>
                ) : (
                  <button type="button" className="word-hook-add" onClick={() => { setEditingHook(c.id); setHookDraft(''); }}>
                    + memory hook
                  </button>
                )}
              </div>
              <div className="word-side">
                {m ? (
                  <>
                    <span className={`mastery-chip m-${label}`}>{label}</span>
                    <span className="word-bar" aria-label={`Mastery ${Math.round(m.masteryScore)} out of 100`}>
                      <i style={{ width: `${Math.round(m.masteryScore)}%` }} />
                    </span>
                  </>
                ) : (
                  <span className="word-unseen">not yet seen</span>
                )}
                <SpeakButton telugu={c.telugu} />
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className="words-empty">Nothing matches — try a different search.</li>}
      </ul>
    </div>
  );
}
