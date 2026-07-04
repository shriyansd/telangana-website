# Current course audit — Telugu Bata

Audit of the repository as of 2026-07-03, before the learning-system
transformation. Companion doc: `docs/learning-science.md`.

## Stack findings

| Area | Finding |
|---|---|
| Framework/build | Vite 6 + React 18 + TypeScript (strict), in `learn-app/`, builds to `learn/` at repo root; the rest of the site is plain static HTML and independent |
| Routing | Hand-written hash router (`src/router.tsx`), no dependency |
| Course data | `src/content/courses.json` (Course → Unit → lessonIds), 12 courses / 60 lessons |
| Lesson data | One JSON file per lesson in `src/content/lessons/`, code-split via `import.meta.glob`; most generated from data tables by `scripts/generate-lessons.mjs` |
| Exercise components | 14 types rendered by `src/components/exercises/ExerciseHost.tsx` |
| Progress tracking | IndexedDB (`telugu-bata` db) via hand-written wrapper; settings in localStorage; schema version flag with migration hook |
| Accounts / database | None (local-first by design); export/import via JSON file |
| Audio | None recorded yet; predictable path convention + labelled speechSynthesis fallback |
| Images | Emoji only; PWA icons generated |
| Fonts | Noto Sans Telugu (+ Nirmala UI fallback) |
| Transliteration | Local RTS-style Roman→Telugu with candidates; 3 display modes (always/tap/never) |
| Review/mastery | Concept-level SRS (0/1/3/7/14/30/60-day ladder), due review + mistake practice pages |
| Gamification | XP, streak, badges, daily goal; no lives/leaderboards/paywalls |
| Ordering | Deliberate path: Orientation → Script → First Conversations → Building Blocks → … → Real Conversations |
| Mobile | Responsive, bottom tab bar under 720px, 48px tap targets |
| Accessibility | aria-live feedback, keyboardable exercises, reduced-motion, text scaling, no color-only correctness |
| Content states | draft / needs-review / reviewed / published; production gate via `showDraftContent`; all current content **draft** |
| Authoring | JSON + generator data tables + CSV importer (`scripts/validate-content.mjs --csv`) |

## Learning-quality assessment

1. **What works:** concept-level SRS with due review; 14 interactive exercise
   types; mistakes re-queued in-session and recorded for later practice;
   receptive-before-productive ordering; draft gating; grapheme-safe answer
   matching with accepted-answer lists; grammar intro cards; stories with
   checkpoints.
2. **Primarily passive:** nothing is a scrolling article — the legacy
   `learn.html` reference page is passive but explicitly out of scope as a
   "quick reference." Story line-reveal is the most passive in-app flow, but it
   has checkpoints.
3. **Currently interactive:** every lesson is exercise-driven.
4. **Exercise types:** listen_select, multiple_choice, image_match, word_tiles,
   fill_blank, translate, dictation, script_build, sound_compare, dialogue,
   story_checkpoint, match_pairs, categorize, speaking.
5. **Recognition vs. production:** both exist, but **mastery does not
   distinguish them** — a concept could reach "mastered" through
   multiple-choice alone. *(Fixed in this transformation: per-skill dimensions +
   production requirement for high mastery.)*
6. **Do mistakes influence future lessons?** Yes (requeue + mistake records +
   review boost), but errors are not categorized by type. *(Fixed: ErrorType
   classification.)*
7. **Skills tracked separately?** No — one mastery score per concept.
   *(Fixed: per-dimension skill records.)*
8. **Review scheduled?** Yes, concept-level, deterministic.
9. **Does progress represent learning?** Partially: lesson completion is
   completion, but mastery/streak/XP are attempt-driven. Summary screens showed
   only XP/accuracy. *(Fixed: can-do statements + concepts-practiced summary.)*
10. **Architectural changes required:** skill-dimension mastery; support
    levels; error classification; two-stage corrective feedback; retrieval
    warm-up; unit learning design (goal/can-do/performance task); quality
    validation of exercise distribution.
11. **Changes possible without rewriting content:** all of the above — exercise
    types map deterministically to skill dimensions and support levels, so
    existing lesson JSON needs no edits; unit design fields are additive.
12. **Best pilot unit:** `c1-u1` "Saying Hello" (First Conversations) — approved
    seed content, high-frequency phrases, existing 4 lessons incl. a speaking
    lesson, natural performance task ("introduce yourself respectfully").
13. **Risks of migrating everything at once:** silently regressing 60 lessons'
    behavior; producing unreviewed Telugu at scale; breaking stored progress.
    Mitigations: additive schema (v1→v2 migration keeps old records valid),
    engine changes apply everywhere but *content* changes pilot-first, new
    Telugu marked draft.
14. **Incremental migration plan:**
    - Phase 2–3 (engine): ship skill dimensions, scheduler, feedback, warm-up —
      applies to all lessons automatically, no content edits.
    - Phase 4 (pilot): add UnitLearningDesign to c1-u1, author its unit-review
      lesson and dialogue performance task (draft).
    - Phase 5+: one unit at a time, using the same generator/data-table
      tooling; each unit gets goal + review + performance task; native review
      gate before `published`.
