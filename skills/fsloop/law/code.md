# Code Law

fsloop's base law for every change a run makes or judges, server and client; precedence — `law/ui.md` → Precedence. The project's code rules (`common.md` names them) name what each role is in this repo — the queue, the scheduler, the secret store, the logger, the settings. A rule whose subject the project does not have (no background work, no secrets) does not apply. Cite a rule by its name: `code` → Idempotent.

- **Work state lives in the database.** Background work and the resources it holds — a queue, a lease — are tables: a lease has a TTL and a heartbeat, an expired one returns to the queue; process memory holds nothing, a restart loses nothing.
- **An executor is a pure function over its job.** Everything comes in as arguments — no request, session or framework context inside; its test calls it directly.
- **Idempotent.** Every operation with an outside effect carries an idempotency key per unit of work and step; a replay after a cut produces no second effect — no second record created, no message sent twice.
- **A dry run walks the whole path.** Where the project has a dry or fake transport for an external system, every new external method gets its answer there at once, and the dry run passes every step of the feature.
- **Scheduled work goes through one registry.** A recurring job is registered where the project keeps its schedule, never started ad hoc; the catalogs a new job or job kind must join are the ones the guards name.
- **Authorization at the boundary.** Permission is checked where a request enters — server actions, data loaders, route handlers; services and the data layer do not know it — workers and schedulers call them.
- **A mutating action fails loudly.** It catches to log and rethrows; every catch and every fire-and-forget either records or handles. The critical nodes the project lists are always logged, and every log line goes through its redaction.
- **Secrets stay in the secret store.** A decrypted value never reaches a log, a response or an error text.
- **Reading paths degrade.** A datastore that is down reads as «no data», not a throw.
- **Settings, not constants.** What an operator meaningfully changes lives in the product's settings with its default in code; the environment holds only what is needed before settings can be read.
- **i18n.** In a localised product every visible string is a key in every message catalog, with the plural forms each language needs; stored enums and React keys are language-neutral ids; brands, URLs and log lines are not translated.
- **No duplication.** Find what exists first — reuse it or extract it; a second copy of a rule, a query or a component is a defect.
