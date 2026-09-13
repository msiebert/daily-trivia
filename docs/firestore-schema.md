# Per-User Firestore Schema

Each signed-in user's progress lives in exactly one Firestore document in
their own Firebase project — there is no shared or server-side database.
The document holds only fact ID references and timestamps; the fact
content itself always lives in [`assets/data/facts.jsonl`](../assets/data/facts.jsonl)
(see [`fact-store-schema.md`](fact-store-schema.md)) and is looked up by ID
when needed.

## Document location

```
users/{uid}
```

`{uid}` is the Firebase Auth UID of the signed-in Google account
(`user.uid` from the client SDK). The document is created automatically —
with the three fields below set to empty arrays — the first time a user
signs in (see `assets/js/auth.js`, `ensureUserDoc`).

## Fields

| Field            | Type  | Description |
|-------------------|-------|-------------|
| `collected`        | array | Facts the user has explicitly saved via the "add to my collection" button. |
| `recentlyMissed`    | array | Facts the user got wrong on a recent quiz. |
| `recentlyAdded`     | array | Facts added to `collected` recently and not yet quizzed, used to weight the quiz draw. |

Each array holds objects of the same shape:

```json
{ "id": "2026-07-31-1", "at": "2026-07-31T14:05:00.000Z" }
```

| Subfield  | Type    | Description |
|-----------|---------|-------------|
| `id`      | string  | A fact ID, matching `id` in `facts.jsonl` — see [`fact-store-schema.md`](fact-store-schema.md#id-format). No fact content (question/answer/topic) is ever duplicated into this document. |
| `at`      | string  | ISO 8601 timestamp of when this entry was first added to this list. Not updated when `removed` is toggled. |
| `removed` | boolean | `collected` only. A soft delete written by the "My Facts" management page's Forget button. Absent or `false` means the fact is active; `true` means the user forgot it. The entry is never deleted outright, so the same button can flip `removed` back to `false` to restore it without losing the original `at`. Consumers that treat `collected` as "the user's facts" (the quiz's question pool, the collected-count stat) filter out entries with `removed: true`. |

## Example document

```json
{
  "collected": [
    { "id": "2026-07-31-2", "at": "2026-07-31T14:05:00.000Z" }
  ],
  "recentlyMissed": [
    { "id": "2026-07-29-4", "at": "2026-08-01T09:12:30.000Z" }
  ],
  "recentlyAdded": [
    { "id": "2026-08-02-1", "at": "2026-08-02T07:00:00.000Z" }
  ]
}
```

## Who writes what

This ticket (MAR-10) only creates the document with empty arrays on first
sign-in. The read/write logic for each list is built elsewhere:

- `collected` — entries are added by the "add to my collection" button
  ([MAR-11](https://linear.app/mark-siebert/issue/MAR-11)); `removed` is
  toggled by the "My Facts" management page (`/my-facts/`), which also
  restores a previously-forgotten entry rather than adding a duplicate. See
  `assets/js/collected-facts.js` for the shared read/write helpers both use.
- `recentlyMissed` / `recentlyAdded` — written once per completed quiz,
  at grading time
  ([MAR-13](https://linear.app/mark-siebert/issue/MAR-13)).

## Access control

Only the authenticated owner (`request.auth.uid == uid`) may read or write
their own document. See [`firestore.rules`](../firestore.rules) and
[`firebase-setup.md`](firebase-setup.md#5-firestore-security-rules) for how
rules are deployed.
