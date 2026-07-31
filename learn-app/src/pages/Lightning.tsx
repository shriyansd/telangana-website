// Lightning Round: a 60-second rapid-fire meaning quiz. Pulls from concepts
// the learner has practiced (falls back to early-course vocabulary), awards a
// small XP bonus, and keeps a local best score. No SRS side effects — it's a
// game, not a graded review.

import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../router';
import { useApp } from '../AppContext';
import { concepts } from '../content';
import { getAllMastery, getKV, setKV, getXP, saveXP, getStreak, saveStreak } from '../lib/storage';
import { addXP, updateStreak } from '../lib/gamify';
import { sfxCorrect, sfxWrong, sfxComplete } from '../lib/sfx';
import { TeluguText } from '../components/ui';
import type { Concept } from '../types/content';

const ROUND_SECONDS = 60;

interface Question {
  concept: Concept;
  options: string[]; // english meanings, first is correct pre-shuffle
  correct: string;
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQuestions(pool: Concept[], all: Concept[]): Question[] {
  return shuffle(pool).map((c) => {
    const wrong = shuffle(all.filter((o) => o.id !== c.id && o.english !== c.english)).slice(0, 3).map((o) => o.english);
    return { concept: c, options: shuffle([c.english, ...wrong]), correct: c.english };
  });
}

export function Lightning() {
  const { settings, refreshStats, translitMode } = useApp();
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [best, setBest] = useState<number>(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null);
  const timerRef = useRef<number | null>(null);

  const usable = useMemo(
    () => concepts.filter((c) => c.english && !c.english.includes('___') && !c.id.startsWith('script-')),
    [],
  );

  useEffect(() => {
    getKV<number>('lightning-best', 0).then(setBest).catch(() => {});
  }, []);

  const start = async () => {
    const mastery = await getAllMastery();
    const seen = new Set(mastery.map((m) => m.conceptId));
    const practiced = usable.filter((c) => seen.has(c.id));
    const pool = practiced.length >= 8 ? practiced : usable.slice(0, 40);
    setQuestions(buildQuestions(pool, usable));
    setQi(0); setScore(0); setCombo(0); setBestCombo(0); setIsNewBest(false);
    setSecondsLeft(ROUND_SECONDS);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && secondsLeft <= 0) void endRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  const endRound = async () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setPhase('done');
    if (settings.soundEffects) sfxComplete();
    if (score > best) {
      setBest(score);
      setIsNewBest(true);
      await setKV('lightning-best', score);
    }
    // Small XP reward + streak credit for showing up.
    const now = new Date();
    const xp = await getXP();
    await saveXP(addXP(xp, Math.max(1, Math.min(20, score)), now));
    await saveStreak(updateStreak(await getStreak(), now));
    await refreshStats();
  };

  const answer = (opt: string) => {
    if (phase !== 'playing') return;
    const q = questions[qi];
    const right = opt === q.correct;
    if (settings.soundEffects) (right ? sfxCorrect : sfxWrong)();
    setFlash(right ? 'right' : 'wrong');
    window.setTimeout(() => setFlash(null), 250);
    if (right) {
      setScore((s) => s + 1);
      setCombo((c) => {
        const next = c + 1;
        setBestCombo((b) => Math.max(b, next));
        return next;
      });
    } else {
      setCombo(0);
    }
    if (qi + 1 >= questions.length) void endRound();
    else setQi(qi + 1);
  };

  if (phase === 'intro') {
    return (
      <div className="lightning intro">
        <h1>⚡ Lightning round</h1>
        <p>How many meanings can you get in {ROUND_SECONDS} seconds? Wrong answers cost nothing: speed and streaks are everything.</p>
        {best > 0 && <p className="lightning-best">Your best: <strong>{best}</strong></p>}
        <button type="button" className="btn-primary big" onClick={() => void start()}>Start ⚡</button>
        <button type="button" className="btn-ghost" onClick={() => navigate('dashboard')}>Back</button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="lightning done">
        <h1>{isNewBest ? '🏆 New best!' : 'Time!'}</h1>
        <div className="summary-stats">
          <div className="sum-stat"><strong>{score}</strong><span>correct</span></div>
          <div className="sum-stat"><strong>{bestCombo}×</strong><span>best combo</span></div>
          <div className="sum-stat"><strong>+{Math.max(1, Math.min(20, score))}</strong><span>XP</span></div>
        </div>
        <p className="lightning-best">All-time best: <strong>{Math.max(best, score)}</strong></p>
        <div className="summary-actions">
          <button type="button" className="btn-primary big" onClick={() => void start()}>Play again ⚡</button>
          <button type="button" className="btn-ghost" onClick={() => navigate('dashboard')}>Done</button>
        </div>
      </div>
    );
  }

  const q = questions[qi];
  const pct = (secondsLeft / ROUND_SECONDS) * 100;
  return (
    <div className={`lightning playing ${flash ? `flash-${flash}` : ''}`}>
      <div className="lightning-top">
        <span className="lightning-score">⚡ {score}</span>
        {combo >= 3 && <span className="lightning-combo">{combo}× combo!</span>}
        <span className="lightning-clock" aria-live="off">{secondsLeft}s</span>
      </div>
      <div className="lightning-timer" role="progressbar" aria-valuenow={secondsLeft} aria-valuemin={0} aria-valuemax={ROUND_SECONDS} aria-label="Time remaining">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="lightning-q">
        <TeluguText value={{ telugu: q.concept.telugu, transliteration: q.concept.transliteration }} mode={translitMode} size="lg" />
      </div>
      <div className="lightning-options">
        {q.options.map((opt) => (
          <button key={opt} type="button" className="lightning-opt" onClick={() => answer(opt)}>{opt}</button>
        ))}
      </div>
    </div>
  );
}
