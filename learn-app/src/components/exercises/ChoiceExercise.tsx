// Generic choice-based exercise core. Powers listen_select, multiple_choice,
// image_match, script_build, sound_compare, story_checkpoint, and dialogue-select.

import { useEffect, useState } from 'react';
import type { Choice } from '../../types/content';
import type { TransliterationMode } from '../../types/progress';
import { TeluguText } from '../ui';

export interface ChoiceExerciseProps {
  choices: Choice[];
  correctChoiceIds: string[];
  translit: TransliterationMode;
  onAnswer: (correct: boolean, answerGiven: string, pickedChoice: Choice) => void;
  answered: boolean;
  /** show images (emoji) large */
  imageMode?: boolean;
  /** show only Telugu, only English, or full stacks */
  display?: 'full' | 'telugu' | 'english';
  shuffleSeed?: number;
}

function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ChoiceList({ choices, correctChoiceIds, translit, onAnswer, answered, imageMode, display = 'full', shuffleSeed = 1 }: ChoiceExerciseProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [order, setOrder] = useState<Choice[]>(() => shuffled(choices, shuffleSeed));

  useEffect(() => {
    setPicked(null);
    setOrder(shuffled(choices, shuffleSeed));
  }, [choices, shuffleSeed]);

  const pick = (c: Choice) => {
    if (answered || picked) return;
    setPicked(c.id);
    onAnswer(correctChoiceIds.includes(c.id), c.telugu || c.english || c.id, c);
  };

  // Number keys 1–9 answer directly (skipped while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (answered || picked) return;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= order.length) pick(order[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, picked, order]);

  return (
    <div className={`choice-list ${imageMode ? 'image-mode' : ''}`} role="group" aria-label="Answer choices">
      {order.map((c, i) => {
        const isPicked = picked === c.id;
        const isCorrect = correctChoiceIds.includes(c.id);
        const showState = (answered || picked) && (isPicked || isCorrect);
        return (
          <button
            type="button"
            key={c.id}
            className={`choice ${showState ? (isCorrect ? 'correct' : 'wrong') : ''}`}
            onClick={() => pick(c)}
            disabled={answered || picked !== null}
            aria-pressed={isPicked}
          >
            <span className="choice-num" aria-hidden="true">{i + 1}</span>
            {c.image && <span className="choice-image" aria-hidden="true">{c.image}</span>}
            {display !== 'english' && c.telugu && (
              <TeluguText value={{ telugu: c.telugu, transliteration: c.transliteration }} mode={translit} size={imageMode ? 'sm' : 'md'} />
            )}
            {(display === 'english' || (!c.telugu && c.english)) && <span className="choice-english">{c.english}</span>}
            {display === 'full' && c.telugu && c.english && <span className="choice-meaning">{c.english}</span>}
          </button>
        );
      })}
    </div>
  );
}
