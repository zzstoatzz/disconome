import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from 'ai';
import { z } from "zod";
import { put, list } from "@vercel/blob";
import { StatsMap } from "@/types";

const STATS_PATH = "stats/views.json";
const CLASSIFICATIONS_PATH = "classifications/v1/"; // Versioned namespace
const MAX_LABELS = 5;
const MAX_VISIBLE_NODES = 15; // Limit visible nodes for performance

const ClassificationSchema = z.object({
    labels: z.array(z.string()).max(3),
    explanation: z.string(),
});

// Helper to get label strength (how well it connects nodes)
function getLabelStrength(label: string, stats: StatsMap): number {
    const nodesWithLabel = Object.values(stats).filter(
        entity => entity.labels?.includes(label)
    ).length;
    return nodesWithLabel;
}

// Helper to get or create classification
async function getClassification(title: string, existingLabels: Set<string>, stats: StatsMap) {
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;

    // Check existing classification
    const { blobs } = await list({ prefix: classificationPath });
    if (blobs.length > 0) {
        const response = await fetch(blobs[0].url);
        return response.json();
    }

    // Get label strengths for context
    const labelStrengths = Array.from(existingLabels).map(label => ({
        label,
        strength: getLabelStrength(label, stats)
    }));

    // Generate new classification
    const result = await generateObject({
        model: openai('gpt-4o'),
        schema: ClassificationSchema,
        prompt: `Classify this entity: "${title}" into 1-3 categories.
        
        Current top categories (with connection counts):
        ${labelStrengths.map(({ label, strength }) => `${label} (${strength} connections)`).join(", ")}

        GOALS:
        1. Prefer existing categories to create stronger connections
        2. Only create a new category if it would be broadly applicable to many entities
        3. More general categories that can connect many nodes are better
        4. If creating a new category, it should replace the weakest existing category

        We maintain only ${MAX_LABELS} categories total for the entire system.`
    });

    const classification = result.object;
    await put(classificationPath, JSON.stringify(classification), {
        access: "public",
        addRandomSuffix: false
    });

    return classification;
}

export async function POST(req: Request) {
    try {
        const { title } = await req.json();
        console.log("Classifying:", title);

        // Get current stats to check existing labels
        const { blobs } = await list({ prefix: "stats/" });
        const statsBlob = blobs.find(b => b.pathname === STATS_PATH);
        if (!statsBlob) {
            console.warn("No stats blob found for classification");
            return NextResponse.json({ error: 'No stats found' }, { status: 404 });
        }

        const response = await fetch(statsBlob.url);
        const stats: StatsMap = await response.json();

        // Get current top labels by frequency
        const labelCounts = new Map<string, number>();
        Object.values(stats).forEach(entity =>
            entity.labels?.forEach(label =>
                labelCounts.set(label, (labelCounts.get(label) || 0) + 1)
            )
        );

        // Keep only top N labels
        const topLabels = new Set(
            Array.from(labelCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, MAX_LABELS)
                .map(([label]) => label)
        );

        const classification = await getClassification(title, topLabels, stats);
        console.log("Classification result:", classification);

        return NextResponse.json(classification);
    } catch (error) {
        console.error("Error classifying entity:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
} 