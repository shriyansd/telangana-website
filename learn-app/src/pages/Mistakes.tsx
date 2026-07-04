// Mistake review list: what was missed, why it matters, and a practice button.
// Tone is deliberately kind — mistakes are the curriculum, not a failure.

import { useEffect, useState } from 'react';
import { Link } from '../router';
import { conceptById } from '../content';
import { getAllMistakes, getAllMastery } from '../lib/storage';
import { masteryLabel } from '../lib/srs';
import type { MistakeRecord, ConceptMastery } from '../types/progress';

export function Mistakes() {
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [mastery, setMastery] = useState<Map<string, ConceptMastery>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [mi, ma] = await Promise.all([getAllMistakes(), getAllMastery()]);
      setMistakes(mi.filter((m) => !m.cleared).sort((a, b) => b.lastMissedAt.localeCompare(a.lastMissedAt)));
      setMastery(new Map(ma.map((m) => [m.conceptId, m])));
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <div className="page-loading" role="status">Loading…</div>;

  // Tricky words (P1: Anki calls these "leeches"): concepts that keep failing
  // despite repeated attempts deserve a different approach, not more of the same.
  const tricky = [...mastery.values()]
    .filter((m) => m.incorrectCount >= 4 && m.masteryScore < 40 && m.timesSeen >= 6)
    .sort((a, b) => b.incorrectCount - a.incorrectCount)
    .slice(0, 6);

  return (
    <div className="mistakes-page">
      <h1>Things to revisit</h1>
      {tricky.length > 0 && (
        <section className="tricky-words">
          <h2>🐌 Tricky words</h2>
          <p className="mistakes-intro">
            These keep slipping away — totally normal, every learner has a few. Try a different angle:
            write a memory hook for them in the <Link to="words">Word Book</Link>, listen to them a few
            extra times, or study what they're confused with.
          </p>
          <ul className="tricky-list">
            {tricky.map((m) => {
              const c = conceptById.get(m.conceptId);
              if (!c) return null;
              return (
                <li key={m.conceptId} className="tricky-item">
                  <span lang="te" className="mc-telugu">{c.telugu}</span>
                  <span className="mc-english">{c.english}</span>
                  {c.confusableWith?.length ? (
                    <span className="mc-confusion">
                      vs. {c.confusableWith.map((x) => conceptById.get(x)?.telugu).filter(Boolean).join(', ')}
                    </span>
                  ) : null}
                  <span className="mistake-meta">missed ×{m.incorrectCount}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {mistakes.length === 0 ? (
        <p className="mistakes-empty">Nothing here — your recent answers have all been solid. 🎉</p>
      ) : (
        <>
          <p className="mistakes-intro">
            These tripped you up recently. That's exactly how learning works — one focused pass and most of them will stick.
          </p>
          <ul className="mistake-list">
            {mistakes.map((m) => (
              <li key={m.exerciseId} className="mistake-item">
                <div className="mistake-concepts">
                  {m.conceptIds.map((cid) => {
                    const c = conceptById.get(cid);
                    const ms = mastery.get(cid);
                    if (!c) return null;
                    return (
                      <div key={cid} className="mistake-concept">
                        <span lang="te" className="mc-telugu">{c.telugu}</span>
                        <span className="mc-english">{c.english}</span>
                        {c.notes && <span className="mc-note">{c.notes}</span>}
                        {c.confusableWith?.length ? (
                          <span className="mc-confusion">
                            often confused with {c.confusableWith.map((x) => conceptById.get(x)?.telugu).filter(Boolean).join(', ')}
                          </span>
                        ) : null}
                        {ms && <span className={`mastery-chip m-${masteryLabel(ms.masteryScore)}`}>{masteryLabel(ms.masteryScore)}</span>}
                      </div>
                    );
                  })}
                </div>
                <span className="mistake-meta">missed ×{m.missCount}</span>
              </li>
            ))}
          </ul>
          <Link to="practice-mistakes" className="btn-primary big">Practice these now →</Link>
        </>
      )}
      <Link to="dashboard" className="btn-ghost">← Dashboard</Link>
    </div>
  );
}
