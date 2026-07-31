// Shared UI primitives used across exercises and pages.

import { useEffect, useRef, useState } from 'react';
import type { AudioRef, TeluguString } from '../types/content';
import type { TransliterationMode } from '../types/progress';
import { playPrompt, PlayResult } from '../lib/audio';
import { transliterate } from '../lib/translit';
import { graphemes } from '../lib/answers';
import { KEYBOARD_BASIC, KEYBOARD_SIGNS } from '../content/script-data';
import { getSettings } from '../lib/storage';

// ── Telugu text with transliteration modes ──
export function TeluguText({
  value,
  mode,
  showEnglish = false,
  size = 'md',
}: {
  value: TeluguString;
  mode: TransliterationMode;
  showEnglish?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [value.telugu]);
  const showTranslit = value.transliteration && (mode === 'always' || (mode === 'tap' && revealed));
  return (
    <div className={`telugu-text size-${size}`}>
      <span className="telugu-script" lang="te">{value.telugu}</span>
      {mode === 'tap' && value.transliteration && !revealed && (
        <button type="button" className="translit-reveal" onClick={() => setRevealed(true)} aria-label="Show pronunciation">
          🔤 show pronunciation
        </button>
      )}
      {showTranslit && <span className="translit">{value.transliteration}</span>}
      {showEnglish && value.english && <span className="english">{value.english}</span>}
    </div>
  );
}

// ── Audio play button with slow replay + fallback labelling ──
export function AudioButton({
  audio,
  telugu,
  autoPlay = false,
  size = 'md',
}: {
  audio?: AudioRef;
  telugu: string;
  autoPlay?: boolean;
  size?: 'md' | 'lg';
}) {
  const [state, setState] = useState<'idle' | 'playing'>('idle');
  const [result, setResult] = useState<PlayResult | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const play = async (slow: boolean) => {
    setState('playing');
    const r = await playPrompt(audio, telugu, { slow });
    if (!mounted.current) return;
    setResult(r);
    setState('idle');
  };

  useEffect(() => {
    if (autoPlay && getSettings().audioAutoplay) void play(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telugu]);

  return (
    <div className={`audio-btns size-${size}`}>
      <button type="button" className="btn-audio" onClick={() => play(false)} disabled={state === 'playing'} aria-label="Play audio">
        {state === 'playing' ? '🔊' : '🔊'} <span>Play</span>
      </button>
      <button type="button" className="btn-audio slow" onClick={() => play(true)} disabled={state === 'playing'} aria-label="Play slowly">
        🐢 <span>Slow</span>
      </button>
      {result === 'synth' && <span className="audio-note" title="A native-speaker recording hasn't been added yet.">synthetic voice (placeholder)</span>}
      {result === 'unavailable' && <span className="audio-note">recording coming soon: read the text below</span>}
    </div>
  );
}

// ── Feedback banner ──
export function FeedbackBar({
  status,
  message,
  grammar,
  correctAnswer,
}: {
  status: 'correct' | 'incorrect';
  message?: string;
  grammar?: string;
  correctAnswer?: string;
}) {
  return (
    <div className={`feedback ${status}`} role="status" aria-live="polite">
      <strong>{status === 'correct' ? 'బాగుంది! Correct' : 'Not quite'}</strong>
      {correctAnswer && status === 'incorrect' && (
        <div className="feedback-answer">Answer: <span lang="te">{correctAnswer}</span></div>
      )}
      {message && <p>{message}</p>}
      {grammar && <p className="feedback-grammar">📘 {grammar}</p>}
    </div>
  );
}

// ── Progress bar ──
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={`Exercise ${value} of ${max}`}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── On-screen Telugu keyboard ──
export function TeluguKeyboard({ onKey, onBackspace }: { onKey: (s: string) => void; onBackspace: () => void }) {
  const [showSigns, setShowSigns] = useState(false);
  return (
    <div className="tel-keyboard" role="group" aria-label="Telugu on-screen keyboard">
      <div className="kb-toggle-row">
        <button type="button" className={`kb-tab ${!showSigns ? 'on' : ''}`} onClick={() => setShowSigns(false)}>అక్షరాలు</button>
        <button type="button" className={`kb-tab ${showSigns ? 'on' : ''}`} onClick={() => setShowSigns(true)}>గుణింతాలు ・ ్</button>
        <button type="button" className="kb-key wide" onClick={() => onKey(' ')} aria-label="Space">␣</button>
        <button type="button" className="kb-key wide" onClick={onBackspace} aria-label="Backspace">⌫</button>
      </div>
      {!showSigns
        ? KEYBOARD_BASIC.map((row, i) => (
            <div className="kb-row" key={i}>
              {row.map((k) => (
                <button type="button" className="kb-key" key={k} lang="te" onClick={() => onKey(k)}>{k}</button>
              ))}
            </div>
          ))
        : (
          <div className="kb-row">
            {KEYBOARD_SIGNS.map((k) => (
              <button type="button" className="kb-key" key={k} lang="te" onClick={() => onKey(k)} aria-label={`sign ${k}`}>
                {'◌'}{k}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Telugu input with romanized suggestions + optional on-screen keyboard ──
export function TeluguInput({
  value,
  onChange,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}) {
  const [showKb, setShowKb] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Suggest Telugu for the trailing romanized word, if any.
    const m = value.match(/([a-zA-Z]+)$/);
    if (m) {
      const prefix = value.slice(0, value.length - m[1].length);
      setSuggestions(transliterate(m[1]).map((t) => prefix + t));
    } else {
      setSuggestions([]);
    }
  }, [value]);

  return (
    <div className="tel-input-wrap">
      <div className="tel-input-row">
        <input
          ref={inputRef}
          className="tel-input"
          lang="te"
          value={value}
          placeholder={placeholder ?? 'Type Telugu or romanized (e.g. amma)…'}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) onSubmit(); }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="button" className="btn-kb" onClick={() => setShowKb(!showKb)} aria-pressed={showKb} aria-label="Toggle Telugu keyboard">⌨️ తె</button>
      </div>
      {suggestions.length > 0 && (
        <div className="tel-suggestions" role="listbox" aria-label="Telugu suggestions">
          {suggestions.map((s) => (
            <button type="button" key={s} lang="te" className="tel-suggestion" onClick={() => { onChange(s + ' '); inputRef.current?.focus(); }}>
              {s}
            </button>
          ))}
        </div>
      )}
      {showKb && (
        <TeluguKeyboard
          onKey={(k) => onChange(value + k)}
          onBackspace={() => {
            // Remove the last grapheme, not the last code unit.
            onChange(graphemes(value).slice(0, -1).join(''));
          }}
        />
      )}
    </div>
  );
}
