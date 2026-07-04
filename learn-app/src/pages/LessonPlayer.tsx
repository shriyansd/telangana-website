// The lesson player: one exercise at a time, mistakes requeued later in the
// session, resumable, ending in a summary with XP and culture cards.

import { useEffect, useRef, useState } from 'react';
import { Link, navigate } from '../router';
import { useApp } from '../AppContext';
import { loadLesson, loadAllLessons, findLessonMeta, conceptById } from '../content';
import type { Exercise, Lesson, Unit } from '../types/content';
import { buildLessonSession, requeueMissed, planReview, exercisesForConcepts } from '../lib/session';
import { masteryLabel } from '../lib/srs';
import { ExerciseHost, ExerciseOutcome } from '../components/exercises/ExerciseHost';
import { ProgressBar } from '../components/ui';
import { recordExerciseOutcome, recordSessionComplete, recordSpeakingRecording } from '../lib/progress-service';
import { getLessonProgress, saveLessonProgress, getAllMastery, getMastery } from '../lib/storage';
import { stopAudio } from '../lib/audio';
import { burstConfetti, prefersReducedMotion } from '../lib/confetti';
import { sfxComplete } from '../lib/sfx';

type Phase = 'loading' | 'intro' | 'playing' | 'summary' | 'error';

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const { settings, refreshStats, translitMode } = useApp();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [badgesNew, setBadgesNew] = useState<string[]>([]);
  const [summary, setSummary] = useState<{
    unit: Unit | null;
    practiced: { telugu: string; english: string; label: string }[];
    needsReview: string[];
  } | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const attemptedIds = useRef<Set<string>>(new Set());
  const missedIds = useRef<Set<string>>(new Set());
  const startedAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const l = await loadLesson(lessonId);
      if (!l) { setPhase('error'); return; }
      setLesson(l);
      let session = buildLessonSession(l);
      const prior = await getLessonProgress(lessonId);
      const resuming = prior?.resume && prior.resume.exerciseIndex > 0 && prior.resume.exerciseIndex < session.length;
      if (resuming) {
        setIndex(prior.resume!.exerciseIndex);
        setCorrect(prior.resume!.correct);
        setWrong(prior.resume!.wrong);
      } else if (l.kind !== 'checkpoint') {
        // Retrieval warm-up (R1/R2/D1): open with up to 3 due/missed concepts
        // from *earlier* material before introducing anything new. Skipped for
        // checkpoints — a performance task starts in its scenario.
        try {
          const mastery = await getAllMastery();
          const ownConcepts = new Set(l.conceptIds);
          const plan = planReview(mastery.filter((m) => !ownConcepts.has(m.conceptId)), { max: 3 });
          if (plan.length > 0) {
            const all = await loadAllLessons();
            const ownIds = new Set(session.map((e) => e.id));
            const warm = exercisesForConcepts(plan.map((p) => p.conceptId), all, { max: 3 })
              .map((w) => w.exercise)
              .filter((e) => !ownIds.has(e.id));
            if (warm.length > 0) session = [...warm, ...session];
          }
        } catch { /* warm-up is best-effort */ }
      }
      setQueue(session);
      // Fresh starts on lessons with grammar notes open with a short intro.
      setPhase(!resuming && l.grammarNotes?.length ? 'intro' : 'playing');
    })();
    return () => stopAudio();
  }, [lessonId]);

  const persistResume = async (i: number, c: number, w: number) => {
    if (!lesson) return;
    const prior = await getLessonProgress(lesson.id);
    await saveLessonProgress({
      lessonId: lesson.id,
      status: 'in-progress',
      timesCompleted: prior?.timesCompleted ?? 0,
      bestAccuracy: prior?.bestAccuracy,
      resume: { exerciseIndex: i, correct: c, wrong: w, startedAt: new Date(startedAt.current).toISOString() },
    });
  };

  const finishLesson = async (finalCorrect: number, finalWrong: number) => {
    if (!lesson) return;
    const prior = await getLessonProgress(lesson.id);
    const total = finalCorrect + finalWrong;
    const accuracy = total > 0 ? finalCorrect / total : 1;
    const repeat = (prior?.timesCompleted ?? 0) > 0;
    await saveLessonProgress({
      lessonId: lesson.id,
      status: accuracy >= 0.95 && !missedIds.current.size ? 'mastered' : 'completed',
      completedAt: new Date().toISOString(),
      bestAccuracy: Math.max(prior?.bestAccuracy ?? 0, accuracy),
      timesCompleted: (prior?.timesCompleted ?? 0) + 1,
      resume: null,
    });
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const res = await recordSessionComplete('lesson', { lessonKind: lesson.kind, repeat, minutes });
    setXpEarned(res.xpEarned);
    setBadgesNew(res.badgesNew);

    // Meaningful summary (D5/R11): what was practiced and what needs work —
    // not just XP and a percentage.
    try {
      const meta = findLessonMeta(lesson.id);
      const unit = meta ? meta.course.units.find((u) => u.id === meta.unitId) ?? null : null;
      const practiced: { telugu: string; english: string; label: string }[] = [];
      for (const cid of lesson.conceptIds.slice(0, 8)) {
        const c = conceptById.get(cid);
        if (!c) continue;
        const m = await getMastery(cid);
        practiced.push({ telugu: c.telugu, english: c.english, label: m ? masteryLabel(m.masteryScore) : 'new' });
      }
      const needsReview: string[] = [];
      for (const exId of missedIds.current) {
        const ex = queue.find((e) => e.id === exId);
        for (const cid of ex?.conceptIds ?? []) {
          const c = conceptById.get(cid);
          if (c && !needsReview.includes(c.telugu)) needsReview.push(c.telugu);
        }
      }
      setSummary({ unit, practiced, needsReview: needsReview.slice(0, 6) });
    } catch { /* summary is best-effort */ }

    await refreshStats();
    setPhase('summary');
    if (settings.soundEffects) sfxComplete();
    if (!settings.reducedMotion && !prefersReducedMotion() && accuracy >= 0.6) burstConfetti();
  };

  const onComplete = async (outcome: ExerciseOutcome) => {
    if (!lesson) return;
    const ex = queue[index];
    const firstTry = !attemptedIds.current.has(ex.id);
    attemptedIds.current.add(ex.id);

    if (ex.type === 'speaking') void recordSpeakingRecording();
    await recordExerciseOutcome(ex, lesson.id, outcome, { firstTry });

    let nextQueue = queue;
    let c = correct, w = wrong;
    if (outcome.correct) c += 1; else {
      w += 1;
      // Bring the missed exercise back later in this session (once).
      if (!missedIds.current.has(ex.id)) {
        missedIds.current.add(ex.id);
        const rest = queue.slice(index + 1);
        nextQueue = [...queue.slice(0, index + 1), ...requeueMissed(rest, ex)];
        setQueue(nextQueue);
      }
    }
    setCorrect(c); setWrong(w);

    const nextIndex = index + 1;
    if (nextIndex >= nextQueue.length) {
      await finishLesson(c, w);
    } else {
      setIndex(nextIndex);
      await persistResume(nextIndex, c, w);
    }
  };

  if (phase === 'loading') return <div className="page-loading" role="status">Loading lesson…</div>;

  if (phase === 'error' || !lesson) {
    return (
      <div className="lesson-error">
        <h1>Lesson not found</h1>
        <p>The lesson “{lessonId}” couldn't be loaded. It may not be downloaded yet or the link is stale.</p>
        <Link to="map" className="btn-primary">Back to course map</Link>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="lesson-intro">
        <p className="intro-kicker">📖 Before you start</p>
        <h1>{lesson.title}</h1>
        {lesson.grammarNotes?.map((gn) => (
          <aside key={gn.id} className="grammar-card">
            <h2>{gn.title}</h2>
            <p>{gn.body}</p>
          </aside>
        ))}
        <button type="button" className="btn-primary big" onClick={() => setPhase('playing')} autoFocus>
          Got it — let's practice →
        </button>
      </div>
    );
  }

  if (phase === 'summary') {
    const total = correct + wrong;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 100;
    return (
      <div className="lesson-summary">
        <h1>{pct >= 80 ? 'చాలా బాగుంది! 🎉' : 'Lesson complete!'}</h1>
        <div className="summary-stats">
          <div className="sum-stat"><strong>{pct}%</strong><span>accuracy</span></div>
          <div className="sum-stat"><strong>+{xpEarned}</strong><span>XP</span></div>
          <div className="sum-stat"><strong>{wrong}</strong><span>to review</span></div>
        </div>
        {summary?.unit && (
          summary.unit.finalPerformanceTaskLessonId === lesson.id && summary.unit.canDoStatement ? (
            <p className="cando-banner">✅ <strong>{summary.unit.canDoStatement}</strong></p>
          ) : summary.unit.canDoStatement ? (
            <p className="cando-progress">🎯 Building toward: <em>{summary.unit.canDoStatement}</em></p>
          ) : null
        )}
        {summary && summary.practiced.length > 0 && (
          <div className="summary-concepts">
            <h2>What you practiced</h2>
            <ul>
              {summary.practiced.map((p) => (
                <li key={p.telugu}>
                  <span lang="te">{p.telugu}</span> <span className="sc-en">{p.english}</span>
                  <span className={`mastery-chip m-${p.label}`}>{p.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary && summary.needsReview.length > 0 && (
          <p className="summary-note">
            Worth another look soon: <span lang="te">{summary.needsReview.join(' · ')}</span> — these will come back in your reviews.
          </p>
        )}
        {wrong > 0 && (!summary || summary.needsReview.length === 0) && <p className="summary-note">Missed items were re-practiced and will return in your reviews at just the right time.</p>}
        {badgesNew.length > 0 && (
          <div className="summary-badges">
            {badgesNew.map((b) => <span key={b} className="badge-chip">🏅 {b}</span>)}
          </div>
        )}
        {lesson.cultureCards?.map((cc) => (
          <aside key={cc.id} className="culture-card">
            <h2>🏮 {cc.title}{cc.region && <span className="region-tag">{cc.region}</span>}</h2>
            <p>{cc.body}</p>
          </aside>
        ))}
        {lesson.status !== 'published' && (
          <p className="draft-note">
            ⚠️ This lesson's Telugu is <strong>{lesson.status}</strong> — awaiting native-speaker review.
            Spot an issue? <ReportLink lesson={lesson} />
          </p>
        )}
        <div className="summary-actions">
          <button type="button" className="btn-primary big" onClick={() => navigate('dashboard')}>Continue →</button>
          <Link to="map" className="btn-ghost">Course map</Link>
        </div>
      </div>
    );
  }

  const ex = queue[index];
  return (
    <div className="lesson-player">
      <header className="lesson-header">
        <button type="button" className="btn-exit" onClick={() => setConfirmExit(true)} aria-label="Exit lesson">✕</button>
        <ProgressBar value={index} max={queue.length} />
        <span className="lesson-count">{index + 1}/{queue.length}</span>
      </header>

      {confirmExit && (
        <div className="exit-dialog" role="dialog" aria-label="Exit lesson?">
          <p>Take a break? Your place in this lesson is saved.</p>
          <div className="exit-actions">
            <button type="button" className="btn-primary" onClick={() => setConfirmExit(false)}>Keep going</button>
            <button type="button" className="btn-ghost" onClick={() => { void persistResume(index, correct, wrong); navigate('dashboard'); }}>
              Save & exit
            </button>
          </div>
        </div>
      )}

      <ExerciseHost
        key={`${ex.id}-${index}`}
        exercise={ex}
        translit={translitMode}
        onComplete={onComplete}
        seed={index + 1}
      />

      <ReportFooter lesson={lesson} exerciseId={ex.id} />
    </div>
  );
}

function ReportLink({ lesson, exerciseId }: { lesson: Lesson; exerciseId?: string }) {
  const subject = encodeURIComponent(`Telugu Bata language issue: ${lesson.id}${exerciseId ? ' / ' + exerciseId : ''}`);
  const body = encodeURIComponent(
    `Lesson: ${lesson.id}\nExercise: ${exerciseId ?? '-'}\nIssue category (wording / grammar / audio / regional): \nWhat's wrong: \nSuggested correction (optional): `,
  );
  return (
    <a href={`mailto:sanjudmail@gmail.com?subject=${subject}&body=${body}`}>Report a language issue</a>
  );
}

function ReportFooter({ lesson, exerciseId }: { lesson: Lesson; exerciseId: string }) {
  return (
    <footer className="lesson-footer">
      <ReportLink lesson={lesson} exerciseId={exerciseId} />
    </footer>
  );
}
