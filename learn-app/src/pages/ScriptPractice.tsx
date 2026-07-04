// Telugu script explorer: vowels, consonants, guṇintālu, vattulu — tap any
// letter to hear it (native audio when available, labelled synth otherwise).

import { useState } from 'react';
import { Link } from '../router';
import { VOWELS, CONSONANTS, GUNINTALU, VATTULU, Letter } from '../content/script-data';
import { playPrompt } from '../lib/audio';

type Tab = 'vowels' | 'consonants' | 'gunintalu' | 'vattulu';

export function ScriptPractice() {
  const [tab, setTab] = useState<Tab>('vowels');
  const [detail, setDetail] = useState<Letter | null>(null);

  const speak = (telugu: string) => { void playPrompt(undefined, telugu); };

  const letterGrid = (letters: Letter[]) => (
    <div className="script-grid">
      {letters.map((l) => (
        <button
          type="button" key={l.telugu} className={`script-card ${detail?.telugu === l.telugu ? 'sel' : ''}`}
          onClick={() => { setDetail(l); speak(l.telugu); }}
        >
          <span className="script-glyph" lang="te">{l.telugu}</span>
          <span className="script-roman">{l.roman}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="script-page">
      <h1>Telugu script</h1>
      <p className="script-intro">
        Tap a letter to hear it and see how it's used. For guided practice, take the
        script lessons in <Link to="map">Reading Telugu</Link>.
      </p>
      <div className="script-tabs" role="tablist">
        {([
          ['vowels', 'అచ్చులు · Vowels'],
          ['consonants', 'హల్లులు · Consonants'],
          ['gunintalu', 'గుణింతాలు · Vowel signs'],
          ['vattulu', 'వత్తులు · Conjuncts'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key}
            className={`script-tab ${tab === key ? 'on' : ''}`} onClick={() => { setTab(key); setDetail(null); }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'vowels' && letterGrid(VOWELS)}
      {tab === 'consonants' && letterGrid(CONSONANTS)}
      {tab === 'gunintalu' && (
        <>
          <p className="script-note">Every consonant carries a built-in “a”. A vowel sign swaps it — shown here on క:</p>
          <div className="script-grid">
            {GUNINTALU.map((g) => (
              <button type="button" key={g.roman} className="script-card" onClick={() => speak(g.example)}>
                <span className="script-glyph" lang="te">{g.example}</span>
                <span className="script-roman">{g.roman}</span>
                <span className="script-sign" lang="te">{g.sign}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {tab === 'vattulu' && (
        <>
          <p className="script-note">When consonants stack, the second one shrinks into a vattu below or beside the first:</p>
          <div className="script-grid wide">
            {VATTULU.map((v) => (
              <button type="button" key={v.telugu} className="script-card" onClick={() => speak(v.telugu)}>
                <span className="script-glyph" lang="te">{v.telugu}</span>
                <span className="script-roman">{v.roman}</span>
                <span className="script-from" lang="te">{v.from}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {detail && (
        <aside className="script-detail" aria-live="polite">
          <span className="detail-glyph" lang="te">{detail.telugu}</span>
          <div>
            <strong>{detail.roman}</strong>{detail.name && <> · {detail.name}</>}
            {detail.hint && <p>{detail.hint}</p>}
          </div>
        </aside>
      )}
      <p className="script-audio-note">🔈 Letter audio currently uses your device's synthetic voice until native recordings are added.</p>
    </div>
  );
}
