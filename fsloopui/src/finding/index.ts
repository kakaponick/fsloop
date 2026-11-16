// The finding parts every view of a run shares (j12; the design check): the compact cells, the read-only finding
// row and its list that expands in place, the finding article, the words code builds for a finding, and
// `openFindings` — the one way a count elsewhere
// opens «Находки» filtered. «Юниты» (u5) and «Отчёты» (u6) import from here, never a copy.
export { FindingArticle, textSections, type FindingArticleProps } from "./article.tsx";
export { SeverityCell, severityState, StateCell, stateText, stateTextIn, stateUnit, VerdictCell } from "./cells.tsx";
export { ExpandingFindings, type ExpandingFindingsProps } from "./expanding.tsx";
export { countFindings, DONE_STATES, FACETS, FINDINGS_TABLE, FIX_STATES, MAJOR_UP, NONE, OWN, type FacetId, type FindingFilter } from "./facets.ts";
export { openFindings } from "./open.ts";
export { FindingRow } from "./row.tsx";
export * from "./words.ts";
