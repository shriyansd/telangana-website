# Learning-science evidence base for Telugu Bata

This document lists the sources behind the platform's learning design, what each
source actually supports, and the exact feature it motivates. Source IDs
(`D1`, `R1`, `H1`) are referenced in code comments where a design decision
comes directly from one of them.

**Evidence labels used below:**
- **Strong** — meta-analytic or replicated experimental finding
- **Moderate** — single studies or syntheses with caveats
- **Product inference** — a public product practice, not research per se
- **Experimental** — our own untested extension
- **Assumption** — an implementation choice we made for practicality

---

## Publicly described product practices (Duolingo)

These are *product inferences*: publicly described practices of a successful
product, used as design input. We do not copy branding, wording, layouts,
scoring scales, or proprietary algorithms.

### D1 — Course and unit structure
*"Duolingo 101: How to Learn a Language on Duolingo," Duolingo Blog, 2024.*

Courses divide into units around communication goals; units cap the number of
vocabulary/grammar topics; the four skills are integrated; difficulty moves
from recognition to production; personalized practice targets due material and
past mistakes.

**Motivates:** unit-level `communicationGoal` and `canDoStatement` fields;
receptive-before-productive session ordering (`src/lib/session.ts`); the Due
Review and Mistakes practice modes.

### D2 — The Duolingo Method white paper
*Freeman et al., "The Duolingo Method for App-based Teaching and Learning,"
Duolingo Research Report, 2023.*

Learn by doing; few objectives per lesson; scaffold from known material;
contrasted examples; progressive complexity; resurface mistakes; spaced
repetition; concise explicit instruction; organize by proficiency standards.

**Motivates:** micro-lessons with `newConceptLimit`; `whyWrong` contrast text on
distractors; grammar intro cards kept to one rule + examples; missed-exercise
requeue in the same session; the SRS scheduler.

### D3 — Short, focused mini-units
*"New Mini-Units Make Intermediate Learning More Engaging and Effective,"
Duolingo Blog, March 2026.*

Short units with a handful of new items, used immediately in stories,
listening, and speaking.

**Motivates:** 5–10 minute lessons; new vocabulary reappearing in the same
unit's sentences, stories, and the unit performance task.

### D4 — Targeted practice
*"The Duolingo Practice Tab Is Free for Learners," Duolingo Blog, Feb 2026.*

Separate modes for mistakes, words, speaking, listening; revisitable immersive
content.

**Motivates:** the Review, Mistakes, Script Practice, Stories, Word Book, and
Lightning Round modes, all writing to the same mastery model.

### D5 — Proficiency-anchored progress
*"How the Duolingo Score Tracks Your Learning Progress," Duolingo Blog, 2024.*

Progress should communicate what a learner *can do*, not just completion.

**Motivates:** can-do statements on units and in the lesson summary; skill-split
progress display instead of one global percentage.

---

## Second-language acquisition research

### R1 — Spaced practice — **Strong**
*Kim & Webb, "The Effects of Spaced Practice on Second Language Learning: A
Meta-Analysis." Language Learning, 2022. DOI: 10.1111/lang.12479.*

Spaced beats massed practice; longer gaps help delayed retention; equal vs.
expanding schedules were statistically similar; **no single interval sequence
is proven optimal**.

**Motivates:** the concept-level scheduler in `src/lib/srs.ts`. Its ladder
(same-session → 1 → 3 → 7 → 14 → 30 → 60 days) is an **implementation
assumption** — deterministic, testable defaults, *not* claimed as scientifically
optimal. The scheduler is adaptive: intervals respond to correctness, hints,
support level, and error streaks.

### R2 — Repeated within-session retrieval — **Moderate**
*Nakata, "Does Repeated Practice Make Perfect?…" SSLA, 2017.*

Retrieving an item several times within a session improves vocabulary learning.

**Motivates:** each new concept appears in multiple exercises of *different
types* within its lesson (the generator emits identify → listen → word-context →
match for each item); missed items are re-queued 2–4 positions later rather
than immediately.

### R3 — Smaller learning sets — **Moderate**
*Nakata, "Does Studying Vocabulary in Smaller Sets Increase Learning?" SSLA, 2016.*

Smaller sets beat one large block.

**Motivates:** `newConceptLimit` per lesson (default soft limit ~4–7, validator
warns beyond it; authors can override). Default of 3–7 genuinely new items per
micro-lesson is a **product inference** on top of this finding.

### R4 — Retrieval direction and proficiency — **Moderate**
*Terai, Yamashita & Pasich, "Effects of Learning Direction in Retrieval
Practice on EFL Vocabulary Learning." SSLA, 2021.*

Lower-proficiency learners benefited more from target→known recognition;
higher-proficiency learners from known→target production.

**Motivates:** `SupportLevel` (`recognition` → `guided-recall` →
`partial-production` → `independent-production` → `transfer`) and
`selectSupportLevel()` in `src/lib/srs.ts`: low-mastery concepts get
recognition credit and recognition-first ordering; higher mastery shifts credit
and selection toward production. Recognition alone can never push a concept's
mastery past the "familiar" band — production evidence is required to reach
"strong"/"mastered" (**product inference** built on R4).

### R5 — Focused explicit instruction — **Strong**
*Norris & Ortega, "Effectiveness of L2 Instruction." Language Learning, 2000.
DOI: 10.1111/0023-8333.00136.*

Focused instruction produces large gains; explicit beats implicit for targeted
forms.

**Motivates:** short grammar cards shown *before* practice (lesson intro
screen), always tied to two or three meaningful examples, never a lecture; the
"notice first, then explain" ordering in pattern lessons.

### R6 — Corrective feedback — **Strong**
*Li, "The Effectiveness of Corrective Feedback in SLA: A Meta-Analysis."
Language Learning, 2010. Lyster & Saito, "Oral Feedback in Classroom SLA."
SSLA, 2010.*

Corrective feedback helps; prompting self-repair is valuable; design matters.

**Motivates:** the two-stage feedback flow in the exercise engine: on a first
wrong *typed/constructed* answer, the learner gets a nudge (and the hint if one
exists) and a chance to self-correct before the answer is revealed; only the
second failure reveals the answer with a contrast explanation (`whyWrong`).
For multiple-choice, where the answer becomes visible on selection, we reveal
immediately with contrast — a **implementation assumption** (self-correction
after seeing choices is not meaningful). Corrected concepts are re-queued
in-session and boosted in near-term review.

### R7 — Interaction and output — **Strong**
*Loewen & Sato, "Interaction and Instructed Second Language Acquisition."
Language Teaching, 2018.*

Input + interaction + output all matter.

**Motivates:** dialogue exercises with selectable/constructed/typed responses;
the unit performance task as an authored branching dialogue; validator warnings
for units with no production.

### R8 — Meaning-focused input — **Strong**
*Webb et al., "How Effective Is Second Language Incidental Vocabulary
Learning? A Meta-Analysis." Language Teaching, 2023.*

Reading/listening input builds vocabulary, but exposure ≠ mastery.

**Motivates:** stories with checkpoints and vocabulary previews; story
completion is tracked but **does not** mark contained words as mastered — only
retrieval attempts move mastery.

### R9 — Pronunciation / high-variability phonetic training — **Moderate**
*Uchihara et al., "High Variability Phonetic Training: A Meta-Analysis." SSLA,
2025. Lee, Jang & Plonsky, "The Effectiveness of L2 Pronunciation
Instruction." Applied Linguistics, 2015.*

Perception training works; varied examples and speakers aid generalization.

**Motivates:** the `sound_compare` exercise type for Telugu contrasts (త/ట,
ద/డ, ల/ళ, స/శ/ష); the audio schema's `speakerId`/`region` fields so contrasts
can use multiple speakers *when recordings exist*; record-and-compare speaking
with no automatic accent judgment. Multi-speaker coverage is currently
**blocked on recordings** — a documented limitation, not a claim.

### R10 — Gamification — **Moderate, with hazards**
*Sailer & Homner, "The Gamification of Learning: A Meta-Analysis." Educ.
Psych. Review, 2020. Mogavi et al., "When Gamification Spoils Your Learning."
2022.*

Small average benefit; badly designed gamification displaces learning.

**Motivates:** streaks/XP/badges exist but are subordinate: repeat-lesson XP is
scaled down (~0.3×), production earns more than recognition, review earns
credit, and there are **no** lives, paywalls, leaderboards, or shame messages.
Learning metrics (first-attempt accuracy, per-skill mastery) are stored
separately from engagement metrics (XP, streak).

### R11 — Action-oriented proficiency (CEFR) — **Strong as framework**
*Council of Europe, CEFR descriptors and action-oriented approach.*

Organize learning around real-world tasks and can-do outcomes across
reception, production, interaction.

**Motivates:** every unit's `communicationGoal`, `canDoStatement`,
`realWorldScenario`, and `finalPerformanceTask` fields. Labels are
"CEFR-informed / approximately early A1" — **we do not claim CEFR
certification or alignment validation**.

---

## Other platform inspirations (P-series)

Like the D-series, these are *product inferences* — publicly known mechanics of
other learning tools, reimplemented from the general idea only. No code,
assets, wording, or proprietary algorithms were copied from any of them.

### P1 — Anki / SuperMemo: leech detection
*Anki manual ("leeches"); SuperMemo research pages (Wozniak), publicly documented.*

Items that keep failing despite repeated review ("leeches") waste review time;
flagging them for a different study strategy beats brute repetition.

**Motivates:** the "Tricky words" section on the Mistakes page — concepts with
4+ failures, low mastery, and 6+ exposures are surfaced with their confusables
and a suggestion to try a different angle (memory hook, extra listening)
rather than more of the same drilling. Thresholds are **implementation
assumptions**.

### P2 — Memrise: learner-created mnemonics ("mems")
*Memrise's publicly described "mems" feature.* Research grounding in **R12**.

**Motivates:** "memory hooks" in the Word Book — a personal, locally-stored
mnemonic per word, written by the learner (self-generated cues are better
remembered than supplied ones — the generation effect).

### P3 — Pimsleur: audio-first anticipation and graduated recall
*Pimsleur's publicly described method (graduated-interval recall, 1967).*

Graduated-interval recall is an ancestor of our SRS ladder; anticipation
drills (prompt → pause → speak → confirm) inform the speaking exercises'
model-then-record flow. Not directly copied; noted as lineage.

### P4 — Duolingo streak flexibility / wellbeing critiques
*Public streak-repair mechanics; Mogavi et al. 2022 (see R10).*

**Motivates:** the weekly **rest day** — missing exactly one day per calendar
week does not reset the streak. Ours is automatic and free (never sold, never
gated), which is a deliberate divergence: streak pressure should never become
compulsion. **Experimental feature.**

### P5 — LingQ / comprehensible-input tools *(not yet built)*
Known-word highlighting inside stories (color words by mastery state) is on
the roadmap; recorded here so the inspiration is credited before the feature
lands.

### R12 — Keyword mnemonics & generation effect — **Moderate**
*Atkinson & Raugh, "An application of the mnemonic keyword method to the
acquisition of a Russian vocabulary." Journal of Experimental Psychology,
1975. Slamecka & Graf, "The generation effect." JEP:HLM, 1978.*

Keyword mnemonics aid vocabulary acquisition; self-generated material is
remembered better than provided material.

**Motivates:** memory hooks are learner-*written*, not app-supplied — the
learner generates the cue. We deliberately do not ship pre-written mnemonics.

### R13 — Desirable difficulties — **Strong**
*Bjork & Bjork, "Making things hard on yourself, but in a good way," 2011.*

Conditions that slow visible learning (spacing, interleaving, retrieval,
reduced support) improve retention.

**Motivates:** the whole progressive-support design; specifically justifies
first-pass listening (meanings hidden until answered) and transliteration
fading — difficulty is added only where it produces retention, and every
difficulty has an accessibility escape hatch.

## Heritage-language research

### H1 — Heritage curriculum — **Moderate**
*Kondo-Brown, "Curriculum Development for Advancing Heritage Language
Competence." ARAL, 2010. DOI: 10.1017/S0267190510000012.*

Heritage learners have uneven skill profiles and need matching curriculum and
assessment.

**Motivates:** per-skill mastery dimensions (listening vs. reading vs.
production vs. script tracked separately); the heritage learner path flag; the
onboarding self-assessment that asks about understand/speak/read/write
separately rather than one "do you know Telugu?" question.

### H2 — Spoken knowledge as literacy foundation — **Moderate**
*Chevalier, "Heritage Language Literacy: Theory and Practice."*

Literacy teaching can build on existing oral knowledge.

**Motivates:** the script course's "Reading Real Words" unit teaches reading
using అమ్మ, పాలు, ఇల్లు — words heritage learners already know orally — and
reading exercises share concept IDs with the oral vocabulary so oral knowledge
and literacy reinforce each other in the SRS.

---

## Summary of deliberate non-claims

- The interval ladder is a default, not "the scientifically optimal schedule."
- Story/lesson completion is never presented as mastery.
- No CEFR certification is claimed.
- No pronunciation scoring is claimed (no validated Telugu ASR is available
  for free); speaking is record-compare + optional experimental browser ASR.
- All AI-seeded Telugu is `draft` until native-speaker review (see
  `docs/CONTRIBUTING-CONTENT.md` review workflow).
