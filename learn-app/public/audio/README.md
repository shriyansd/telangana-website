# Audio assets

Native-speaker recordings live here, organized by course/unit **id**:

```
audio/
  course-1/
    c1-u1/
      namaskaram-normal.mp3
      namaskaram-slow.mp3
      mee-peru-emiti-normal.mp3
      ...
    manifest.json        ← list of files, used for offline downloads
  stories/
    ramu-mango/
      line-1.mp3 ...
```

**The complete recording list — every file with the exact Telugu to say — is
generated at `docs/audio-checklist.md` (repo root). Regenerate any time with
`node scripts/audio-checklist.mjs`.**

Guidelines for contributors:

- **Format**: MP3 (128 kbps mono is plenty) or OGG. Keep files under ~100 KB where possible.
- **Naming**: `<phrase-slug>-normal.mp3` and optionally `<phrase-slug>-slow.mp3`.
  The slug matches the `audio.normal` path referenced in the lesson JSON.
- **Slow versions**: record genuinely slower speech, don't just stretch the audio.
- **Metadata**: add the speaker to `speakers.json` (id, region, review status) when contributing.
- **Review**: recordings are marked `draft` until a second native speaker approves them.

Until a recording exists, the app shows a labelled placeholder (and can use the
device's synthetic voice if the learner allows it). Run
`npm run validate-content` to list all audio files that lessons reference but
which are missing from this directory.
