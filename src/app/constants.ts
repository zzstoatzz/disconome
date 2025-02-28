export const MAX_VISIBLE_NODES = 32;
export const MAX_VISIBLE_LABELS = 13;
export const MIN_TRENDING_LABELS = 3;  // Ensure we keep at least 3 trending labels
export const MAX_VISIBLE_SUGGESTIONS = 10;
export const STATS_PATH = "stats/v1/views.json";
export const CLASSIFICATIONS_PATH = "classifications/v3/"; // Incremented to v3
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const PORTAL_BLUE = "40, 90, 255";
export const MAX_SPARKS = 50;
export const MAX_TRAIL_LENGTH = 5;

// Ignore lists
export const IGNORED_LABELS = new Set(["Innovation", "Innovations"]);
export const IGNORED_PAGES = new Set([]); // Empty for now, ready for future
