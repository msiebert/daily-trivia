# Central Fact Store Schema

The central fact store is the single source of truth for all trivia facts in
Daily Trivia. It is a flat file committed to this repo — not a database — and is
written to by the daily generation agent (append-only) and read by the
quiz (full-file client-side cache, looked up by `id`).

## File location

```
assets/data/facts.jsonl
```

It lives under `assets/`, alongside `assets/css` and `assets/js`, rather
than in Jekyll's conventional `_data/` directory. `.jsonl` isn't one of
Jekyll's auto-loaded data formats anyway (`.yml`, `.yaml`, `.json`, `.csv`
are read automatically into `site.data`), so the `_data/` convention buys
nothing here — and worse, `_data/` is a leading-underscore directory that
Jekyll excludes from the built site by default. GitHub Pages' production
build (the `github-pages` gem, pinned to an older Jekyll than this repo's
own `Gemfile`) doesn't reliably honor an `include:` override to force an
excluded `_data/*` file back into the static output, even though a locally
installed newer Jekyll does — a real, previously-hit inconsistency between
local preview and production. A plain path under `assets/` sidesteps the
whole question: every Jekyll version copies it as an ordinary static file
with zero special config, which is what the quiz's client-side
fetch (`assets/js/fact-store.js`) actually needs.
`_data/categories.md` and `_data/rotation-state.md` stay in `_data/` — they
are only ever read/written by the daily generation agent, never fetched by
the browser, so the exclusion quirk doesn't apply to them.

## Format

- **JSONL (newline-delimited JSON)**: exactly one JSON object per line.
- UTF-8 encoding, no trailing commas within a line.
- The file always ends with a trailing newline after the last record.
- No blank lines between records.

JSONL is used instead of a single JSON array so the daily generation agent
can append a new day's facts by writing lines to the end of the file,
without parsing or re-serializing everything already there.

## Fields

| Field        | Type   | Required | Description |
|--------------|--------|----------|-------------|
| `id`         | string | yes      | Unique fact ID, format `YYYY-MM-DD-N` (see below). |
| `question`   | string | yes      | The trivia question text. |
| `answer`     | string | yes      | The short answer. |
| `topic`      | string | yes      | Category bucket, e.g. `history`, `science`, `geography`, `famous-people`. |
| `date_added` | string | yes      | ISO 8601 date (`YYYY-MM-DD`) the fact was added; matches the date portion of `id`. |

The full explanatory paragraph for each fact is **not** stored in the fact
store. It lives only on that day's rendered daily page, keeping this file
small enough for the quiz to fetch and cache in full on every visit.
See [Linking to the explanation](#linking-to-the-explanation) below for how
to find it from a fact record alone.

### `id` format

```
YYYY-MM-DD-N
```

- `YYYY-MM-DD` is the date the fact was added.
- `N` is a 1-based sequence number that **resets to 1 each day**.
- Example: the (up to three) facts added on 2026-07-31 are IDs
  `2026-07-31-1` through `2026-07-31-3`.

This format is chosen for human readability (the ID alone tells you when a
fact was learned) over maximal compactness.

## Linking to the explanation

Each fact's full explanatory paragraph is published on that day's daily
page, not stored in this file. The link to it is fully derivable from `id`
alone, so no URL field is stored:

- Daily pages live at `/daily/YYYY-MM-DD/`, where the date is the first 10
  characters of `id`.
- On that page, each fact is rendered under a heading with
  `id="{fact id}"`.
- The deep link to a specific fact's explanation is therefore:

  ```
  /daily/{date}/#{id}
  ```

  Example: fact `2026-07-31-1` → `/daily/2026-07-31/#2026-07-31-1`.

This convention must be followed by the daily page templates once they're
built (not yet part of this scaffold).

## Append workflow (for the daily generation agent)

1. Determine today's date, `YYYY-MM-DD`.
2. Read the existing file to find the highest existing sequence number `N`
   already used for today's date prefix (0 if none exist yet today —
   normally the case, since generation runs once per morning).
3. Append new records starting at `N + 1`, one JSON object per line, without
   modifying or re-serializing any existing lines.
4. Ensure the file still ends with a trailing newline after appending.

## Validation notes

- `id` values must be unique across the whole file and strictly increasing
  (no gaps, no duplicates) within a given date.
- There is currently no automated schema validation (e.g. a JSON Schema file
  or lint script) — this is a known gap, consistent with the product doc's
  list of open questions, and may be addressed in a future issue.

## Example record

```json
{"id": "2026-07-31-1", "question": "What is the largest planet in our solar system?", "answer": "Jupiter", "topic": "science", "date_added": "2026-07-31"}
```

Pretty-printed for readability:

```json
{
  "id": "2026-07-31-1",
  "question": "What is the largest planet in our solar system?",
  "answer": "Jupiter",
  "topic": "science",
  "date_added": "2026-07-31"
}
```

See [`assets/data/facts.jsonl`](../assets/data/facts.jsonl) for a full sample file with
example records.
