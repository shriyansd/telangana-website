import { useEffect, useState } from 'react';
import { Link } from '../router';
import { useApp } from '../AppContext';
import { courses, allLessonIds, findLessonMeta, loadLesson, concepts } from '../content';
import { getAllLessonProgress, getAllMastery, getAllMistakes } from '../lib/storage';
import { dueConcepts, masteryLabel } from '../lib/srs';
import type { LessonProgress } from '../types/progress';
import { AudioButton, TeluguText } from '../components/ui';

// Deterministic pick that changes once a day — no network, no randomness.
function wordOfTheDay() {
  const pool = concepts.filter((c) => !c.id.startsWith('script-') && c.english && !c.english.includes('___'));
  if (pool.length === 0) return null;
  const day = Math.floor(Date.now() / 86400000);
  return pool[day % pool.length];
}

export function Dashboard() {
  const { xp, streak, settings, profile, storageOk } = useApp();
  const [nextLesson, setNextLesson] = useState<{ id: string; title: string; courseTitle: string; resume: boolean } | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [masterySummary, setMasterySummary] = useState<{ label: string; count: number }[]>([]);
  const [skillBars, setSkillBars] = useState<{ name: string; pct: number; n: number }[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [progress, mastery, mistakes] = await Promise.all([
        getAllLessonProgress(), getAllMastery(), getAllMistakes(),
      ]);
      setDueCount(dueConcepts(mastery).length);
      setMistakeCount(mistakes.filter((m) => !m.cleared).length);
      setCompletedCount(progress.filter((p) => p.status === 'completed' || p.status === 'mastered').length);

      const byLabel = new Map<string, number>();
      for (const m of mastery) {
        const l = masteryLabel(m.masteryScore);
        byLabel.set(l, (byLabel.get(l) ?? 0) + 1);
      }
      setMasterySummary(['mastered', 'strong', 'familiar', 'learning', 'new'].filter((l) => byLabel.has(l)).map((l) => ({ label: l, count: byLabel.get(l)! })));

      // Skill-split progress (H1): listening/reading/production develop at
      // different rates — show them separately, not as one number.
      const DIMS: [string, string[]][] = [
        ['Listening', ['listening', 'pronunciation-perception']],
        ['Reading & script', ['reading', 'script']],
        ['Understanding', ['meaning']],
        ['Producing Telugu', ['supported-production', 'independent-production', 'communicative-use']],
      ];
      const bars: { name: string; pct: number; n: number }[] = [];
      for (const [name, keys] of DIMS) {
        let total = 0, n = 0;
        for (const m of mastery) {
          for (const k of keys) {
            const s = m.skills?.[k as keyof NonNullable<typeof m.skills>];
            if (s && (s.successes + s.failures) > 0) { total += s.score; n++; }
          }
        }
        if (n > 0) bars.push({ name, pct: Math.round(total / n), n });
      }
      setSkillBars(bars);

      // Next lesson: an in-progress one first, else first not-completed in course order.
      const progressById = new Map<string, LessonProgress>(progress.map((p) => [p.lessonId, p]));
      const ids = allLessonIds();
      let pick: string | null = null;
      let resume = false;
      const inProgress = progress.find((p) => p.status === 'in-progress' && p.resume);
      if (inProgress) { pick = inProgress.lessonId; resume = true; }
      if (!pick) {
        pick = ids.find((id) => {
          const st = progressById.get(id)?.status;
          return st !== 'completed' && st !== 'mastered';
        }) ?? ids[0];
      }
      if (pick) {
        const lesson = await loadLesson(pick);
        const meta = findLessonMeta(pick);
        if (lesson) setNextLesson({ id: pick, title: lesson.title, courseTitle: meta?.course.title ?? '', resume });
      }
    })();
  }, []);

  const goalMinutes = settings.dailyGoalMinutes;
  const todayXp = xp?.todayDate === new Date().toISOString().slice(0, 10) ? xp?.today ?? 0 : 0;
  // Rough goal proxy: ~6 XP per minute of practice.
  const goalPct = Math.min(100, Math.round((todayXp / (goalMinutes * 6)) * 100));

  return (
    <div className="dashboard">
      {!storageOk && (
        <div className="storage-warning" role="alert">
          ⚠️ Your browser is blocking local storage (private mode?). You can learn, but progress won't be saved.
        </div>
      )}

      <section className="dash-hero">
        <div>
          <h1>{profile.path === 'heritage-learner' ? 'మళ్ళీ స్వాగతం!' : 'నమస్కారం!'}</h1>
          <p className="dash-sub">
            {nextLesson
              ? <>Up next in <strong>{nextLesson.courseTitle}</strong>: {nextLesson.title}</>
              : 'Loading your course…'}
          </p>
        </div>
        {nextLesson && (
          <Link to={`lesson/${nextLesson.id}`} className="btn-primary big">
            {nextLesson.resume ? 'Resume lesson →' : completedCount > 0 ? 'Continue →' : 'Start your first lesson →'}
          </Link>
        )}
      </section>

      <section className="dash-goal" aria-label="Daily goal">
        <div className="goal-ring" style={{ ['--pct' as any]: `${goalPct}%` }}>
          <span>{goalPct}%</span>
        </div>
        <div>
          <h2>Daily goal · {goalMinutes} min</h2>
          <p>{todayXp} XP today{goalPct >= 100 ? ', goal met! 🎉' : ''}</p>
          {streak && streak.current > 0 && <p className="streak-line">🔥 {streak.current}-day streak (best {streak.longest})</p>}
        </div>
      </section>

      <section className="dash-actions">
        <Link to="review" className={`action-card ${dueCount > 0 ? 'highlight' : ''}`}>
          <span className="action-icon">🔁</span>
          <strong>Review</strong>
          <span>{dueCount > 0 ? `${dueCount} concept${dueCount === 1 ? '' : 's'} due` : 'Nothing due, nice!'}</span>
        </Link>
        <Link to="mistakes" className="action-card">
          <span className="action-icon">🩹</span>
          <strong>Mistakes</strong>
          <span>{mistakeCount > 0 ? `${mistakeCount} to revisit` : 'All clear'}</span>
        </Link>
        <Link to="script" className="action-card">
          <span className="action-icon" lang="te">అ</span>
          <strong>Script practice</strong>
          <span>Letters & sounds</span>
        </Link>
        <Link to="stories" className="action-card">
          <span className="action-icon">📖</span>
          <strong>Stories</strong>
          <span>Read & listen</span>
        </Link>
        <Link to="lightning" className="action-card">
          <span className="action-icon">⚡</span>
          <strong>Lightning round</strong>
          <span>60-second challenge</span>
        </Link>
        <Link to="words" className="action-card">
          <span className="action-icon">📚</span>
          <strong>Word book</strong>
          <span>Everything you've learned</span>
        </Link>
        <Link to="live" className="action-card">
          <span className="action-icon">🎥</span>
          <strong>Live session</strong>
          <span>Book 30 min with a teacher</span>
        </Link>
      </section>

      <WordOfTheDay />

      {skillBars.length > 0 && (
        <section className="dash-skills">
          <h2>Your skills</h2>
          <div className="skill-bars">
            {skillBars.map((s) => (
              <div key={s.name} className="skill-bar-row">
                <span className="skill-name">{s.name}</span>
                <span className="skill-track" role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label={s.name}>
                  <i style={{ width: `${s.pct}%` }} />
                </span>
                <span className="skill-pct">{s.pct}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {masterySummary.length > 0 && (
        <section className="dash-mastery">
          <h2>Your concepts</h2>
          <div className="mastery-chips">
            {masterySummary.map((m) => (
              <span key={m.label} className={`mastery-chip m-${m.label}`}>{m.count} {m.label}</span>
            ))}
          </div>
        </section>
      )}

      <section className="dash-course-peek">
        <h2>Course path</h2>
        <p>{courses.length} courses · {allLessonIds().length} lessons and growing</p>
        <Link to="map" className="btn-ghost">Open the course map →</Link>
      </section>
    </div>
  );
}

function WordOfTheDay() {
  const { translitMode } = useApp();
  const word = wordOfTheDay();
  if (!word) return null;
  return (
    <section className="wotd" aria-label="Word of the day">
      <div className="wotd-head">
        <h2>🌞 Word of the day</h2>
        <AudioButton telugu={word.telugu} />
      </div>
      <TeluguText value={{ telugu: word.telugu, transliteration: word.transliteration }} mode={translitMode} size="lg" />
      <p className="wotd-meaning">{word.english}</p>
      {word.notes && <p className="wotd-notes">{word.notes}</p>}
    </section>
  );
}
