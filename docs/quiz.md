# Quiz

`quiz.md` (served at `/quiz/`) is a standalone page — assembled fresh
every time it's opened, not pre-baked at build time — that quizzes a
signed-in user on 25 facts drawn from the facts they've collected so far.
It's logically independent from the daily loop: it reads
[`assets/js/fact-store.js`](../assets/js/fact-store.js) (MAR-12) for fact
content and the user's [`users/{uid}` document](firestore-schema.md)
(MAR-10) for personalization, and writes back to that document once, at the
end.

All quiz logic lives in `assets/js/quiz.js`.

## Draw: weighted sample of 25

The eligible pool is **the facts in the user's `collected` list**
(`users/{uid}.collected`, cross-referenced against `getAllFacts()` from the
fact store for content) — facts the user hasn't explicitly saved via "Add to
my collection" never come up. Facts are drawn without replacement, weighted
so that facts the user recently missed or recently collected come up more
often, with the boost fading over time rather than facts being excluded
outright.

```
weight(fact) = BASE_WEIGHT
  + MISSED_BOOST * decay(daysSince(recentlyMissed[fact].at), MISSED_HALF_LIFE_DAYS)   // if present
  + ADDED_BOOST  * decay(daysSince(recentlyAdded[fact].at),  ADDED_HALF_LIFE_DAYS)    // if present

decay(days, halfLife) = 0.5 ** (days / halfLife)
```

This is a deliberately simple placeholder (per MAR-13: "exact weighting
formula is an open question"). All five constants sit at the top of
`quiz.js` for easy tuning; nothing else in the module depends on the exact
formula.

Sampling itself is weighted random sampling *without replacement*
(Efraimidis–Spirakis A-Res: key each item `random() ** (1/weight)`, take the
top N by key) rather than repeated weighted draws with rejection, so it's
O(n log n) and never loops. If the collected pool has fewer than 25 facts
(the common case, at least early on), the quiz simply uses the whole pool.
If nothing is collected yet, the page shows a prompt to collect facts
instead of a quiz (`renderEmptyState`).

## UI: prompt-first

One question at a time: the question shows immediately, the answer stays
hidden behind a "Reveal answer" action. This is the opposite of the daily
page's answer-first reading-card style. After revealing, the user
self-grades ("Got it" / "Missed it") — trivia answers are free-text, so
there's no reliable auto-grading — and that single tap both records the
grade and advances to the next question. No writes happen per question;
grades are only held in memory until the last question.

## Grading: once, at the end

After question 25, one Firestore read-modify-write updates both lists on
`users/{uid}`:

- **`recentlyMissed`**: entries for every fact ID quizzed this round are
  dropped (they're being re-evaluated), then fresh `{id, at: now}` entries
  are added back for whichever ones were just missed. A fact missed again
  gets its timestamp — and thus its draw-weight boost — refreshed; a fact
  that used to be missed but was just answered correctly simply falls out
  of the list.
- **`recentlyAdded`**: same drop-what-was-just-quizzed step (its "new fact"
  boost has served its purpose once it's been quizzed), then any fact in
  `collected` that isn't already tracked in `recentlyMissed` or
  `recentlyAdded` is added with `at: now`. This is what gives newly
  collected facts a temporary boost in the draw until they've come up in a
  quiz at least once.

Both lists are read fresh (`getDoc`) immediately before this write to avoid
clobbering a concurrent change from the collection button.

## Completion side effects

On successful grading:

- `localStorage["daily-trivia:quiz:completed:<YYYY-MM-DD>"]` is set to the
  completion ISO timestamp, keyed by local calendar date. This is the
  checkmark MAR-15 reads to know today's quiz is done.
- A `daily-trivia:quiz-completed` `CustomEvent` is dispatched on `window`
  with `detail: { date, total, correct, missed }`, for MAR-15's
  gamification stats update to listen for. No stats logic lives here yet —
  this is just the hook.

That hook is consumed by `assets/js/stats.js` (MAR-15): it listens for
`daily-trivia:quiz-completed` on `window` — loaded on every page via
`_layouts/default.html`, not just `/quiz/`, so the completion is
captured wherever the event fires — and appends `{date, total, correct}`
to a bounded history under the `daily-trivia:stats:v1` localStorage key.
Any element with `data-stats-root` (currently the home page) renders the
checkmark (read from `daily-trivia:quiz:completed:<date>`), a streak
count, and a small accuracy-trend sparkline computed from that history.
Streak is computed by walking back from today (or yesterday, so a streak
stays alive while today's quiz is still pending) counting consecutive
completed calendar days — a skipped day breaks the chain, per normal
streak logic — rather than being stored as a mutable counter, so it can't
go stale.

## Auth

The quiz requires a signed-in user (the draw and grading both need
`users/{uid}`). If nobody's signed in when the page loads, it shows a
sign-in prompt in place of the quiz instead of auto-launching the Google
popup.
