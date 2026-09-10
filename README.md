# Spanish Vocab Trainer

A phone-friendly, offline-first spaced-repetition trainer built around the **5000
most frequent Spanish words** (Davies, *A Frequency Dictionary of Spanish*,
Routledge 2006) plus ~140 extra words from the book's thematic "word family" boxes.

- **Spaced repetition** — an SM-2 variant with two short learning steps, then
  expanding intervals. Each translation direction (ES→EN and EN→ES) is scheduled
  independently.
- **Commit-before-reveal** — in tap-to-reveal mode you pick *No idea / Shaky / I
  know it* **before** the answer shows, then grade yourself. Keeps self-grading
  honest without forcing typing.
- **Typed mode** — per-session toggle; accent-insensitive by default, accepts
  multiple glosses and drops leading "to "/"the ".
- **Production bias** — sessions lean ~65% toward EN→ES (the harder, more useful
  direction). A word is only archived once **both** directions clear the bar.
- **Mastery → archive** — interval ≥ 200 days, ≥ 6 clean reviews, no lapses.
  Tunable in Settings.
- **Manage the list** — search, per-word status dropdown, "✓know" to archive
  instantly, suspend to remove from rotation, bulk-add the next N words by
  frequency, add your own words (single or `hola = hello` bulk paste).
- **Leech detection**, undo, 14-day due forecast, streak, retention %, 30-day
  activity heatmap.
- **Backup** — JSON export/import in Settings (data lives only in your browser).

## Run locally

```bash
npm install
npm run extract   # regenerate public/words.json from the PDF (needs python3 + pypdf; optional, already committed)
npm run dev
```

## Deploy to GitHub Pages (free, installs on your phone)

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`; `.github/workflows/deploy.yml` builds and publishes.
   The workflow sets `BASE_PATH=/<repo>/` automatically for project sites.
4. Open `https://<you>.github.io/<repo>/` on your phone → Share → **Add to Home
   Screen**. It then works fully offline.

## Regenerating the word data

`scripts/extract.py` parses pages of the source PDF into `data/words.json`
(copied to `public/`). Pass the PDF path:

```bash
python3 scripts/extract.py "/path/to/A Frequency Dictionary of Spanish.pdf"
cp data/words.json public/words.json
```

The PDF itself is **not** committed (see `.gitignore`).

## Roadmap: grammar exercises

The scheduler (`src/lib/scheduler.ts`) is a pure `scheduleStep()` function and the
review queue is item-type agnostic, so grammar drills can reuse the same SRS:

- **Cloze from the example sentences** — every core word already ships an example
  Spanish sentence; blank the target word (or blank a conjugated verb / article /
  preposition) and check typed input.
- **Verb conjugation drills** — add a `conjugation` item type: prompt =
  infinitive + tense + person, answer = form. A small rules engine covers regular
  `-ar/-er/-ir` plus a table of the ~50 common irregulars (many already in the
  word list).
- **Ser vs estar / por vs para / preterite vs imperfect** — binary-choice items
  with explanation on reveal.
- **Gender & article agreement** — prompt a noun, answer `el/la/un/una` + plural.
- **Sentence ordering / drag-to-build** — later, richer UI.

Each becomes a new `kind` on the queue item with its own render + check function;
storage, scheduling, stats, and archive logic stay unchanged.

## Data model

`src/types.ts` — `Word` (with per-direction `DirState`), `ReviewLog`, `Settings`,
`DailyStat`. Everything is in IndexedDB via Dexie (`src/db.ts`).
