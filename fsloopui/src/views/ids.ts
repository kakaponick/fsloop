// The ids of a run's views, apart from the registry and its components: the URL helpers (app/routes.ts) read them
// without loading a view, so no load-time cycle runs through a view's imports (code-4).
export const VIEW_IDS = ["findings", "units", "reports", "conventions", "journal"] as const;
export type ViewId = (typeof VIEW_IDS)[number];
export const DEFAULT_VIEW: ViewId = "findings";
