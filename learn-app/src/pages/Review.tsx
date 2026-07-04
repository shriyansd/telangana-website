// Review session: mixed exercises drawn from due concepts (mode="due") or
// uncleared mistakes (mode="mistakes"). Runs entirely in the browser.

import { useEffect, useRef, useState } from 'react';
import { Link, navigate } from '../router';
import { useApp } from '../AppContext';
import { loadAllLessons } from '../content';
import type { Exercise } from '../types/content';
import { planReview, exercisesForConcepts } from '../lib/session';
import { ExerciseHost, ExerciseOutcome } from '../components/exercises/ExerciseHost';
import { ProgressBar } from '../components/ui';
import { recordExerciseOutcome, recordSessionComplete } from '../lib/progress-service';
import { getAllMastery, getAllMistakes, saveMistake } from '../lib/storage';
import { stopAudio } from '../lib/audio';

export function Review({ mode }: { mode: 'due' | 'mistakes' }) {
  const { settings, refreshStats, translitMode } = useApp();
  const [items, setItems] = useState<{ exercise: Exercise; lessonId: string }[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'empty' | 'playing' | 'summary'>('loading');
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const lessons = await loadAllLessons();
      let conceptIds: string[] = [];
      if (mode === 'due') {
        const mastery = await getAllMastery();
        conceptIds = planReview(mastery, { max: 10 }).map((p) => p.conceptId);
      } else {
        const mistakes = await getAllMistakes();
        conceptIds = Array.from(new Set(mistakes.filter((m) => !m.cleared).flatMap((m) => m.conceptIds)));
      }
      if (conceptIds.length === 0) { setPhase('empty'); return; }
      const picked = exercisesForConcepts(conceptIds, lessons, { max: mode === 'due' ? 12 : 8 });
      if (picked.length === 0) { setPhase('empty'); return; }
      setItems(picked);
      setPhase('playing');
    })();
    return () => stopAudio();
  }, [mode]);

  const onComplete = async (outcome: ExerciseOutcome) => {
    const item = items[index];
    await recordExerciseOutcome(item.exercise, item.lessonId, outcome, { firstTry: true });
    if (outcome.correct) {
      setCorrect(correct + 1);
      // Clear the mistake record once answered correctly in review.
      const mistakes = await getAllMistakes();
      const rec = mistakes.find((m) => m.exerciseId === item.exercise.id);
      if (rec && !rec.cleared) await saveMistake({ ...rec, cleared: true });
    } else {
      setWrong(wrong + 1);
    }
    if (index + 1 >= items.length) {
      const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
      const res = await recordSessionComplete('review', { minutes });
      setXpEarned(res.xpEarned);
      await refreshStats();
      setPhase('summary');
    } else {
      setIndex(index + 1);
    }
  };

  if (phase === 'loading') return <div className="page-loading" role="status">Preparing your review…</div>;

  if (phase === 'empty') {
    return (
      <div className="review-empty">
        <h1>{mode === 'due' ? 'Nothing due right now 🎉' : 'No mistakes waiting 🎉'}</h1>
        <p>
          {mode === 'due'
            ? 'Your reviewed concepts are resting. Learn something new and they’ll come back at the right moment.'
            : 'You’ve cleared your recent mistakes. Keep going!'}
        </p>
        <Link to="dashboard" className="btn-primary">Back to dashboard</Link>
      </div>
    );
  }

  if (phase === 'summary') {
    const total = correct + wrong;
    return (
      <div className="lesson-summary">
        <h1>Review complete 🔁</h1>
        <div className="summary-stats">
          <div className="sum-stat"><strong>{total > 0 ? Math.round((correct / total) * 100) : 100}%</strong><span>accuracy</span></div>
          <div className="sum-stat"><strong>+{xpEarned}</strong><span>XP</span></div>
        </div>
        <p className="summary-note">Every review pushes these concepts further into long-term memory.</p>
        <button type="button" className="btn-primary big" onClick={() => navigate('dashboard')}>Done →</button>
      </div>
    );
  }

  const item = items[index];
  return (
    <div className="lesson-player">
      <header className="lesson-header">
        <button type="button" className="btn-exit" onClick={() => navigate('dashboard')} aria-label="Exit review">✕</button>
        <ProgressBar value={index} max={items.length} />
        <span className="lesson-count">{index + 1}/{items.length}</span>
      </header>
      <ExerciseHost
        key={`${item.exercise.id}-${index}`}
        exercise={item.exercise}
        translit={translitMode}
        onComplete={onComplete}
        seed={index + 100}
      />
    </div>
  );
}
