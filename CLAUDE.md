# Daily Trivia

A Jekyll site (see `README.md` for what the product does). Notes here are
about working in this repo as an agent.

## Viewing the site while you work

This is a static Jekyll site with no dev server running by default — use
`bin/preview` to actually look at a page before calling a change done,
especially for CSS/layout work.

```
bin/preview start                 # bundle exec jekyll serve in the background on :4000
bin/preview shot / home.png       # screenshot a path (starts the server if needed)
bin/preview shot /daily/2026-08-02/ daily.png --mobile
bin/preview stop                  # stop the background server
```

- `shot` writes real Chromium screenshots via Playwright
  (`/opt/pw-browsers/chromium`), full page, at either desktop (1280x900) or
  `--mobile` (390x844) viewport. Read the resulting PNG with the Read tool
  to actually look at it — don't skip this for layout/CSS changes.
- The server binds `_config.yml`'s `baseurl` (`/daily-trivia`), matching how
  GitHub Pages serves the site, so what you see locally matches production
  — including whether internal links and asset paths resolve correctly.
- `bin/preview start` is idempotent; safe to call before every `shot`.

Gems live in `vendor/bundle` (gitignored) via `bundle config set path
'vendor/bundle' --local`. The `.claude/hooks/session-start.sh` SessionStart
hook runs `bundle install` automatically at the start of each web session,
so gems are ready before you need them.

## Content model

- Each day's trivia (up to 3 facts) lives at `daily/YYYY-MM-DD/index.md`,
  front matter only (`layout: daily`), rendered through `_layouts/daily.html`
  and `_includes/fact-card.html`. Give every daily page a `date:` field (used
  for sorting) and, ideally, a `topic:` field (used as the display title on
  the home page and daily header — falls back to "Today's trivia" if
  omitted).
- The home page (`index.md`) lists daily entries dynamically by scanning
  `site.pages` for URLs under `/daily/` — never hardcode a link to a
  specific day there.
- The central fact store, category rotation, and agent read/write
  contracts are documented in `README.md` and `docs/`.
