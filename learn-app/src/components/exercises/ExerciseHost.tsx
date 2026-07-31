// The exercise engine: renders any exercise by its schema type and reports a
// single ExerciseOutcome. Lesson player, review, and stories all reuse this.

import { useEffect, useMemo, useState } from 'react';
import type {
  Exercise, DialogueExercise, FillBlankExercise, TranslateExercise, DictationExercise,
  WordTilesExercise, Choice,
} from '../../types/content';
import type { TransliterationMode } from '../../types/progress';
import { AudioButton, FeedbackBar, TeluguInput, TeluguText } from '../ui';
import { ChoiceList } from './ChoiceExercise';
import { TileBuilder } from './TilesExercise';
import { MatchPairs } from './MatchPairs';
import { Categorize } from './Categorize';
import { Speaking } from './Speaking';
import { matchesAnswer, classifyAnswer, resultIsCorrect, errorTypeFor } from '../../lib/answers';
import type { ErrorType } from '../../types/progress';
import { sfxCorrect, sfxWrong } from '../../lib/sfx';
import { useApp } from '../../AppContext';

export interface ExerciseOutcome {
  correct: boolean;
  /** false when the learner needed the second (post-nudge) attempt (R6) */
  firstAttemptCorrect?: boolean;
  usedHint: boolean;
  answerGiven?: string;
  responseTimeMs: number;
  errorType?: ErrorType;
}

export function ExerciseHost({
  exercise,
  translit,
  onComplete,
  seed = 1,
}: {
  exercise: Exercise;
  translit: TransliterationMode;
  onComplete: (outcome: ExerciseOutcome) => void;
  seed?: number;
}) {
  const [answered, setAnswered] = useState<null | { correct: boolean; answerGiven?: string; pickedChoice?: Choice; note?: string; errorType?: ErrorType }>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [typed, setTyped] = useState('');
  const [tileAnswer, setTileAnswer] = useState<string[]>([]);
  // Two-stage corrective feedback (R6): first wrong constructed/typed answer
  // gets a targeted nudge and one self-correction chance before the reveal.
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [hadRetry, setHadRetry] = useState(false);
  const startedAt = useMemo(() => Date.now(), [exercise]);

  // Tiles (with distractors) shuffled once per exercise — stable identity so
  // TileBuilder doesn't reset mid-answer. Hook stays top-level for all types.
  const shuffledTiles = useMemo(() => {
    const anyExercise = exercise as any;
    const combined: string[] = [...(anyExercise.tiles ?? []), ...(anyExercise.distractors ?? [])];
    let s = (seed || 1) >>> 0;
    for (let i = combined.length - 1; i > 0; i--) {
      s = (s * 48271) % 0x7fffffff;
      const j = s % (i + 1);
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined;
  }, [exercise, seed]);

  useEffect(() => {
    setAnswered(null); setUsedHint(false); setShowHint(false); setTyped(''); setTileAnswer([]);
    setRetryMsg(null); setHadRetry(false);
  }, [exercise]);

  const { settings } = useApp();
  const finish = (correct: boolean, answerGiven?: string, pickedChoice?: Choice, extra: { note?: string; errorType?: ErrorType } = {}) => {
    if (answered) return;
    if (settings.soundEffects) (correct ? sfxCorrect : sfxWrong)();
    setRetryMsg(null);
    setAnswered({ correct, answerGiven, pickedChoice, ...extra });
  };

  /**
   * Grade a constructed/typed answer (R6 + R13): graded classification, then
   * either accept (with a note for typos/alternatives), nudge once toward
   * self-correction, or reveal with the error category recorded.
   */
  const grade = (given: string, accepted: string[], opts: { romanized?: string[] } = {}) => {
    if (answered) return;
    if (opts.romanized?.length && matchesAnswer(given, opts.romanized)) {
      finish(true, given);
      return;
    }
    const result = classifyAnswer(given, accepted);
    if (resultIsCorrect(result)) {
      const note =
        result === 'nearly-correct-typo' ? `Almost perfect, check the spelling: ${accepted[0]}` :
        result === 'correct-alternative' ? `Also fine: ${accepted[0]}` : undefined;
      finish(true, given, undefined, { note });
      return;
    }
    if (!hadRetry) {
      setHadRetry(true);
      if (settings.soundEffects) sfxWrong();
      setRetryMsg(
        result === 'wrong-word-order'
          ? 'You have the right words: look at the order. In Telugu the verb usually comes last.'
          : exercise.hint
            ? `Not quite, one more try. 💡 ${exercise.hint}`
            : 'Not quite, take another look and try once more.',
      );
      return;
    }
    finish(false, given, undefined, { errorType: errorTypeFor(result, exercise.type) });
  };

  const continueOn = () => {
    if (!answered) return;
    onComplete({
      correct: answered.correct,
      firstAttemptCorrect: answered.correct && !hadRetry,
      usedHint,
      answerGiven: answered.answerGiven,
      responseTimeMs: Date.now() - startedAt,
      errorType: answered.errorType,
    });
  };

  const hintText = exercise.hint;
  const anyEx = exercise as any;

  // ── per-type rendering ──
  const body = (() => {
    switch (exercise.type) {
      case 'listen_select':
      case 'sound_compare': {
        // First-pass listening (R8): meanings stay hidden until the learner has
        // answered by ear alone — unless the accessibility setting shows them.
        const alwaysShow = settings.listeningTranscripts === 'always';
        return (
          <>
            <AudioButton audio={anyEx.audio} telugu={anyEx.spoken.telugu} autoPlay size="lg" />
            {answered && (
              <div className="transcript">
                <TeluguText value={anyEx.spoken} mode={translit} showEnglish />
              </div>
            )}
            <ChoiceList
              choices={anyEx.choices} correctChoiceIds={anyEx.correctChoiceIds}
              translit={translit} answered={!!answered} shuffleSeed={seed}
              onAnswer={(c, a, pc) => finish(c, a, pc)}
              display={answered || alwaysShow ? 'full' : 'telugu'}
            />
          </>
        );
      }
      case 'multiple_choice':
      case 'script_build':
      case 'story_checkpoint': {
        const q = anyEx.question;
        return (
          <>
            {exercise.type === 'script_build' && anyEx.parts && (
              <div className="script-parts" lang="te" aria-label="Parts to combine">
                {anyEx.parts.map((p: string, i: number) => (
                  <span key={i} className="script-part">{p}</span>
                ))}
              </div>
            )}
            {q && <TeluguText value={q} mode={translit} size="lg" />}
            <ChoiceList
              choices={anyEx.choices} correctChoiceIds={anyEx.correctChoiceIds}
              translit={translit} answered={!!answered} shuffleSeed={seed}
              onAnswer={(c, a, pc) => finish(c, a, pc)}
            />
          </>
        );
      }
      case 'image_match':
        return (
          <>
            {anyEx.mode !== 'audio-to-image' && (
              <div className="image-target">
                {anyEx.mode === 'image-to-word'
                  ? <span className="big-image" role="img" aria-label={anyEx.target.english ?? ''}>{anyEx.target.image}</span>
                  : <TeluguText value={anyEx.target} mode={translit} size="lg" />}
              </div>
            )}
            {anyEx.target.audio && <AudioButton audio={anyEx.target.audio} telugu={anyEx.target.telugu} />}
            <ChoiceList
              choices={anyEx.choices} correctChoiceIds={anyEx.correctChoiceIds}
              translit={translit} answered={!!answered} shuffleSeed={seed} imageMode={anyEx.mode !== 'image-to-word'}
              onAnswer={(c, a, pc) => finish(c, a, pc)}
            />
          </>
        );
      case 'word_tiles': {
        const ex = exercise as WordTilesExercise;
        const check = () => grade(tileAnswer.join(' '), (ex.acceptedOrders ?? [ex.tiles]).map((o) => o.join(' ')));
        return (
          <>
            <p className="tiles-target">{ex.direction === 'to-telugu' ? `“${ex.source.english}”` : ex.source.telugu}</p>
            <TileBuilder tiles={shuffledTiles} onChange={setTileAnswer} disabled={!!answered} />
            {!answered && (
              <button type="button" className="btn-check" onClick={check} disabled={tileAnswer.length === 0}>Check</button>
            )}
          </>
        );
      }
      case 'fill_blank': {
        const ex = exercise as FillBlankExercise;
        const accepted = [ex.answer, ...(ex.acceptedAnswers ?? [])];
        if (ex.choices && ex.choices.length > 0) {
          const choices: Choice[] = ex.choices.map((c, i) => ({ id: `c${i}`, telugu: c }));
          const correctIds = choices.filter((c) => matchesAnswer(c.telugu, accepted)).map((c) => c.id);
          return (
            <>
              <TeluguText value={ex.sentence} mode={translit} showEnglish size="lg" />
              <ChoiceList
                choices={choices} correctChoiceIds={correctIds}
                translit="never" answered={!!answered} shuffleSeed={seed}
                onAnswer={(c, a) => finish(c, a)}
              />
            </>
          );
        }
        return (
          <>
            <TeluguText value={ex.sentence} mode={translit} showEnglish size="lg" />
            <TeluguInput value={typed} onChange={setTyped} onSubmit={() => grade(typed, accepted)} />
            {!answered && (
              <button type="button" className="btn-check" onClick={() => grade(typed, accepted)} disabled={!typed.trim()}>Check</button>
            )}
          </>
        );
      }
      case 'translate': {
        const ex = exercise as TranslateExercise;
        const check = () => grade(typed, ex.acceptedAnswers, { romanized: ex.acceptedRomanizations });
        return (
          <>
            {ex.direction === 'to-english'
              ? <TeluguText value={ex.source} mode={translit} size="lg" />
              : <p className="translate-source">“{ex.source.english}”</p>}
            {ex.direction === 'to-english' && ex.source.audio && <AudioButton audio={ex.source.audio} telugu={ex.source.telugu} />}
            {ex.direction === 'to-telugu'
              ? <TeluguInput value={typed} onChange={setTyped} onSubmit={() => !answered && check()} />
              : (
                <input
                  className="tel-input" value={typed} placeholder="Type the English meaning…"
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !answered) check(); }}
                />
              )}
            {!answered && <button type="button" className="btn-check" onClick={check} disabled={!typed.trim()}>Check</button>}
          </>
        );
      }
      case 'dictation': {
        const ex = exercise as DictationExercise;
        const useTiles = !!ex.tiles && ex.tiles.length > 0;
        const check = (given: string) => grade(given, ex.acceptedAnswers);
        return (
          <>
            <AudioButton audio={ex.audio} telugu={ex.spoken.telugu} autoPlay size="lg" />
            {answered && <div className="transcript"><TeluguText value={ex.spoken} mode={translit} showEnglish /></div>}
            {useTiles ? (
              <>
                <TileBuilder tiles={ex.tiles!} onChange={setTileAnswer} disabled={!!answered} />
                {!answered && (
                  <button type="button" className="btn-check" onClick={() => check(tileAnswer.join(' '))} disabled={tileAnswer.length === 0}>Check</button>
                )}
              </>
            ) : (
              <>
                <TeluguInput value={typed} onChange={setTyped} onSubmit={() => !answered && check(typed)} />
                {!answered && <button type="button" className="btn-check" onClick={() => check(typed)} disabled={!typed.trim()}>Check</button>}
              </>
            )}
          </>
        );
      }
      case 'dialogue': {
        const ex = exercise as DialogueExercise;
        return (
          <>
            {ex.context && <p className="dialogue-context">📍 {ex.context}</p>}
            <div className="dialogue-turns">
              {ex.turns.map((t, i) => (
                <div key={i} className="dialogue-turn">
                  <span className="dialogue-speaker" lang="te">{t.speaker}</span>
                  <div className="dialogue-bubble">
                    <TeluguText value={t.line} mode={translit} showEnglish={!!answered} />
                    {t.line.audio && <AudioButton audio={t.line.audio} telugu={t.line.telugu} />}
                  </div>
                </div>
              ))}
            </div>
            {ex.responseMode === 'select' && ex.choices && (
              <ChoiceList
                choices={ex.choices} correctChoiceIds={ex.correctChoiceIds ?? []}
                translit={translit} answered={!!answered} shuffleSeed={seed}
                onAnswer={(c, a, pc) => finish(c, a, pc)}
              />
            )}
            {ex.responseMode === 'tiles' && ex.tiles && (
              <>
                <TileBuilder tiles={ex.tiles} onChange={setTileAnswer} disabled={!!answered} />
                {!answered && (
                  <button
                    type="button" className="btn-check"
                    onClick={() => grade(tileAnswer.join(' '), ex.acceptedAnswers ?? [])}
                    disabled={tileAnswer.length === 0}
                  >Check</button>
                )}
              </>
            )}
            {ex.responseMode === 'type' && (
              <>
                <TeluguInput value={typed} onChange={setTyped} />
                {!answered && (
                  <button
                    type="button" className="btn-check"
                    onClick={() => grade(typed, ex.acceptedAnswers ?? [])}
                    disabled={!typed.trim()}
                  >Check</button>
                )}
              </>
            )}
          </>
        );
      }
      case 'match_pairs':
        return (
          <MatchPairs
            exercise={anyEx}
            onDone={(anyMistake) => finish(!anyMistake, undefined)}
          />
        );
      case 'categorize':
        return (
          <Categorize
            exercise={anyEx} translit={translit}
            onDone={(anyMistake) => finish(!anyMistake, undefined)}
          />
        );
      case 'speaking':
        return (
          <Speaking
            exercise={anyEx} translit={translit}
            onDone={() => {
              // Speaking is completion-based, not graded.
              onComplete({ correct: true, usedHint: false, responseTimeMs: Date.now() - startedAt });
            }}
          />
        );
      default:
        return <p className="content-error">Unsupported exercise type: {(exercise as any).type} (exercise {(exercise as any).id})</p>;
    }
  })();

  const correctAnswerText = (() => {
    if (!answered || answered.correct) return undefined;
    if (anyEx.correctChoiceIds && anyEx.choices) {
      const c = anyEx.choices.find((ch: Choice) => anyEx.correctChoiceIds.includes(ch.id));
      return c?.telugu ?? c?.english;
    }
    if (anyEx.acceptedAnswers?.length) return anyEx.acceptedAnswers[0];
    if (anyEx.answer) return anyEx.answer;
    if (anyEx.tiles && exercise.type === 'word_tiles') return (exercise as WordTilesExercise).tiles.join(' ');
    return undefined;
  })();

  const pickedWhyWrong = answered?.pickedChoice?.whyWrong;

  return (
    <div className="exercise-host" data-type={exercise.type}>
      {exercise.prompt && <h2 className="exercise-prompt">{exercise.prompt}</h2>}
      {body}

      {hintText && !answered && (
        <div className="hint-area">
          {!showHint ? (
            <button type="button" className="btn-hint" onClick={() => { setShowHint(true); setUsedHint(true); }}>
              💡 Hint
            </button>
          ) : (
            <p className="hint-text">💡 {hintText}</p>
          )}
        </div>
      )}

      {retryMsg && !answered && (
        <div className="retry-bar" role="status" aria-live="polite">
          <span>🔁 {retryMsg}</span>
        </div>
      )}

      {answered && exercise.type !== 'speaking' && (
        <>
          <FeedbackBar
            status={answered.correct ? 'correct' : 'incorrect'}
            message={
              answered.correct
                ? answered.note ?? exercise.feedback?.correct
                : pickedWhyWrong ?? exercise.feedback?.incorrect
            }
            grammar={exercise.feedback?.grammar}
            correctAnswer={correctAnswerText}
          />
          <button type="button" className="btn-continue" onClick={continueOn} autoFocus>
            Continue →
          </button>
        </>
      )}
    </div>
  );
}
