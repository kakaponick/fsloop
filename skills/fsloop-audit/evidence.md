# Evidence bar

Read everything; write only in the audit folder. Report in Russian, answer first, in one or two sentences; save the report as `<audit folder>/<track>.md` and return the same text.

- **Tag** every conclusion MEASURED (counted from run records, transcripts or code) or INFERRED (reasoned from them).
- **Denominator**: a number carries its denominator, its run set and, for code, its sha.
- **Overlap**: recoverable time is an upper bound plus a realistic value, with what it overlaps. Estimates stay separate; a total of them means nothing.
- **Units**: clock hours and agent-hours differ. Summed launch seconds are agent-hours.
- **Run state** comes from `runs.json`. A run not closed is partial, and rework in it is understated.
- **Stands**: an issue is a defect once you have read the code at the sha, with its status: `stands`, `fixed <sha>`, `wrong` (why) or `unconfirmed`. Give `file:line`, the condition that triggers it and what the user or the system sees. Rate severity by consequence and likelihood, and say the rating is yours.
- **Whole population**: read all of it. A sample states how it was drawn and what stayed unread.
- **Counter-evidence** goes in the report as plainly as the finding. If a pile is mostly noise, say so.
- **Gaps**: close with what the data cannot show, then the absolute paths of the files you read and wrote. End on at most one line about where the evidence points; proposals are the orchestrator's.
