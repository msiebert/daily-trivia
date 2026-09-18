# Rotation State

Tracks the agent's position in the category rotation defined by
[`categories.md`](categories.md), so each day's run picks the next category
in sequence rather than repeating or re-deriving it. See
[`docs/agent-reference-files.md`](../docs/agent-reference-files.md) for the
full read/write contract.

## Format

- A single current state, not a log — this file is **overwritten in place**
  each run, never appended to. It stays constant in size regardless of how
  long the app has been running.
- Two fields:
  - **last_category**: the category slug (matching a heading in
    `categories.md`) used for the most recent run.
  - **last_run_date**: the ISO 8601 date (`YYYY-MM-DD`) of that run.

## Current state

- **last_category**: mythology
- **last_run_date**: 2026-09-18
