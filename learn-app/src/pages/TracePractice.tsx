// Handwriting practice: pick a letter, watch its stroke order animate, then
// trace it through four progressive stages (full guide → outline → starting
// dot → memory). Outcomes feed the same per-letter concept mastery the
// review system uses — no separate progress model.

import { useEffect, useMemo, useState } from 'react';
import { Link, navigate } from '../router';
import { VOWELS, CONSONANTS, Letter } from '../content/script-data';
import { LETTER_STROKES } from '../content/stroke-data';
import { StrokeAnimation } from '../components/StrokeAnimation';
import { TraceCanvas, TraceStage, TraceResult } from '../components/TraceCanvas';
import { recordTraceAttempt } from '../lib/progress-service';
import { getAllMastery, getKV, setKV } from '../lib/storage';
import { masteryLabel } from '../lib/srs';
import { playPrompt } from '../lib/audio';
import type { ConceptMastery } from '../types/progress';

interface TraceLetter extends Letter {
  conceptId: string;
  strokes: (typeof LETTER_STROKES)[string]['strokes'];
}

const withStrokes = (list: Letter[]): TraceLetter[] =>
  list
    .filter((l) => LETTER_STROKES[l.telugu])
    .map((l) => ({ ...l, ...LETTER_STROKES[l.telugu] }));

const TRACE_VOWELS = withStrokes(VOWELS);
const TRACE_CONSONANTS = withStrokes(CONSONANTS);
const ALL = [...TRACE_VOWELS, ...TRACE_CONSONANTS];

const STAGES: { n: TraceStage; label: string; hint: string }[] = [
  { n: 1, label: 'Trace', hint: 'Follow the guides and arrows' },
  { n: 2, label: 'Outline', hint: 'Faded letter only, recall the stroke order' },
  { n: 3, label: 'From a dot', hint: 'Just the starting point, draw the letter' },
  { n: 4, label: 'Memory', hint: 'Blank canvas, write it from memory' },
];

/** A stage is "passed" when most strokes landed without the show-me hint. */
const passed = (r: TraceResult) => r.cleanStrokes >= Math.ceil(r.totalStrokes * 0.6);

type StageMap = Record<string, number>; // conceptId → highest unlocked stage (1..4)

export function TracePractice({ conceptId }: { conceptId?: string }) {
  const [mastery, setMastery] = useState<Map<string, ConceptMastery>>(new Map());
  const [unlocked, setUnlocked] = useState<StageMap>({});
  const [stage, setStage] = useState<TraceStage>(1);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const letter = useMemo(() => ALL.find((l) => l.conceptId === conceptId), [conceptId]);

  useEffect(() => {
    getAllMastery().then((all) => setMastery(new Map(all.map((m) => [m.conceptId, m])))).catch(() => {});
    getKV<StageMap>('trace-stages', {}).then(setUnlocked).catch(() => {});
  }, []);

  // Entering a letter: start at its highest unlocked stage's frontier (stay encouraging: default 1).
  useEffect(() => {
    if (letter) { setStage(1); setCelebrate(null); }
  }, [letter?.conceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!letter) return <TracePicker mastery={mastery} unlocked={unlocked} />;

  const maxStage = (unlocked[letter.conceptId] ?? 1) as TraceStage;
  const idx = ALL.indexOf(letter);
  const prev = ALL[idx - 1];
  const next = ALL[idx + 1];

  const onComplete = async (r: TraceResult) => {
    const ok = passed(r);
    try {
      await recordTraceAttempt(letter.conceptId, stage, {
        correct: ok,
        usedHint: r.usedHint,
        responseTimeMs: r.elapsedMs,
      });
      const all = await getAllMastery();
      setMastery(new Map(all.map((m) => [m.conceptId, m])));
    } catch { /* progress is best-effort; practice still works */ }
    if (ok && stage === maxStage && stage < 4) {
      const nextMap = { ...unlocked, [letter.conceptId]: stage + 1 };
      setUnlocked(nextMap);
      setCelebrate(`Stage ${stage + 1} unlocked: ${STAGES[stage].label.toLowerCase()}!`);
      try { await setKV('trace-stages', nextMap); } catch { /* memory-only fallback */ }
    } else if (ok) {
      setCelebrate(stage === 4 ? 'Written from memory, well done! ✨' : 'Nice tracing!');
    } else {
      setCelebrate('Good attempt: replay the strokes and try again.');
    }
  };

  return (
    <div className="trace-page">
      <p className="trace-back"><Link to="trace">← All letters</Link></p>
      <div className="trace-head">
        <h1 lang="te">{letter.telugu} <span className="trace-roman">{letter.roman}</span></h1>
        <button
          type="button" className="word-speak"
          onClick={() => void playPrompt(undefined, letter.telugu, { slow: false })}
          aria-label={`Hear ${letter.telugu}`}
        >🔊</button>
      </div>
      {letter.hint && <p className="trace-hint-text">{letter.hint}</p>}

      <div className="trace-columns">
        <section className="trace-demo">
          <h2>Watch</h2>
          <StrokeAnimation glyph={letter.telugu} strokes={letter.strokes} />
        </section>

        <section className="trace-practice">
          <h2>Write</h2>
          <div className="trace-stage-tabs" role="tablist" aria-label="Practice stage">
            {STAGES.map((s) => {
              const locked = s.n > maxStage;
              return (
                <button
                  key={s.n} type="button" role="tab" aria-selected={stage === s.n}
                  className={`trace-stage-tab ${stage === s.n ? 'on' : ''} ${locked ? 'locked' : ''}`}
                  disabled={locked}
                  title={locked ? 'Finish the previous stage to unlock' : s.hint}
                  onClick={() => { setStage(s.n); setCelebrate(null); }}
                >
                  {locked ? '🔒 ' : ''}{s.label}
                </button>
              );
            })}
          </div>
          <p className="trace-stage-hint">{STAGES[stage - 1].hint}</p>
          <TraceCanvas glyph={letter.telugu} strokes={letter.strokes} stage={stage} onComplete={onComplete} />
          {celebrate && <p className="trace-celebrate" role="status">{celebrate}</p>}
        </section>
      </div>

      <div className="trace-nav">
        {prev ? (
          <button type="button" className="btn-ghost" onClick={() => navigate(`trace/${prev.conceptId}`)} lang="te">← {prev.telugu}</button>
        ) : <span />}
        {next ? (
          <button type="button" className="btn-ghost" onClick={() => navigate(`trace/${next.conceptId}`)} lang="te">{next.telugu} →</button>
        ) : <span />}
      </div>
      <p className="script-audio-note">✍️ Stroke paths are first-draft guides awaiting a native-teacher review: the faded letter is always the true shape.</p>
    </div>
  );
}

function TracePicker({ mastery, unlocked }: { mastery: Map<string, ConceptMastery>; unlocked: StageMap }) {
  const grid = (letters: TraceLetter[]) => (
    <div className="script-grid">
      {letters.map((l) => {
        const m = mastery.get(l.conceptId);
        const label = m ? masteryLabel(m.masteryScore) : null;
        const stageN = unlocked[l.conceptId] ?? 1;
        return (
          <Link key={l.conceptId} to={`trace/${l.conceptId}`} className="script-card trace-pick">
            <span className="script-glyph" lang="te">{l.telugu}</span>
            <span className="script-roman">{l.roman}</span>
            <span className="trace-pick-meta">
              {label && <span className={`mastery-chip m-${label}`}>{label}</span>}
              <span className="trace-stars" aria-label={`Stage ${stageN} of 4`}>
                {'★'.repeat(Math.max(0, stageN - 1)) + '☆'.repeat(4 - Math.max(0, stageN - 1))}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="trace-page">
      <h1>✍️ Writing practice</h1>
      <p className="script-intro">
        Watch each letter drawn stroke by stroke, then trace it yourself: first with
        guides, then from memory. Progress counts toward the same letter mastery as
        your <Link to="review">reviews</Link>. Prefer sounds first? Visit the{' '}
        <Link to="script">script explorer</Link>.
      </p>
      <h2>అచ్చులు · Vowels</h2>
      {grid(TRACE_VOWELS)}
      <h2>హల్లులు · Consonants</h2>
      {grid(TRACE_CONSONANTS)}
    </div>
  );
}
