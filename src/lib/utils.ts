import { Classification, StatsMap } from "./types";

/**
 * Converts a title into a URL-safe slug
 * @param title The title to convert to a slug
 * @returns A URL-safe slug
 */
export function slugify(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-") // Replace any non-alphanumeric chars with dash
        .replace(/-+/g, "-") // Replace multiple dashes with single dash
        .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
}

/**
 * Checks if a value is a Classification type
 */
export function isClassification(obj: unknown): obj is Classification {
    return (
        typeof obj === "object" &&
        obj !== null &&
        "labels" in obj &&
        Array.isArray((obj as Classification).labels)
    );
}

/**
 * Checks if a value is a StatsMap type
 */
export function isStatsMap(obj: unknown): obj is StatsMap {
    return (
        typeof obj === "object" &&
        obj !== null &&
        Object.values(obj).every(
            (value) =>
                typeof value === "object" &&
                value !== null &&
                "count" in value &&
                typeof value.count === "number"
        )
    );
} 