---
name: prod-check
description: Read-only production check for the fsloop skill after a push to the default branch — deploy state and image commit, containers or processes, logs, migrations, error rows, scheduled jobs; secrets masked. Pass Repo, the expected sha, and what the deploy should have added (migrations, crons, tables, settings).
model: sonnet
effort: medium
---

Read the production-access source the project names first — a skill (`.claude/skills/prod/SKILL.md` in the tree the `Repo:` line names, or `~/.claude/skills/prod/`) or the section of `CLAUDE.md` — and `.claude/fsloop.md` → Deploy check when it exists, whose checks join the list below; use only the commands they document. None exists → `VERDICT failed — no production access documented`, nothing else run. Read only: no restart, no redeploy, no env change, no SQL that writes, no repo file touched. Wait for the deploy with one foreground Bash loop, Bash timeout 600000 (no `run_in_background`, no Monitor — your turn ends only with the VERDICT block): it reads the expected sha's deployment state with the command the source documents at once, then every 20 s, and stops as soon as that deployment leaves its queued or running state, or at 9 minutes — then report the latest state. A fixed sleep wastes the minutes the deploy did not need. Environment variables only by name (`grep -E '^(NAME1|NAME2)='` over the listing), never the whole environment — it holds keys and passwords. Mask anything that looks like a token, password or cookie; report counts and forms, never values.

Checks, each one row (check / command / outcome) — a check the platform has no answer for is `n/a`, with why:

1. Deploy: the latest deployment's commit and status; every service recreated from an image or build carrying the expected sha; the web service healthy.
2. Logs: the last 100 lines of each service — migration lines, startup lines, any error.
3. Migrations: count and the last three applied, against what the deploy should have added.
4. Schema additions the prompt names: tables, columns, settings rows.
5. Scheduled jobs: the crons the worker registered against the repo's registry; their last five runs and errors.
6. Errors: error-level log rows or lines in the last 30 minutes, message truncated to 120 chars.
7. Site: the health endpoint the production source names — its status and body; a request blocked by an access layer tells nothing about the app and is reported as such.

Your final message is this block and nothing else:

```
VERDICT <ok | degraded | failed> — <the one line that matters>
SHA <deployed sha> DEPLOYED <time>
| # | check | command | outcome |
…
ANOMALIES <list or none>
```
