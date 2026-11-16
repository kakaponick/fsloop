# A craft report with one `AUDIT:` header per surface loses all but the last score

**Observed.** Run `00558d48`, stage `p1-verdict`, launch `p1-verdict-critic-craft-verdict` (16.11.2026). The critic scored three surfaces and wrote three lines, each opening with `AUDIT:`:

```
AUDIT: shell audit 16/20 Good · critique 30/40 · Method: …
AUDIT: findings audit 16/20 Good · critique 28/40 · Method: …
AUDIT: units audit 15/20 Good · critique 28/40 · Method: …
```

`run.json` → `surfaces` got `units` only. The second craft verdict of the same stage wrote `AUDIT:` once with three `- ` items under it, and all three were read.

**Evidence.** `reports/p1-verdict-critic-craft-verdict.md` in the run folder; `skills/fsloop/fsl.mjs:720` reads `block.AUDIT.value` and `block.AUDIT.items`, and `parseBlock` keeps one section per header name, so a repeated header replaces the one before it. `agents/fsloop-critic.md:49` gives the grammar as `AUDIT: <surface> audit <n>/20 <band> · critique <n>/<max> · <Method line>, one line per surface | —`, which reads as one `AUDIT:` line per surface. The run's goal was a score per surface, so two lost scores would have hidden two surfaces from the report.

**Proposal.** One of:
- `parseBlock` collects a repeated header's values into the section's items instead of replacing the section (covers AUDIT and any other header a critic repeats); a test in `fsl.test.mjs` with the three lines above;
- or `agents/fsloop-critic.md:49` shows the list form explicitly — `AUDIT:` then `- <surface> audit …` one per line — as it does for VERDICT and FINDINGS.

Both are small; the first also guards the reports already on disk.

**Cost.** The run spent one continuation of the critic (about 330k tokens of cached context read, 5 s) to re-emit the scores as a list, saved as `p1-verdict-critic-craft-verdict-c1`.
