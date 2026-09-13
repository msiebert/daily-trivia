# Fact Store Client (fetch/cache layer)

`assets/js/fact-store.js` is the client-side module the quiz uses to
read the central fact store (`assets/data/facts.jsonl`, see
[`fact-store-schema.md`](fact-store-schema.md)) in the browser. There is no
server-side component — it's a plain ES module that fetches a static file
and caches the result.

## Why the whole file, once

The store stays small (up to 3 records/day, each ~150 bytes of JSON), so
fetching it in full and caching client-side is cheaper than per-ID requests
against a static site with no query backend. At that rate that's well under
10 KB/year — even after 10 years of daily use the file is a few MB, well
within what a browser fetches and holds in memory or localStorage without
issue. If usage patterns ever push well past that (e.g. much higher daily
volume), the fetch-once approach would need revisiting, but nothing in the
current design points that way.

## Serving `assets/data/facts.jsonl` to the browser

The fact store lives under `assets/`, not Jekyll's conventional `_data/`
directory, specifically so it needs no special build configuration — see
[`fact-store-schema.md`](fact-store-schema.md#file-location) for why (in
short: a leading-underscore path's static-file inclusion is unreliable
across the different Jekyll versions running locally vs. on GitHub Pages'
production build, and `assets/` sidesteps that entirely). The client
module resolves the file's URL relative to its own (`import.meta.url`), so
it resolves correctly under the site's `baseurl` both locally
(`bin/preview`) and on GitHub Pages.

## Caching and invalidation

- The parsed store (an object keyed by fact `id`, plus the date it was
  fetched) is cached in `localStorage` under `daily-trivia:fact-store`, and
  mirrored in an in-memory variable for the lifetime of the page.
- Every call to `loadFactStore()` compares the cached `fetchedDate` to
  today's date (local, `YYYY-MM-DD`). A mismatch — the daily generation job
  has very likely run since the cache was written — triggers a re-fetch;
  otherwise the cached copy is reused with no network request.
- This is a simple daily TTL rather than a version marker: the store only
  ever changes once a day (the morning generation run), so "today" is
  precise enough and needs no extra round-trip to check a version file.
- Concurrent calls while a fetch is in flight share the same promise rather
  than issuing duplicate requests.
- If `localStorage` is unavailable (private browsing, quota exceeded), the
  module falls back to the in-memory cache for that page load — it just
  won't survive a reload.
- `loadFactStore()` and `getAllFacts()` both accept `{ forceRefresh: true }`
  to bypass the cache and fetch unconditionally. The quiz (`assets/js/quiz.js`)
  always passes this: a user can collect a fact and quiz themselves within
  the same day, and the daily TTL alone wouldn't notice the store changed
  intraday when the morning generation job ran after the cache was written.

## API

```js
import { loadFactStore, getFact, getAllFacts, explanationUrl } from "/assets/js/fact-store.js";

const fact = await getFact("2026-07-31-1");
// => { id, question, answer, topic, date_added, explanationUrl }

const allFacts = await getAllFacts();
// => every record currently in the store, for sampling quiz questions
```

`question`, `answer`, `topic`, and `date_added` come straight from the fact
store record. `explanationUrl` is derived, not stored (the fact store itself
has no `explanation` field — see
[the schema doc](fact-store-schema.md#linking-to-the-explanation)); it's the
deep link to that fact's full explanation on its daily page.
