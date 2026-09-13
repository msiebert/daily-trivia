# Daily Trivia

A personal daily-learning and trivia app: each morning, up to three new
facts are generated and added to a central fact store; a quiz draws from
the facts you've collected so far.

This repo is the Jekyll/GitHub Pages site and its data. There is no backend
database — content lives in this repo as flat data files, and per-user
progress lives in each user's own Firebase project.

## Central fact store

The fact store is `assets/data/facts.jsonl`, an append-only, newline-delimited
JSON file of trivia facts. See
[`docs/fact-store-schema.md`](docs/fact-store-schema.md) for the full format
specification. The quiz reads it in the browser via
`assets/js/fact-store.js`, a client-side fetch-and-cache module — see
[`docs/fact-store-client.md`](docs/fact-store-client.md).

## Agent reference data

The daily generation agent also reads and writes two small markdown
reference files, `_data/categories.md` and `_data/rotation-state.md`, to
rotate through varied topics without repeating recent subject matter (it
also keyword-searches `assets/data/facts.jsonl` directly to avoid near-duplicate
questions). See
[`docs/agent-reference-files.md`](docs/agent-reference-files.md) for the
full read/write contract.

## Sign-in and per-user progress

Google sign-in and per-user progress (collected facts, quiz history) run
entirely against each user's own Firebase project — see
[`docs/firebase-setup.md`](docs/firebase-setup.md) for the setup
walkthrough and [`docs/firestore-schema.md`](docs/firestore-schema.md) for
the Firestore document shape. Security rules live in
[`firestore.rules`](firestore.rules).
