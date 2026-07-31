// Interactive story player: lines reveal one by one with tap-to-hear audio and
// tap-to-reveal meanings; checkpoints pause the story with a question.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, navigate } from '../router';
import { useApp } from '../AppContext';
import { loadStories } from '../content';
import type { Story } from '../types/content';
import { ExerciseHost, ExerciseOutcome } from '../components/exercises/ExerciseHost';
import { AudioButton, TeluguText } from '../components/ui';
import { recordExerciseOutcome, recordSessionComplete } from '../lib/progress-service';
import { getKV, setKV } from '../lib/storage';
import { stopAudio } from '../lib/audio';

export function StoryPlayer({ storyId }: { storyId: string }) {
  const { settings, refreshStats, translitMode } = useApp();
  const [story, setStory] = useState<Story | null>(null);
  const [visibleLines, setVisibleLines] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'preview' | 'playing' | 'checkpoint' | 'summary' | 'error'>('loading');
  const [xpEarned, setXpEarned] = useState(0);
  const doneCheckpoints = useRef<Set<number>>(new Set());
  const startedAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const all = await loadStories();
      const s = all.find((x) => x.id === storyId);
      if (!s) { setPhase('error'); return; }
      setStory(s);
      setPhase(s.vocabPreview?.length ? 'preview' : 'playing');
      setVisibleLines(1);
    })();
    return () => stopAudio();
  }, [storyId]);

  const pendingCheckpoint = useMemo(() => {
    if (!story) return null;
    return story.checkpoints.find((cp) => cp.afterLine === visibleLines - 1 && !doneCheckpoints.current.has(cp.afterLine)) ?? null;
  }, [story, visibleLines, phase]);

  if (phase === 'loading') return <div className="page-loading" role="status">Loading story…</div>;
  if (phase === 'error' || !story) {
    return (
      <div className="lesson-error">
        <h1>Story not found</h1>
        <Link to="stories" className="btn-primary">All stories</Link>
      </div>
    );
  }

  if (phase === 'preview') {
    return (
      <div className="story-preview">
        <h1>{story.title}</h1>
        {story.teluguTitle && <p lang="te" className="story-telugu-title">{story.teluguTitle}</p>}
        <p>{story.description}</p>
        <h2>Words to listen for</h2>
        <ul className="vocab-preview">
          {story.vocabPreview!.map((v) => (
            <li key={v.id}>
              <TeluguText value={{ telugu: v.telugu, transliteration: v.transliteration, english: v.english }} mode={translitMode} showEnglish />
            </li>
          ))}
        </ul>
        <button type="button" className="btn-primary big" onClick={() => setPhase('playing')}>Begin the story →</button>
      </div>
    );
  }

  if (phase === 'summary') {
    return (
      <div className="lesson-summary">
        <h1>Story complete 📖</h1>
        <div className="summary-stats">
          <div className="sum-stat"><strong>+{xpEarned}</strong><span>XP</span></div>
        </div>
        <p className="summary-note">Replay it any time: listening twice is worth more than reading ten times.</p>
        <div className="summary-actions">
          <button type="button" className="btn-primary big" onClick={() => navigate('stories')}>Done →</button>
          <button type="button" className="btn-ghost" onClick={() => { setVisibleLines(1); doneCheckpoints.current.clear(); setPhase('playing'); }}>Replay</button>
        </div>
      </div>
    );
  }

  const advance = async () => {
    if (visibleLines >= story.lines.length) {
      const completed = await getKV<string[]>('stories-completed', []);
      if (!completed.includes(story.id)) await setKV('stories-completed', [...completed, story.id]);
      const res = await recordSessionComplete('story', { minutes: Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)) });
      setXpEarned(res.xpEarned);
      await refreshStats();
      setPhase('summary');
    } else {
      setVisibleLines(visibleLines + 1);
    }
  };

  const onCheckpointDone = async (outcome: ExerciseOutcome) => {
    if (!pendingCheckpoint) return;
    doneCheckpoints.current.add(pendingCheckpoint.afterLine);
    await recordExerciseOutcome(pendingCheckpoint.exercise, story.id, outcome);
    setPhase('playing');
  };

  return (
    <div className="story-player">
      <header className="lesson-header">
        <button type="button" className="btn-exit" onClick={() => navigate('stories')} aria-label="Exit story">✕</button>
        <span className="story-progress">{Math.min(visibleLines, story.lines.length)}/{story.lines.length}</span>
      </header>

      <div className="story-lines">
        {story.lines.slice(0, visibleLines).map((t, i) => (
          <div key={i} className={`dialogue-turn ${t.speaker === 'కథ' ? 'narration' : ''}`}>
            {t.speaker !== 'కథ' && <span className="dialogue-speaker" lang="te">{t.speaker}</span>}
            <div className="dialogue-bubble">
              <TeluguText value={t.line} mode={translitMode} showEnglish />
              <AudioButton audio={t.line.audio} telugu={t.line.telugu} />
            </div>
          </div>
        ))}
      </div>

      {pendingCheckpoint ? (
        <div className="story-checkpoint">
          <ExerciseHost
            exercise={pendingCheckpoint.exercise}
            translit={translitMode}
            onComplete={onCheckpointDone}
            seed={visibleLines}
          />
        </div>
      ) : (
        <button type="button" className="btn-continue story-next" onClick={advance}>
          {visibleLines >= story.lines.length ? 'Finish story →' : 'Next line →'}
        </button>
      )}
    </div>
  );
}
