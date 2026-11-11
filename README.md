# ashby-location-filter

A prototype location filter for a job board. It reads a saved snapshot of a
public Ashby job board feed and groups each posting's locations by the address
country the feed records, so selecting a country finds postings in its cities
as well as postings that name the country itself.

- `docs/index.html` is the whole page. It computes every count in the browser
  from `docs/snapshot.json`.
- `docs/snapshot.json` is written by `tools/publish_snapshot.py`. The posting
  fields it may contain are listed in `tools/publish_snapshot.yaml`; any other
  field is held back and logged.

Rebuild the snapshot from a saved feed:

```sh
.venv/bin/python -m tools.publish_snapshot path/to/feed.json
```

Preview the page:

```sh
python3 -m http.server --directory docs
```

## Workspace

An agent-safe workspace: humans and AI coding agents share this repository.
The rules of engagement
live in `AGENTS.md` — and they are **enforced by git hooks**, not merely
written down.

## Guardrails
- The pre-push hook refuses a dirty working tree — including untracked
  files — (and, for Python, a red test suite).
- `main` is the source of truth: work on branches, open PRs; never commit
  to `main` directly.

## Getting started
- **Fresh clone? Hooks do NOT clone.** Run this once per clone or the
  guardrails above are silently absent:
  `git config core.hooksPath .githooks`
- Python: open a new terminal and run `source .venv/bin/activate`.
- Copy `.env.example` to `.env` and set your keys. If you run more than
  one agent, give each process its own `AGENT_ID` (export it in that
  agent's environment — one shared `.env` can only hold one value).

## License
Add a LICENSE file of your choice (MIT is a common, permissive default).
