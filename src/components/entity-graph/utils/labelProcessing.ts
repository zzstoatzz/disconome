import { Node, Label } from '../types';
import { IGNORED_LABELS, IGNORED_PAGES, MAX_VISIBLE_LABELS } from "@/app/constants";

// Process and categorize labels from nodes
export const processUniqueLabels = (
    nodes: Node[],
    trendingTopics: Label[]
): Label[] => {
    const labelCounts = new Map<string, {
        count: number;
        nodeCount: number;
        source: 'trending' | 'ai';
        hasNodes: boolean; // Track if label has associated nodes
        isHistorical?: boolean; // Flag for historical trending topics
    }>();

    // First add trending topics
    trendingTopics.forEach(topic => {
        labelCounts.set(topic.name, {
            count: 1,
            nodeCount: 0, // Start with 0 node count for trending topics
            source: 'trending',
            hasNodes: false, // Will be updated when processing nodes
            isHistorical: false // Current trending topics are not historical
        });
    });

    // Then add node labels, preserving trending source if it exists
    nodes
        .filter(node => !IGNORED_PAGES.has(node.title as never))
        .forEach((node) => {
            (node.labels || [])
                .filter(label => !IGNORED_LABELS.has(label.name))
                .forEach((label) => {
                    const current = labelCounts.get(label.name);
                    if (current) {
                        labelCounts.set(label.name, {
                            count: current.count + (node.count || 0),
                            nodeCount: current.nodeCount + 1,
                            source: current.source === 'trending' ? 'trending' : label.source,
                            hasNodes: true, // This label has associated nodes
                            // If it's a trending topic with nodes but not in current trending topics,
                            // mark it as historical
                            isHistorical: current.source === 'trending' &&
                                !trendingTopics.some(t => t.name === label.name)
                        });
                    } else {
                        labelCounts.set(label.name, {
                            count: node.count || 0,
                            nodeCount: 1,
                            source: label.source,
                            hasNodes: true,
                            isHistorical: false
                        });
                    }
                });
        });

    // Get all labels that meet our criteria
    const allLabels = Array.from(labelCounts.entries())
        .filter(([, stats]) => {
            // Keep trending topics that are current
            if (stats.source === 'trending' && !stats.isHistorical) return true;
            // Keep historical trending topics only if they have nodes
            if (stats.source === 'trending' && stats.isHistorical) return stats.hasNodes;
            // Keep AI topics with at least 2 nodes
            return stats.nodeCount >= 2;
        })
        .sort((a, b) => b[1].count - a[1].count);

    return distributeLabelsByCategory(allLabels);
};

// Distribute labels by category with priority and limits
const distributeLabelsByCategory = (
    allLabels: Array<[string, {
        count: number;
        nodeCount: number;
        source: 'trending' | 'ai';
        hasNodes: boolean;
        isHistorical?: boolean;
    }]>
): Label[] => {
    // Filter labels by category
    const currentTrendingCandidates = allLabels
        .filter(([, stats]) => stats.source === 'trending' && !stats.isHistorical);

    const historicalTrendingCandidates = allLabels
        .filter(([, stats]) => stats.source === 'trending' && stats.isHistorical && stats.hasNodes);

    const aiCandidates = allLabels
        .filter(([, stats]) => stats.source === 'ai');

    // Take all current trending labels first (up to a reasonable limit)
    const maxCurrentTrending = Math.min(currentTrendingCandidates.length, 5);

    // Take all historical trending labels with nodes
    const maxHistoricalTrending = historicalTrendingCandidates.length;

    // Calculate how many AI labels we can include
    const remainingForAi = MAX_VISIBLE_LABELS - maxCurrentTrending - maxHistoricalTrending;
    const maxAiLabels = Math.max(0, remainingForAi);

    // If we don't have enough labels total, adjust the AI count
    const finalAiCount = Math.min(aiCandidates.length, maxAiLabels);

    // Create the final label arrays
    const currentTrendingLabels = currentTrendingCandidates
        .slice(0, maxCurrentTrending)
        .map(([name]) => ({
            name,
            source: 'trending' as const,
            isHistorical: false
        }));

    const historicalTrendingLabels = historicalTrendingCandidates
        .slice(0, maxHistoricalTrending)
        .map(([name]) => ({
            name,
            source: 'trending' as const,
            isHistorical: true
        }));

    let aiLabels = aiCandidates
        .slice(0, finalAiCount)
        .map(([name]) => ({
            name,
            source: 'ai' as const,
            isHistorical: false
        }));

    // Check if we need to add more labels to reach MAX_VISIBLE_LABELS
    let allLabelsArray = [...currentTrendingLabels, ...historicalTrendingLabels, ...aiLabels];

    // If we have fewer than MAX_VISIBLE_LABELS, add more AI labels if available
    if (allLabelsArray.length < MAX_VISIBLE_LABELS && aiCandidates.length > finalAiCount) {
        const additionalAiNeeded = MAX_VISIBLE_LABELS - allLabelsArray.length;
        const additionalAiAvailable = aiCandidates.length - finalAiCount;
        const additionalAiToAdd = Math.min(additionalAiNeeded, additionalAiAvailable);

        const moreAiLabels = aiCandidates
            .slice(finalAiCount, finalAiCount + additionalAiToAdd)
            .map(([name]) => ({
                name,
                source: 'ai' as const,
                isHistorical: false
            }));

        aiLabels = [...aiLabels, ...moreAiLabels];
        allLabelsArray = [...currentTrendingLabels, ...historicalTrendingLabels, ...aiLabels];
    }

    // Ensure we don't exceed MAX_VISIBLE_LABELS
    allLabelsArray = allLabelsArray.slice(0, MAX_VISIBLE_LABELS);

    // Return the combined array
    return allLabelsArray;
};

// Export the distributeLabelsByCategory function as distributeLabels
export const distributeLabels = (
    input: Label[] | Array<[string, {
        count: number;
        nodeCount: number;
        source: 'trending' | 'ai';
        hasNodes: boolean;
        isHistorical?: boolean;
    }]>
): Label[] => {
    // If input is already an array of Label objects, just return it
    if (input.length > 0 && 'name' in input[0]) {
        return input as Label[];
    }

    // Otherwise, process it as an array of tuples
    return distributeLabelsByCategory(input as Array<[string, {
        count: number;
        nodeCount: number;
        source: 'trending' | 'ai';
        hasNodes: boolean;
        isHistorical?: boolean;
    }]>);
};

// Generate category colors for labels
export const generateCategoryColors = (labels: Label[]): Map<string, string> => {
    const colors = new Map<string, string>();

    labels.forEach((label, index) => {
        // Generate a pleasing HSL color
        const hue = (index * 137.508) % 360; // Golden angle approximation
        colors.set(label.name, `hsl(${hue}, 70%, 65%)`);
    });

    return colors;
}; 