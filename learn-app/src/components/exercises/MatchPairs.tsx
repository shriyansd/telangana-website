// Match-pairs exercise: tap one item from each column to pair them.
// Completes when all pairs are matched; counts as incorrect if any mismatch happened.

import { useEffect, useMemo, useState } from 'react';
import type { MatchPairsExercise } from '../../types/content';

function shuffleArr<T>(arr: T[], seed = 7): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 22695477 + 1) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MatchPairs({ exercise, onDone }: { exercise: MatchPairsExercise; onDone: (anyMistake: boolean) => void }) {
  const left = useMemo(() => exercise.pairs.map((p, i) => ({ text: p.a.telugu, i })), [exercise]);
  const right = useMemo(() => shuffleArr(exercise.pairs.map((p, i) => ({ text: p.b.telugu, i }))), [exercise]);
  const [selLeft, setSelLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);

  useEffect(() => {
    setSelLeft(null); setMatched(new Set()); setMistakes(0);
  }, [exercise]);

  const pickRight = (i: number) => {
    if (selLeft === null || matched.has(i)) return;
    if (i === selLeft) {
      const next = new Set(matched);
      next.add(i);
      setMatched(next);
      setSelLeft(null);
      if (next.size === exercise.pairs.length) onDone(mistakes > 0);
    } else {
      setMistakes(mistakes + 1);
      setWrongFlash(i);
      setTimeout(() => setWrongFlash(null), 600);
    }
  };

  return (
    <div className="match-pairs" role="group" aria-label="Match the pairs">
      <div className="match-col">
        {left.map(({ text, i }) => (
          <button
            type="button" key={i} lang="te"
            className={`match-item ${matched.has(i) ? 'done' : ''} ${selLeft === i ? 'sel' : ''}`}
            onClick={() => !matched.has(i) && setSelLeft(i)}
            disabled={matched.has(i)}
          >
            {text}
          </button>
        ))}
      </div>
      <div className="match-col">
        {right.map(({ text, i }) => (
          <button
            type="button" key={i} lang="te"
            className={`match-item ${matched.has(i) ? 'done' : ''} ${wrongFlash === i ? 'flash-wrong' : ''}`}
            onClick={() => pickRight(i)}
            disabled={matched.has(i) || selLeft === null}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
