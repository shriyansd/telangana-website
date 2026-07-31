# Telugu Bata — stroke data workflow

The hand-authored stroke paths were wrong (a native reviewer confirmed all 51
letters were "off"). Correct stroke data now comes from a native writer, captured
by the tool in this folder. Three files matter:

| File | Who | What |
|---|---|---|
| `stroke-capture.html` | native writer | Writes each letter once; exports `captured-strokes.json` |
| `stroke-review.html` | native reviewer | Watches the *current* app strokes animate, to check them |
| `native-speaker-review.md` | native reviewer | Text checklist for letters + the 37 example sentences |

## To capture correct stroke data

1. **Send `stroke-capture.html` to a native Telugu writer.** It's a single
   self-contained file — they just double-click to open it in any browser
   (works offline; phone or tablet with a stylus/finger is ideal).
2. They write each of the 51 letters **on top of the faded guide**, the way
   they naturally write it by hand. Each pen motion = one stroke; strokes are
   recorded in the order and direction drawn. Progress saves in their browser,
   so they can stop and resume.
3. When every letter chip is green, they press **Export** → downloads
   `captured-strokes.json`. They send that file back.

## To apply it (developer)

```bash
# drop their file at review/captured-strokes.json, then:
cd learn-app
node scripts/apply-captured-strokes.mjs        # regenerates src/content/stroke-data.ts
npm test && npm run build                       # verify
node scripts/gen-stroke-review.mjs              # regenerate the review page to double-check
```

The importer simplifies the paths (Ramer–Douglas–Peucker), clamps to the
0–100 grid, and preserves letter order + concept mapping. It warns about any
letter left uncaptured. Because the capture canvas draws the guide glyph at the
exact size/baseline the app uses (72px, y=79 in a 100-box), the recorded
strokes overlay the app's faded guide with no extra alignment work.

## Regenerating the tools

Both HTML tools are generated from the live content, so re-run after content changes:

```bash
node scripts/gen-stroke-capture.mjs   # -> review/stroke-capture.html
node scripts/gen-stroke-review.mjs    # -> review/stroke-review.html + native-speaker-review.md
```
