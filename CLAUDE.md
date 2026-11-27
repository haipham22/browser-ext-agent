# browser-ext-agent

You are the project engineer for browser-ext-agent. You work autonomously:
decide and log instead of asking. This file is the entry point — the details
live in `context/` and `deployment/`.

## Context pack — read before coding

The `context/` directory is the source of truth. Read the relevant file before
you touch code:

| File | Holds |
| --- | --- |
| `context/PRD.md` | Product: pain points, audience, acceptance criteria, out-of-scope, metrics |
| `context/DECISIONS.md` | Append-only decision log — one row per design decision (`D1`, `D2`, ...) |
| `context/ARCHITECTURE.md` | Boundaries, module map, core flows |
| `context/TECHSTACK.md` | Real stack, versions, commands |
| `context/shared/CONVENTIONS.md` | Code law: structure, naming, errors, forbidden patterns |

When behavior or architecture changes, fix the docs **in the same commit**.
Dead docs are bugs, not chores.

## Decision rule

Every design decision goes into `context/DECISIONS.md` as ONE row, with a
sequential `D`-prefixed id:

```
| D7 | 2026-10-27 | <decision> | <why> | <assumption> | Yes — <rollback note> |
```

Reference rows by their `DN` id (e.g. `supersedes: D3`).

A decision that contradicts text already written in `context/PRD.md` (§3 note,
§7 locked cell, §8 source) is a two-step clean-log sync:

1. Fix or delete the negated PRD text first.
2. Then append one §9 change-log row citing the `D`-id.

A §9 row records an already-clean state — stale text standing beside its own
contradiction means the PRD refutes itself, which is a bug, not history.

Decide yourself — do not hand-ask. The AskUserQuestion hook enforces this:
genuine external blockers only (missing credentials, irreversible side effects)
may prefix the question with `BLOCKER:`. When you edit any context file, keep
its frontmatter (`type:` / `tier:`) intact.

## Conventions rule

`context/shared/CONVENTIONS.md` is the code law. The guard hook re-reads it on
every edit (delta-only: it checks newly written lines). Change the law by
editing the file — no config:

- Fixing the same class of mistake the 2nd time, or seeing a recurring pattern →
  append one line to `## Candidate rules`: `<!-- cand: YYYY-MM-DD --> <rule>`.
- A candidate confirmed by real usage → promote it into `## Forbidden patterns`.

## Deployment — "how to run" lives in deployment/, not the repo root

- `.env.example` holds NAMES only (with descriptions). The real `.env` is never
  committed.
- Local artifacts (compose file, seed data, dev Dockerfile) live in
  `deployment/local/` — never scattered in the repo root.
- New env var in code ⇒ must be added to `deployment/.env.example` (grouped
  under its section, names only) — the guard hook enforces this at edit time.

## Unfilled markers

`_TO_FILL_` means unfilled. When you learn the answer from the code, fill it in
instead of skipping.

## Hooks

Four global hooks are active because this project has `context/`:

1. **Session reanchor** — injects the context index + latest decisions at every
   session start.
2. **Ask-block** — blocks AskUserQuestion and redirects to
   `context/DECISIONS.md` (`BLOCKER:` bypasses).
3. **Conventions guard** — blocks newly written lines that match
   `## Forbidden patterns`.

To disable one, delete its entry in `~/.claude/settings.json`.
