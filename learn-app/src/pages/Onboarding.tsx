// Onboarding: a few taps, no personal data, skippable, all changeable later.

import { useState } from 'react';
import { navigate } from '../router';
import { useApp } from '../AppContext';
import type { LearnerProfile, LearnerSettings } from '../types/progress';

type Answers = {
  experience?: string;
  focus: string[];
  goal?: 5 | 10 | 15 | 20;
  translit?: LearnerSettings['transliteration'];
  ageMode?: LearnerProfile['ageMode'];
};

const EXPERIENCE = [
  { id: 'new', label: 'I am completely new', path: 'complete-beginner' as const, self: { understand: 0, speak: 0, read: 0, write: 0 } },
  { id: 'little', label: 'I understand a little', path: 'complete-beginner' as const, self: { understand: 1, speak: 0, read: 0, write: 0 } },
  { id: 'understand', label: 'I understand Telugu but don’t speak confidently', path: 'heritage-learner' as const, self: { understand: 3, speak: 1, read: 0, write: 0 } },
  { id: 'speak', label: 'I speak Telugu but can’t read it', path: 'heritage-learner' as const, self: { understand: 3, speak: 3, read: 0, write: 0 } },
  { id: 'read-some', label: 'I can read some Telugu', path: 'heritage-learner' as const, self: { understand: 3, speak: 2, read: 2, write: 1 } },
  { id: 'advanced', label: 'I know Telugu and want practice', path: 'heritage-learner' as const, self: { understand: 4, speak: 3, read: 3, write: 2 } },
];

const FOCUS = [
  'Speaking with family', 'Everyday conversation', 'Reading Telugu', 'Writing Telugu',
  'Listening', 'Culture & stories', 'A balanced course',
];

export function Onboarding() {
  const { updateProfile, updateSettings } = useApp();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ focus: [] });

  const finish = async (skip = false) => {
    const exp = EXPERIENCE.find((e) => e.id === a.experience);
    await updateProfile({
      onboarded: true,
      path: skip ? 'complete-beginner' : exp?.path ?? 'complete-beginner',
      focus: a.focus,
      selfAssessment: exp?.self ?? { understand: 0, speak: 0, read: 0, write: 0 },
      ageMode: a.ageMode,
    });
    updateSettings({
      dailyGoalMinutes: a.goal ?? 10,
      transliteration: a.translit ?? 'always',
    });
    // Heritage learners get a skill-specific check (H1) instead of one
    // "do you know Telugu?" question — listening, vocabulary, and reading are
    // measured separately and seed their starting mastery.
    const path = skip ? 'complete-beginner' : exp?.path ?? 'complete-beginner';
    navigate(path === 'heritage-learner' ? 'placement' : 'dashboard');
  };

  const steps = [
    // 1 — experience
    <div key="exp" className="ob-step">
      <h1>What's your Telugu experience?</h1>
      <div className="ob-options">
        {EXPERIENCE.map((e) => (
          <button key={e.id} type="button" className={`ob-option ${a.experience === e.id ? 'sel' : ''}`}
            onClick={() => { setA({ ...a, experience: e.id }); setStep(1); }}>
            {e.label}
          </button>
        ))}
      </div>
    </div>,
    // 2 — focus (multi)
    <div key="focus" className="ob-step">
      <h1>What do you want to focus on?</h1>
      <p className="ob-hint">Pick any that apply.</p>
      <div className="ob-options">
        {FOCUS.map((f) => (
          <button key={f} type="button" className={`ob-option ${a.focus.includes(f) ? 'sel' : ''}`}
            onClick={() => setA({ ...a, focus: a.focus.includes(f) ? a.focus.filter((x) => x !== f) : [...a.focus, f] })}>
            {a.focus.includes(f) ? '✓ ' : ''}{f}
          </button>
        ))}
      </div>
      <button type="button" className="btn-primary" onClick={() => setStep(2)} disabled={a.focus.length === 0}>Next</button>
    </div>,
    // 3 — daily goal
    <div key="goal" className="ob-step">
      <h1>Daily goal?</h1>
      <p className="ob-hint">Small and steady beats long and rare.</p>
      <div className="ob-options row">
        {([5, 10, 15, 20] as const).map((g) => (
          <button key={g} type="button" className={`ob-option ${a.goal === g ? 'sel' : ''}`}
            onClick={() => { setA({ ...a, goal: g }); setStep(3); }}>
            {g} min
          </button>
        ))}
      </div>
    </div>,
    // 4 — transliteration
    <div key="tr" className="ob-step">
      <h1>How should Telugu be shown?</h1>
      <div className="ob-options">
        <button type="button" className={`ob-option ${a.translit === 'always' ? 'sel' : ''}`} onClick={() => { setA({ ...a, translit: 'always' }); setStep(4); }}>
          <span lang="te">నమస్కారం</span> + namaskāram <small>Telugu with pronunciation</small>
        </button>
        <button type="button" className={`ob-option ${a.translit === 'tap' ? 'sel' : ''}`} onClick={() => { setA({ ...a, translit: 'tap' }); setStep(4); }}>
          <span lang="te">నమస్కారం</span> <small>pronunciation hidden until tapped</small>
        </button>
        <button type="button" className={`ob-option ${a.translit === 'never' ? 'sel' : ''}`} onClick={() => { setA({ ...a, translit: 'never' }); setStep(4); }}>
          <span lang="te">నమస్కారం</span> <small>Telugu only</small>
        </button>
      </div>
    </div>,
    // 5 — age mode (optional)
    <div key="age" className="ob-step">
      <h1>Who's learning? <span className="ob-optional">(optional)</span></h1>
      <div className="ob-options row">
        {(['child', 'teen', 'adult', 'family'] as const).map((m) => (
          <button key={m} type="button" className={`ob-option ${a.ageMode === m ? 'sel' : ''}`}
            onClick={() => setA({ ...a, ageMode: m })}>
            {m === 'child' ? '🧒 Child' : m === 'teen' ? '🧑 Teen' : m === 'adult' ? '🧑‍🦱 Adult' : '👪 Family'}
          </button>
        ))}
      </div>
      <button type="button" className="btn-primary big" onClick={() => finish()}>Start learning →</button>
    </div>,
  ];

  return (
    <div className="onboarding">
      <div className="ob-progress" aria-hidden="true">
        {steps.map((_, i) => <span key={i} className={`ob-dot ${i <= step ? 'on' : ''}`} />)}
      </div>
      {steps[step]}
      <div className="ob-footer">
        {step > 0 && <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>← Back</button>}
        <button type="button" className="btn-ghost" onClick={() => finish(true)}>Skip — use defaults</button>
      </div>
      <p className="ob-privacy">No name, email, or age is collected. Everything can be changed in Settings.</p>
    </div>
  );
}
