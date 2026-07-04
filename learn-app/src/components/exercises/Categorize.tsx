// Categorize exercise: assign each item to a category by tapping the category
// button under it. Completes when all items are placed.

import { useEffect, useState } from 'react';
import type { CategorizeExercise } from '../../types/content';
import type { TransliterationMode } from '../../types/progress';
import { TeluguText } from '../ui';

export function Categorize({
  exercise,
  translit,
  onDone,
}: {
  exercise: CategorizeExercise;
  translit: TransliterationMode;
  onDone: (anyMistake: boolean) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  useEffect(() => { setAnswers({}); setChecked(false); }, [exercise]);

  const allPlaced = Object.keys(answers).length === exercise.items.length;

  const check = () => {
    setChecked(true);
    const anyMistake = exercise.items.some((item, i) => answers[i] !== item.category);
    onDone(anyMistake);
  };

  return (
    <div className="categorize">
      {exercise.items.map((item, i) => (
        <div key={i} className={`cat-item ${checked ? (answers[i] === item.category ? 'correct' : 'wrong') : ''}`}>
          <TeluguText value={item.text} mode={translit} showEnglish={checked} />
          <div className="cat-options" role="group" aria-label={`Category for ${item.text.telugu}`}>
            {exercise.categories.map((cat) => (
              <button
                type="button" key={cat}
                className={`cat-btn ${answers[i] === cat ? 'sel' : ''}`}
                onClick={() => !checked && setAnswers({ ...answers, [i]: cat })}
                aria-pressed={answers[i] === cat}
                disabled={checked}
                lang="te"
              >
                {cat}
              </button>
            ))}
          </div>
          {checked && answers[i] !== item.category && (
            <div className="cat-fix" lang="te">→ {item.category}</div>
          )}
        </div>
      ))}
      {!checked && (
        <button type="button" className="btn-check" onClick={check} disabled={!allPlaced}>
          Check
        </button>
      )}
    </div>
  );
}
