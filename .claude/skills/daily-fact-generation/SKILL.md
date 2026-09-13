---
name: daily-fact-generation
description: Generates the day's trivia facts (up to 3) for the Daily Trivia site — picks a topic via the category rotation, researches it, appends the facts to the central fact store, renders that day's static page, and advances the rotation state. Invoked once per morning by a scheduled Cowork task, with no other prompting.
---

# Daily Fact Generation

Produces one day's worth of content for Daily Trivia: up to three
researched trivia facts on a single topic — only the most well-known and
useful facts about it, nothing obscure — appended to the central fact
store and published as a static daily page. If fewer than three facts meet
that bar, publish fewer; never pad the count with weaker or more obscure
material just to reach three.

This skill is meant to be run **stand-alone**, with no extra instructions
from the invoker beyond "run the daily fact generation skill." Everything
it needs to decide what to do lives in the repo files it reads below.

## Repo files this skill reads and writes

| File | Read | Written |
|---|---|---|
| `_data/categories.md` | yes | no |
| `_data/rotation-state.md` | yes | overwritten in place |
| `assets/data/facts.jsonl` | yes (duplicate search) | appended |
| `daily/YYYY-MM-DD/index.md` | no | created |

This skill is self-contained: the steps below already restate everything
needed for a normal run, drawn from `docs/agent-reference-files.md` and
`docs/fact-store-schema.md`. **Do not open those docs during a run** — they
exist for humans maintaining this skill, not as required reading each
morning. If a step below ever seems to contradict the live repo state,
that's a signal this skill file is stale and needs a human to reconcile it
against those docs, not something to resolve by reading them mid-run.

## Context discipline

`assets/data/facts.jsonl` grows by up to 3 lines every day and has no upper
bound, so it is the one file in this skill that must never be read in full — doing
so wastes tokens today and will eventually blow the context window
outright. Every step below that touches it says exactly how to access it;
the rule behind all of them is:

- **Never** open/cat/read the whole file, and never pass it to a tool
  without a keyword filter or line-count bound.
- **Only** access it via a keyword search (grep/ripgrep for a specific
  category slug or candidate question/answer term) or a bounded tail read
  (the last N lines — records are always appended in date order, so recent
  history is always at the end).
- Keep N small. A handful of recent days (roughly the last 20-50 lines) is
  enough context for both the topic-repeat check and the same-day
  numbering check below — there is never a reason to pull more.

`_data/categories.md` and `_data/rotation-state.md` are small and
fixed/slow-growing by design (see their docs), so reading them in full is
fine and expected — this discipline applies specifically to
`assets/data/facts.jsonl`.

## Procedure

Run these steps in order. Do not skip or reorder them.

### 1. Pick today's topic

1. Read `_data/categories.md` and note the full ordered list of category
   slugs.
2. Read `_data/rotation-state.md` and note `last_category` and
   `last_run_date`.
3. The next category is the one immediately after `last_category` in the
   `categories.md` order, wrapping to the first category if `last_category`
   was the last one in the list. This is the day's category.
4. Within that category, choose a specific, concrete topic (e.g. category
   `space` → topic "Jupiter", not "space" itself). Prefer a topic distinct
   from ones already visible for this category recently. Check this with a
   **keyword grep** for the category's `topic` slug against
   `assets/data/facts.jsonl` (e.g. `grep '"topic": "space"' assets/data/facts.jsonl`),
   not a full-file read — see Context discipline above. If that turns up
   many matches, it's enough to skim the most recent few.

### 2. Research the topic

1. Perform web research on the chosen topic.
2. Decide whether the topic is **well-known** — something most readers
   could already place without help (e.g. Jupiter, the Great Wall,
   Shakespeare) — or **not well-known** — something most readers would not
   be able to say what it even is on sight (e.g. Mansa Musa, Point Nemo).
   When in doubt, treat it as not well-known: the grounding fact costs
   little and the failure mode of assuming too much prior knowledge is
   worse.
3. If the topic is **not well-known** (per step 2), the first fact is a
   **grounding/summary fact** rather than a "notable" one — see step 3
   below for how it's written. Select the rest as the most **well-known
   and useful** facts about the topic — the core, canonical things worth
   knowing about it, the kind of fact a reasonably informed person would
   recognize as genuinely important, not a specialist-only curiosity. This
   is a daily learning product, not a trivia-for-trivia's-sake quiz.
   - Favor facts that are significant, broadly useful to know, and
     well-established — the kind of thing worth knowing about the topic,
     not an obscure footnote. (For "Jupiter": that it's the largest planet
     in the solar system, or that its Great Red Spot is a giant storm, are
     the right altitude — important and recognizable, not obscure trivia
     dug up for its own sake.)
   - Reject candidates that are obscure, overly technical, or that only a
     specialist would know or care about, even if they're accurate and
     "interesting" in isolation.
   - Select **up to 3** facts total (the grounding fact, if any, counts
     toward this cap). If fewer than 3 candidates clear this bar for a
     given topic, use fewer — do not pad the count with weaker or more
     obscure material just to reach 3, and never exceed 3.
4. Before finalizing each candidate fact, check `assets/data/facts.jsonl` for
   similar `question`/`answer` text via a **keyword grep** on distinctive
   terms from the candidate (e.g. `grep -i "great red spot"
   assets/data/facts.jsonl`), not a full-file read — see Context discipline
   above. Swap out any candidate that's a near-duplicate of something
   already published. This is a best-effort check, not exhaustive
   deduplication — see Known Limitations below.

### 3. Write each fact

For each of the (up to 3) facts, write:

- A short **question** (the trivia prompt).
- A **one-word or one-name answer** — a single term, number, date, place,
  or proper name (e.g. `Mosaic`, `GET`, `NeXT`, `Ted Nelson`, `1965`), not
  a phrase or sentence. This matters for the quiz UI, where users
  type the answer in themselves — a short answer is quick to type and easy
  to judge as right/wrong. If the most interesting angle on a fact would
  naturally take a multi-word phrase to answer, reshape the *question* to
  ask for the single compact term at the heart of it instead (e.g. ask
  "What computer brand ran the whole early Web?" → `NeXT`, rather than
  asking for a whole sentence about the setup) — the depth still goes in
  the explanatory paragraph, not the answer field.
  Separately, avoid answers that are opaque catalog/technical
  designations (e.g. `PSR J1748-2446ad`, `GW170817`, `NGC 6121`) — these
  are unambiguous but unmemorable and give the reader nothing to hold
  onto. If the fact's hook is inherently tied to something like this,
  don't put the code itself in the answer field: pick the more
  meaningful, memorable term from the same fact instead — a number, a
  named process or concept, a place, or a proper name — and reshape the
  question to ask for that instead. Reserve designations like this for
  use *inside* the question text or explanation, never as the thing the
  reader has to type.
- An **explanatory paragraph** (3-6 sentences) that gives real context —
  this is where the interesting, non-obvious detail actually lives, since
  the question/answer pair itself is now deliberately terse. Assume the
  reader wants to actually learn something, not just check a fact.
- **Never leak the answer in the question — but only that fact's own
  answer.** A fact's question must not contain, verbatim, *that same
  fact's* answer term (e.g. don't ask "What jelly-like substance, a form
  of hyaluronan..." when the answer is `Hyaluronan`). Also watch for the
  softer version of this: a question phrased so its own words, recombined,
  spell out the answer even though the answer term itself never appears
  (e.g. asking "What sensation, caused by acid, do naked mole-rats not
  feel?" when the answer is `Acid pain` — a reader can assemble "acid" +
  "pain" straight from the question without knowing anything about the
  topic). Before finalizing each question, check whether someone who's
  never seen the answer could still produce it just by recombining words
  already sitting in that question; if so, rewrite the question around a
  different descriptive angle, cause, or mechanism detail instead of the
  answer's own components. This check applies to the grounding-fact
  question format below too, even though that format is intentionally
  definitional in style.
  - **This restriction is per-fact, not day-wide.** When the day's topic
    itself is the answer to one fact (typically fact 1, the grounding
    fact), only *that fact's* question needs to dance around the term.
    The other facts should refer to the topic by its normal name whenever
    that's the clearest wording — avoiding it there just because some
    other fact's answer happens to be the same term produces awkward,
    vaguer questions ("these moisture corridors," "these storms") for no
    benefit, since naming the topic doesn't leak an answer it isn't. Only
    avoid a term in a given fact's question when that term *is that
    fact's own answer*.
- **Every question must stand alone, with no pronoun or vague-article
  reference back to another fact.** Each of the day's facts is shown
  individually in the quiz UI (one card at a time, in random order,
  outside the context of the others), so a question can never lean on
  "this depression," "the mechanism," "the loom," "the novel," "the
  ship," "his," "its," or similar back-references that only resolve by
  having already read a different fact's question that day. Name the
  actual proper noun (the topic, a person, a place, a specific object)
  in every question that needs it, even if that means repeating the same
  name across every question for the day. This is different from the
  leaked-answer rule above: naming the day's topic is required here
  except in the one fact whose own answer *is* that name (typically the
  grounding fact) — there, write the question so it still identifies the
  topic uniquely through description, just without the term itself (see
  the leaked-answer rule and the grounding-fact format below). Before
  finalizing each question, reread it in isolation, as if it were the
  only fact on the page, and confirm a reader could tell exactly what
  it's about without having seen the others.

**If the topic was assessed as not well-known (step 2.2), fact 1 is a
grounding fact instead of a "well-known and useful" one:**

- Its **question** describes/identifies the topic itself (e.g. "What
  14th-century West African emperor was so fabulously wealthy his Cairo
  pilgrimage is said to have devalued gold in the region for years?" or
  "What's the name for the point in the ocean farthest from any land?"),
  written so it reads naturally as a definition or identifying
  description of the subject, not as a fact *about* the subject.
- Its **answer** is the topic itself, in the same short form used
  elsewhere on the site (e.g. `Mansa Musa`, `Point Nemo`).
- Its **explanatory paragraph** gives the basic orienting context (who/what
  it is, when/where, why it matters) that the rest of the day's facts will
  build on — this is the paragraph that makes the rest of the day's facts
  make sense to a reader who has never heard of the topic before.

This keeps every other fact that day free to go straight to the
well-known, useful material, while the reader is still grounded in what
the day's facts are actually about. Well-known topics skip this entirely —
all (up to 3) facts follow the normal well-known-and-useful format above.

### 4. Append to the fact store

1. Determine today's date `YYYY-MM-DD`.
2. Confirm no records already exist for today's date by checking a
   **bounded tail** of `assets/data/facts.jsonl` (e.g. the last 5-10 lines — new
   records are always appended in date order, so today's, if any, would be
   there), not a full-file read — see Context discipline above. This is
   normally empty, since this runs once per morning; if it isn't, continue
   numbering after the highest existing sequence number for today rather
   than restarting at 1.
3. Append one JSON line per fact (up to 3, never more; fewer if fewer
   candidates cleared the well-known-and-useful bar in step 2) to
   `assets/data/facts.jsonl`, with:
   - `id`: `YYYY-MM-DD-1` through `YYYY-MM-DD-N` (N being however many
     facts were produced, up to 3), or continuing the sequence per step 2.
   - `question`, `answer`, `topic` (today's category slug), `date_added`
     (`YYYY-MM-DD`).
4. Follow the existing file's exact JSONL conventions: one compact JSON
   object per line, UTF-8, no trailing commas, no blank lines, and the file
   still ends with a trailing newline after the append.
5. Do **not** rewrite or reformat any existing line in the file.

### 5. Render the day's static page

Create `daily/YYYY-MM-DD/index.md` (matching the URL contract
`/daily/YYYY-MM-DD/` from `docs/fact-store-schema.md`) using the real
Daily Learning Page template. The page is nothing but YAML front matter —
`layout: daily` (defined in `_layouts/daily.html`) renders the answer-first
reading-card view (question, answer, explanation, "add to my collection"
button) for each entry in `facts`, and gives each card `id="{fact id}"` so
the deep-link convention `/daily/{date}/#{id}` resolves correctly. No
content is needed below the front matter:

```markdown
---
layout: daily
title: "Daily Learning — {{ today's date, e.g. July 31, 2026 }}"
permalink: /daily/{{ YYYY-MM-DD }}/
date: {{ YYYY-MM-DD }}
topic: "{{ today's topic title, e.g. Jupiter }}"
facts:
  - id: "{{ fact 1 id }}"
    question: "{{ fact 1 question }}"
    answer: "{{ fact 1 answer }}"
    topic: {{ today's category slug }}
    explanation: >-
      {{ fact 1 explanatory paragraph }}
  - id: "{{ fact 2 id }}"
    question: "{{ fact 2 question }}"
    answer: "{{ fact 2 answer }}"
    topic: {{ today's category slug }}
    explanation: >-
      {{ fact 2 explanatory paragraph }}

  <!-- add a third entry only if a 3rd fact was produced (up to 3 total) -->
---
```

The top-level `date` and `topic` fields are not decorative — `_layouts/daily.html`
and the home page's journal listing both read them (`page.date`, `page.topic`),
so they must be set on every run, not just the `facts` list.

**`topic` is the bare topic title only — never append the category in
parentheses.** Write `topic: "Jupiter"`, not `topic: "Jupiter (space)"`. The
category already lives in each fact's own `topic` field inside `facts`
(the per-fact category slug, e.g. `space`) and on that category's own page
(`category/{{ slug }}/index.md`, see below) — repeating it in parentheses
on the page-level title is redundant and has slipped in before. If you're
ever unsure, check a recent entry under `daily/` first rather than
inventing a format.

### 6. Advance the rotation state

Overwrite `_data/rotation-state.md` (do not append — replace the existing
"Current state" values) so that:

- `last_category` is today's category slug.
- `last_run_date` is today's date (`YYYY-MM-DD`).

(Historical note for maintainers, not needed during a run: this overwrite
replaced an earlier append-only history-log design — see
`docs/agent-reference-files.md`.)

## Known limitations

These are explicitly out of scope for this skill and tracked as open
questions elsewhere (no need to chase them down during a run):

- **Duplicate avoidance** is a simple keyword search against
  `assets/data/facts.jsonl` (step 2.4) plus picking a topic distinct from
  category peers (step 1.4). There is no semantic similarity check or
  guaranteed non-duplication — a near-duplicate fact could still slip
  through.
- **Rotation algorithm** is strictly "next category in `categories.md`
  order, wrapping at the end" (step 1.3). It does not weight categories by
  how long it's been since each was used, skip categories, or otherwise
  balance beyond simple round-robin order.

## Failure behavior

If any step fails (research turns up nothing usable, a file is missing or
malformed, etc.), stop without partially appending to `assets/data/facts.jsonl`
or writing a partial day page — a half-written day is worse than a missed
one. There is no backfill mechanism for a missed day; that is handled (via
failure notification) by the scheduled-task wiring, not by this skill.
