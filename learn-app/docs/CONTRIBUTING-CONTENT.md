# Contributing lessons, translations & audio — no programming required

Telugu Bata gets better every time a native Telugu speaker reviews a sentence
or records a phrase. This guide shows three ways to help, from easiest to
most involved. You never need to touch program code.

---

## 1. Review existing content (easiest, most valuable)

All current lessons were AI-seeded and are marked **draft** in the app. A
native speaker confirming or correcting them is the single most useful
contribution.

1. Open the app and go through a lesson.
2. If anything sounds unnatural, wrong, or too formal/informal, tap
   **"Report a language issue"** at the bottom of the lesson — it opens an
   email pre-filled with the lesson and exercise IDs. Describe what should
   change and (if you can) what a native speaker would actually say.
3. That's it. A maintainer applies the fix and credits you as reviewer.

When a lesson has been fully checked, a maintainer changes its `status` from
`"draft"` to `"reviewed"` and records the reviewer's name in the lesson file.

## 2. Write new lessons in a spreadsheet (CSV)

You can author a whole lesson in Google Sheets or Excel — one row per
exercise — and a maintainer imports it.

Make a sheet with these column headers (order matters):

| Column | What to put there | Example |
|---|---|---|
| courseId | which course | `course-1` |
| unitId | which unit | `c1-u1` |
| lessonId | new lesson id | `c1-u1-l5` |
| lessonTitle | lesson name | `At the Market` |
| exerciseId | unique per exercise | `c1-u1-l5-e1` |
| exerciseType | see list below | `multiple_choice` |
| conceptIds | words/ideas taught, comma-separated | `word-mango` |
| telugu | the Telugu text | `మామిడిపండు` |
| transliteration | pronunciation in Latin letters | `māmiḍipaṇḍu` |
| english | the meaning | `mango` |
| acceptedAnswers | correct answers, separated by `\|` | `mango\|a mango` |
| incorrectChoices | wrong options, separated by `\|` | `banana\|apple` |
| audioFile | leave blank until recorded | |
| feedback | one line explaining the answer | `పండు = fruit` |

Common `exerciseType` values: `multiple_choice`, `listen_select`,
`fill_blank`, `translate`, `word_tiles`, `dictation`, `match_pairs`.

Export the sheet as **CSV** and email it (or open a pull request putting it
anywhere in the repo). A maintainer runs:

```bash
node scripts/validate-content.mjs --csv path/to/your-lesson.csv
```

which converts it into draft lesson JSON (in `scripts/imported/`) and reports
any problems (duplicate IDs, a question with no correct answer, etc.). New
lessons always enter as **draft** until a native speaker reviews them.

## 3. Record audio (native speakers)

The app currently uses a clearly-labelled synthetic voice as a placeholder.
Real recordings replace it automatically — no code changes.

Full recording guidelines (equipment, naming, normal vs. slow versions, where
files go) are in [`public/audio/README.md`](../public/audio/README.md). The
short version:

- Record MP3, quiet room, phone mic is fine.
- One file per phrase: say it once, naturally, at normal speed. Optionally a
  second file spoken slowly and clearly.
- Name files after the phrase slug used in the lesson:
  `namaskaram-normal.mp3`, `namaskaram-slow.mp3`.
- Files live at `learn-app/public/audio/<course>/<unit>/`.
- Run `npm run validate-content` to see the current list of missing audio
  files — it prints every phrase still waiting for a voice.

## For maintainers: the lesson JSON itself

Lessons are single JSON files in `learn-app/src/content/lessons/`. The
easiest way to write one is to copy an existing lesson and edit it. The full
schema (with comments) is `learn-app/src/types/content.ts`. Rules enforced by
`npm run validate-content` and by the app in dev mode:

- every lesson/exercise/concept ID unique
- every choice question has exactly the marked correct answer(s) present
- `acceptedAnswers` must be non-empty for typed answers (matching is
  normalized — never add trivial case/punctuation variants)
- published lessons must name a `reviewedBy`
- concepts referenced by exercises must exist in `concepts.json`

Review states: `draft` → `needs-review` → `reviewed` → `published`
(plus `archived`). AI-assisted content **must** start as `draft`.
