# Telugu Bata (బాట) — free interactive Telugu course

The learning app that lives at **`/learn`** on telanganaday.com. This folder
(`learn-app/`) is the source; the built, deployable output is the `learn/`
directory at the repository root. The rest of the website (index.html,
learn.html, about.html …) is untouched plain HTML and does not depend on this
app.

- **Costs $0 to run**: static files only. No backend, no database server, no
  paid APIs, no TTS subscriptions. Host it anywhere that serves files.
- **Local-first**: all learner progress lives in the browser (IndexedDB).
  No accounts, no analytics, no uploads. Learners can export/import their
  progress as a JSON file from Settings.
- **Original identity**: Telugu Bata borrows *learning science* (spaced
  repetition, active recall, interleaving) — not anyone's branding, wording,
  or layouts.
- **Extras**: dark mode (auto/light/dark), WebAudio-synthesized sound effects
  (no audio files), confetti on lesson completion (reduced-motion aware),
  number-key answer shortcuts, a daily Word of the Day, a 60-second Lightning
  Round vocabulary game, and a searchable Word Book with per-word mastery.

## How to run, build, test

Requires Node 18+.

```bash
cd learn-app
npm install
npm run dev              # dev server at http://localhost:5173/learn/
npm test                 # vitest unit tests (SRS, matching, sessions, XP, validation)
npm run validate-content # content lint: duplicate IDs, missing answers, audio audit
npm run build            # typecheck + build into ../learn (the deployable folder)
npm run preview          # serve the built output at http://localhost:4173/learn/
```

Deploying = uploading the repository (or at least the root HTML files plus the
`learn/` folder) to any static host. The app uses **hash routing**
(`/learn/#/dashboard`), so no server rewrites are needed.

## Architecture

```
learn-app/
├─ src/
│  ├─ types/          content.ts (curriculum schema) · progress.ts (learner data, schema v1)
│  ├─ lib/            pure logic, all unit-testable:
│  │   answers.ts       Unicode NFC + grapheme-aware answer matching (never naive indexing)
│  │   srs.ts           deterministic spaced repetition (0→1→3→7→14→30→60 days)
│  │   session.ts       seeded session builder: interleaving, requeue missed, review plan
│  │   translit.ts      local Roman→Telugu transliteration with candidates
│  │   storage.ts       IndexedDB wrapper + in-memory fallback, export/import/reset
│  │   gamify.ts        XP, streaks, badges (no lives, no leaderboards, no shame)
│  │   audio.ts         audio file → labelled speech-synthesis fallback
│  │   recorder.ts      record & compare (memory only, never uploaded)
│  │   speech.ts        SpeechRecognizer adapter (browser API, labelled experimental)
│  │   validate.ts      runtime content validation with dev-friendly errors
│  │   offline.ts       per-course audio downloads via the Cache API
│  │   progress-service.ts  orchestrates mastery/XP/streak/mistakes per attempt
│  ├─ content/        JSON curriculum (courses, concepts, lessons/, stories/) + loader
│  ├─ components/     exercise engine (ExerciseHost renders all 14 exercise types)
│  ├─ pages/          landing, onboarding, dashboard, course map, lesson player,
│  │                  review, mistakes, script practice, stories, settings, about
│  ├─ router.tsx      tiny hash router (no dependency)
│  └─ AppContext.tsx  settings + profile + XP/streak app state
├─ public/            sw.js (offline), manifest.webmanifest, icons/, audio/
├─ scripts/           validate-content.mjs (also imports CSV lesson drafts)
└─ tests/             39 unit tests (vitest)
```

Only runtime dependencies: `react`, `react-dom`. Everything else is
hand-written to keep the app small, auditable, and free.

### Content pipeline

Lessons are JSON files in [src/content/lessons/](src/content/lessons/) —
content is data, fully separated from presentation. Each lesson is
code-split, so learners only download the lessons they open. Every lesson has
a review `status` (`draft → needs-review → reviewed → published`). **All
current seed content is `draft`** because it was AI-generated and has not been
verified by a native speaker; the UI labels draft lessons and every lesson has
a "Report a language issue" link. Once content is reviewed, flip its status
and set the app default `showDraftContent` to `false` in
[src/types/progress.ts](src/types/progress.ts).

See [docs/CONTRIBUTING-CONTENT.md](docs/CONTRIBUTING-CONTENT.md) for the
non-programmer guide to adding lessons (including a spreadsheet/CSV workflow)
and recording audio.

The learning design is evidence-based and documented: sources and the exact
features they motivate are in [../docs/learning-science.md](../docs/learning-science.md)
(cited as D1/R1/H1 etc. in code comments), and the pre-transformation audit is
in [../docs/current-course-audit.md](../docs/current-course-audit.md).

### Progress & spaced repetition

Every concept a learner practices has a mastery record (0–100) and a review
interval that walks a fixed ladder: same-day → 1 → 3 → 7 → 14 → 30 → 60 days.
Correct answers move up the ladder; mistakes move down two steps and shrink
mastery; hints earn partial credit. It's fully deterministic — see
[src/lib/srs.ts](src/lib/srs.ts), which the About page explains to learners in
plain language. All of it is stored in IndexedDB under the `telugu-bata`
database; settings live in `localStorage` (`telugu-bata:*` keys). A schema
version is stored so future releases can migrate old data.

### Audio

Audio files are plain MP3s under `public/audio/<course>/<unit>/<slug>-normal.mp3`
(and optional `-slow.mp3`). None exist yet — until native-speaker recordings
land, the app falls back to the browser's speech synthesis, **clearly
labelled** as a placeholder ("synthetic voice"), or shows "recording coming
soon". Recording guidelines and the per-course `manifest.json` convention for
offline downloads are in [public/audio/README.md](public/audio/README.md).

### PWA / offline

`public/sw.js` is a hand-written service worker: network-first for pages,
cache-first for assets and audio, with an offline fallback page. Learners can
download a course's audio for offline use from Settings. Bump `CACHE_VERSION`
in sw.js when deploying breaking changes.

## Browser support

Modern evergreen browsers (Chrome/Edge/Firefox/Safari, last ~2 years).
Graceful degradation: no IndexedDB → in-memory session with a warning; no
`Intl.Segmenter` → manual Telugu grapheme fallback; no MediaRecorder → speaking
exercises still complete by listening; speech recognition is optional and
feature-detected.

## Known limitations

- All Telugu content is unreviewed AI-seeded **draft** — needs native review.
- No audio recordings yet (synthesis placeholder only).
- Placement is a short deterministic "Quick Skill Check" lesson, not adaptive.
- Transliteration input is a pragmatic RTS-style subset, not a full IME.
- Speech recognition depends on the browser; quality for Telugu varies widely.
