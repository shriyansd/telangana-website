// Skill-specific placement (H1/H2): measures listening, spoken vocabulary, and
// script reading SEPARATELY — a heritage speaker may be strong orally and new
// to the script. Deterministic authored items over reviewed course concepts;
// results seed the same per-skill mastery model every lesson uses, so nothing
// here is a throwaway quiz.

import { useMemo, useState } from 'react';
import { navigate } from '../router';
import { useApp } from '../AppContext';
import { conceptById } from '../content';
import { recordExerciseOutcome } from '../lib/progress-service';
import { AudioButton, TeluguText } from '../components/ui';
import type { Exercise } from '../types/content';

type Section = 'listening' | 'vocabulary' | 'reading';

interface Item {
  section: Section;
  conceptId: string;
  prompt: string;
  /** show telugu text (reading) or play audio (listening) or show telugu+translit (vocab) */
  options: { label: string; correct: boolean }[];
}

// Items draw only on existing course concepts — no new Telugu.
function buildItems(): Item[] {
  const c = (id: string) => conceptById.get(id)!;
  const listening: Item[] = [
    ['greet-namaskaram', ['hello / greetings', 'thank you', 'goodbye']],
    ['thanks', ['thank you', 'please', 'sorry']],
    ['want-water', ['I want water', 'I am hungry', 'I am fine']],
    ['how-are-you', ['how are you?', 'what is your name?', 'where are you?']],
  ].map(([id, opts]) => ({
    section: 'listening' as Section,
    conceptId: id as string,
    prompt: 'Listen. What does it mean?',
    options: (opts as string[]).map((label, i) => ({ label, correct: i === 0 })),
  }));
  const vocabulary: Item[] = [
    ['fam-ammamma', ['grandmother (mother\'s side)', 'older sister', 'aunt']],
    ['word-rice-food', ['rice / a meal', 'milk', 'fruit']],
    ['no-ledu', ['no (there isn\'t)', 'no (it is not)', 'don\'t want']],
    ['eat-respectful', ['eat (respectful request)', 'come here', 'sit down']],
  ].map(([id, opts]) => ({
    section: 'vocabulary' as Section,
    conceptId: id as string,
    prompt: 'What does this mean?',
    options: (opts as string[]).map((label, i) => ({ label, correct: i === 0 })),
  }));
  const reading: Item[] = [
    ['fam-amma', ['amma', 'anna', 'akka']],
    ['word-milk', ['pālu', 'paṇḍu', 'pappu']],
    ['place-badi', ['baḍi', 'guḍi', 'gadi']],
    ['num-2', ['reṇḍu', 'mūḍu', 'okaṭi']],
  ].map(([id, opts]) => ({
    section: 'reading' as Section,
    conceptId: id as string,
    prompt: 'Read it. How does it sound?',
    options: (opts as string[]).map((label, i) => ({ label, correct: i === 0 })),
  }));
  return [...listening, ...vocabulary, ...reading].filter((it) => conceptById.has(it.conceptId));
}

/** minimal pseudo-exercise so placement answers feed normal mastery/SRS */
function pseudoExercise(it: Item): Exercise {
  const base = { id: `placement-${it.section}-${it.conceptId}`, conceptIds: [it.conceptId] };
  if (it.section === 'listening') {
    return { ...base, type: 'listen_select', audio: {}, spoken: { telugu: conceptById.get(it.conceptId)!.telugu }, choices: [], correctChoiceIds: [] } as any;
  }
  if (it.section === 'reading') {
    return { ...base, type: 'multiple_choice', skillDimension: 'reading', choices: [], correctChoiceIds: [] } as any;
  }
  return { ...base, type: 'multiple_choice', choices: [], correctChoiceIds: [] } as any;
}

const SECTION_LABEL: Record<Section, string> = {
  listening: '👂 Listening',
  vocabulary: '🧠 Words you may know',
  reading: 'అ Reading Telugu script',
};

export function Placement() {
  const { translitMode, refreshStats } = useApp();
  const items = useMemo(buildItems, []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<Section, { right: number; total: number }>>({
    listening: { right: 0, total: 0 }, vocabulary: { right: 0, total: 0 }, reading: { right: 0, total: 0 },
  });
  const [done, setDone] = useState(false);
  const [options, setOptions] = useState(() => shuffle(items[0].options));

  function shuffle<T>(a: T[]): T[] {
    const arr = [...a];
    for (let j = arr.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
    return arr;
  }

  const it = items[i];
  const concept = conceptById.get(it?.conceptId ?? '');

  const answer = async (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    const correct = options[idx].correct;
    setScores((s) => ({ ...s, [it.section]: { right: s[it.section].right + (correct ? 1 : 0), total: s[it.section].total + 1 } }));
    // Feed the real mastery model: correct placement answers seed the SRS so
    // known material starts with credit and shows up less in early lessons.
    try {
      await recordExerciseOutcome(pseudoExercise(it), 'placement', {
        correct, firstAttemptCorrect: correct, usedHint: false, responseTimeMs: 0,
      });
    } catch { /* best-effort */ }
    window.setTimeout(async () => {
      setPicked(null);
      if (i + 1 >= items.length) {
        await refreshStats();
        setDone(true);
      } else {
        setI(i + 1);
        setOptions(shuffle(items[i + 1].options));
      }
    }, 600);
  };

  const skip = () => navigate('dashboard');

  if (done) {
    const band = (s: { right: number; total: number }) =>
      s.total === 0 ? 'not tested' : s.right >= s.total - 0 ? 'strong' : s.right >= Math.ceil(s.total / 2) ? 'developing' : 'new';
    const reading = band(scores.reading);
    return (
      <div className="placement done">
        <h1>Your starting profile</h1>
        <ul className="placement-profile">
          <li><strong>Listening:</strong> {band(scores.listening)} ({scores.listening.right}/{scores.listening.total})</li>
          <li><strong>Spoken vocabulary:</strong> {band(scores.vocabulary)} ({scores.vocabulary.right}/{scores.vocabulary.total})</li>
          <li><strong>Reading the script:</strong> {reading} ({scores.reading.right}/{scores.reading.total})</li>
        </ul>
        <p className="placement-note">
          {reading === 'new' && (scores.listening.right + scores.vocabulary.right) >= 5
            ? 'You clearly know spoken Telugu: start with The Telugu Script course and you\'ll be reading words you already know within a few lessons.'
            : reading !== 'new'
              ? 'You can already read some Telugu: feel free to move quickly through the script course and jump into conversations.'
              : 'Starting from the beginning is perfect, the course builds up letter by letter.'}
        </p>
        <p className="placement-note">What you answered correctly is already credited: those words will appear less often and be reviewed on a normal schedule.</p>
        <button type="button" className="btn-primary big" onClick={() => navigate('dashboard')}>To my dashboard →</button>
      </div>
    );
  }

  if (!it || !concept) return null;
  return (
    <div className="placement">
      <header className="placement-head">
        <h1>Quick skill check</h1>
        <p>{SECTION_LABEL[it.section]} · {i + 1}/{items.length}</p>
        <button type="button" className="btn-ghost" onClick={skip}>Skip and start from the beginning</button>
      </header>
      <div className="placement-item">
        <p className="exercise-prompt">{it.prompt}</p>
        {it.section === 'listening'
          ? <AudioButton telugu={concept.telugu} autoPlay />
          : <TeluguText
              value={{ telugu: concept.telugu, transliteration: it.section === 'reading' ? undefined : concept.transliteration }}
              mode={it.section === 'reading' ? 'never' : translitMode} size="lg"
            />}
        <div className="choice-list" role="group" aria-label="Answer choices">
          {options.map((o, idx) => (
            <button
              key={o.label} type="button"
              className={`choice ${picked === idx ? (o.correct ? 'correct' : 'wrong') : ''}`}
              onClick={() => void answer(idx)} disabled={picked !== null}
            >
              <span className="choice-num" aria-hidden="true">{idx + 1}</span>
              <span className="choice-english">{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
