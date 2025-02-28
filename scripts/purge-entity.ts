import { storage } from "@/lib/storage";
import { CLASSIFICATIONS_PATH, STATS_PATH } from "@/app/constants";
import { StatsMap, JsonValue } from "@/lib/types";
import chalk from "chalk";
import { createInterface } from "readline/promises";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper to make console output more readable
const log = {
    info: (msg: string) => console.log(chalk.blue(msg)),
    success: (msg: string) => console.log(chalk.green(`✅ ${msg}`)),
    error: (msg: string) => console.log(chalk.red(`❌ ${msg}`)),
    warning: (msg: string) => console.log(chalk.yellow(`⚠️ ${msg}`)),
    title: (msg: string) => console.log(chalk.bold.cyan(`\n${msg}\n${'-'.repeat(msg.length)}`))
};

// Function to ask a question and get user input
async function prompt(question: string): Promise<string> {
    return await rl.question(chalk.yellow(question));
}

// Function to confirm an action
async function confirm(question: string): Promise<boolean> {
    const answer = await prompt(`${question} (y/n): `);
    return answer.toLowerCase() === 'y';
}

// Type guard for StatsMap
function isStatsMap(obj: unknown): obj is StatsMap {
    if (typeof obj !== "object" || obj === null) return false;

    // Check if it has the expected structure
    for (const key in obj) {
        const value = (obj as Record<string, any>)[key];
        if (typeof value !== "object" || value === null) return false;
        if (typeof value.title !== "string") return false;
        if (typeof value.views !== "number") return false;
    }

    return true;
}

// Function to search for entities by name
async function searchEntities(query: string): Promise<{ slug: string, title: string }[]> {
    try {
        // Get stats to find all entities
        const stats = await storage.get<StatsMap>(STATS_PATH);
        if (!stats || !isStatsMap(stats)) {
            log.error("Failed to load stats data");
            return [];
        }

        // Filter entities by query
        const matches = Object.entries(stats)
            .filter(([_, data]) =>
                data.title.toLowerCase().includes(query.toLowerCase()))
            .map(([slug, data]) => ({
                slug,
                title: data.title
            }));

        return matches;
    } catch (error) {
        log.error(`Error searching entities: ${error}`);
        return [];
    }
}

// Function to list all classifications
async function listAllEntities(): Promise<{ slug: string, title: string }[]> {
    try {
        // Get stats to find all entities
        const stats = await storage.get<StatsMap>(STATS_PATH);
        if (!stats || !isStatsMap(stats)) {
            log.error("Failed to load stats data");
            return [];
        }

        // Return all entities sorted by title
        return Object.entries(stats)
            .map(([slug, data]) => ({
                slug,
                title: data.title
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    } catch (error) {
        log.error(`Error listing entities: ${error}`);
        return [];
    }
}

// Function to purge an entity completely
async function purgeEntity(slug: string, title: string): Promise<boolean> {
    try {
        log.info(`Purging entity: ${title} (${slug})`);

        // 1. Mark classification as deleted if it exists
        const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;
        try {
            await storage.delete(classificationPath);
            log.success(`Marked classification as deleted for ${title}`);
        } catch (error) {
            log.warning(`Error marking classification as deleted for ${title}: ${error}`);
        }

        // 2. Remove from stats
        const stats = await storage.get<StatsMap>(STATS_PATH);
        if (stats && isStatsMap(stats) && stats[slug]) {
            delete stats[slug];
            await storage.put(STATS_PATH, stats);
            log.success(`Removed ${title} from stats`);
        } else {
            log.warning(`${title} not found in stats`);
        }

        // 3. Check for label stats and remove entity
        const LABEL_STATS_PATH = "stats/v1/labels.json";
        try {
            const labelStats = await storage.get<Record<string, { entities: string[] }>>(LABEL_STATS_PATH);
            if (labelStats) {
                let modified = false;

                // Remove entity from all label entities lists
                for (const label in labelStats) {
                    if (labelStats[label]?.entities?.includes(title)) {
                        labelStats[label].entities = labelStats[label].entities.filter((e: string) => e !== title);
                        modified = true;
                    }
                }

                if (modified) {
                    await storage.put(LABEL_STATS_PATH, labelStats);
                    log.success(`Removed ${title} from label statistics`);
                }
            }
        } catch (error) {
            // If the file doesn't exist, that's fine
            if (String(error).includes("Blob not found")) {
                log.info("No label statistics file found, skipping this step");
            } else {
                log.warning(`Could not update label stats: ${error}`);
            }
        }

        log.success(`Entity ${title} has been completely purged from the system`);
        return true;
    } catch (error) {
        log.error(`Failed to purge entity ${title}: ${error}`);
        return false;
    }
}

// Main function
async function main() {
    try {
        log.title("ENTITY PURGE TOOL");
        log.info("This tool will completely remove entities from the graph");

        while (true) {
            log.title("MENU");
            console.log("1. Search for entities");
            console.log("2. List all entities");
            console.log("3. Purge entity by slug");
            console.log("4. Exit");

            const choice = await prompt("\nSelect an option (1-4): ");

            if (choice === "1") {
                // Search for entities
                const query = await prompt("Enter search term: ");
                const results = await searchEntities(query);

                if (results.length === 0) {
                    log.warning("No entities found matching your search");
                    continue;
                }

                log.title(`SEARCH RESULTS (${results.length} found)`);
                results.forEach((entity, index) => {
                    console.log(`${index + 1}. ${entity.title} (${entity.slug})`);
                });

                const selectIndex = await prompt("\nSelect entity to purge (number) or 'c' to cancel: ");
                if (selectIndex.toLowerCase() === 'c') continue;

                const index = parseInt(selectIndex) - 1;
                if (isNaN(index) || index < 0 || index >= results.length) {
                    log.error("Invalid selection");
                    continue;
                }

                const entity = results[index];
                if (await confirm(`Are you SURE you want to purge ${entity.title}?`)) {
                    await purgeEntity(entity.slug, entity.title);
                }
            }
            else if (choice === "2") {
                // List all entities
                const entities = await listAllEntities();

                if (entities.length === 0) {
                    log.warning("No entities found");
                    continue;
                }

                log.title(`ALL ENTITIES (${entities.length} total)`);

                // Display entities in pages
                const pageSize = 20;
                let currentPage = 0;
                const totalPages = Math.ceil(entities.length / pageSize);

                while (true) {
                    const start = currentPage * pageSize;
                    const end = Math.min(start + pageSize, entities.length);
                    const pageEntities = entities.slice(start, end);

                    console.log(`\nPage ${currentPage + 1} of ${totalPages}\n`);
                    pageEntities.forEach((entity, index) => {
                        console.log(`${start + index + 1}. ${entity.title} (${entity.slug})`);
                    });

                    const nav = await prompt("\nEnter entity number to purge, 'n' for next page, 'p' for previous page, or 'c' to cancel: ");

                    if (nav.toLowerCase() === 'c') break;
                    if (nav.toLowerCase() === 'n' && currentPage < totalPages - 1) {
                        currentPage++;
                        continue;
                    }
                    if (nav.toLowerCase() === 'p' && currentPage > 0) {
                        currentPage--;
                        continue;
                    }

                    const index = parseInt(nav) - 1;
                    if (isNaN(index) || index < 0 || index >= entities.length) {
                        log.error("Invalid selection");
                        continue;
                    }

                    const entity = entities[index];
                    if (await confirm(`Are you SURE you want to purge ${entity.title}?`)) {
                        await purgeEntity(entity.slug, entity.title);
                        break;
                    }
                }
            }
            else if (choice === "3") {
                // Purge by slug
                const slug = await prompt("Enter entity slug: ");

                // Get entity title from stats
                const stats = await storage.get<StatsMap>(STATS_PATH);
                if (!stats || !isStatsMap(stats) || !stats[slug]) {
                    log.error(`No entity found with slug: ${slug}`);
                    continue;
                }

                const title = stats[slug].title;
                if (await confirm(`Are you SURE you want to purge ${title}?`)) {
                    await purgeEntity(slug, title);
                }
            }
            else if (choice === "4") {
                break;
            }
            else {
                log.error("Invalid option");
            }
        }
    } catch (error) {
        log.error(`An error occurred: ${error}`);
    } finally {
        rl.close();
        log.info("Goodbye!");
    }
}

// Run the script
main(); 