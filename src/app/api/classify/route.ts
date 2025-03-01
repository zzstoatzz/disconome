import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { storage } from "@/lib/storage";
import { Classification, Label } from "@/lib/types";
import { slugify, isClassification, isStatsMap } from "@/lib/utils";
import {
  MAX_VISIBLE_NODES,
  MAX_VISIBLE_LABELS,
  CLASSIFICATIONS_PATH,
  STATS_PATH,
  CACHE_DURATION,
} from "@/app/constants";

// Track label usage for monitoring consolidation
const LABEL_STATS_PATH = "stats/v1/labels.json";
type LabelStats = Record<string, { count: number, entities: string[] }>;

// Function to update label usage statistics
async function updateLabelStats(title: string, labels: Label[]) {
  try {
    // Get existing label stats
    let labelStats: LabelStats = {};
    try {
      const existingStats = await storage.get(LABEL_STATS_PATH);
      if (existingStats && typeof existingStats === 'object') {
        labelStats = existingStats as LabelStats;
      }
    } catch {
      console.log("No existing label stats found, creating new stats");
    }

    // Update stats for each label
    for (const label of labels) {
      if (label.source === 'ai') {
        const labelName = label.name;
        if (!labelStats[labelName]) {
          labelStats[labelName] = { count: 0, entities: [] };
        }

        labelStats[labelName].count++;

        // Add entity if not already in the list
        if (!labelStats[labelName].entities.includes(title)) {
          labelStats[labelName].entities.push(title);
        }
      }
    }

    // Store updated stats
    await storage.put(LABEL_STATS_PATH, labelStats);

    // Log top labels for monitoring
    const topLabels = Object.entries(labelStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    console.log("📊 Top AI labels:", topLabels.map(([name, stats]) =>
      `${name} (${stats.count})`).join(", "));

  } catch (error) {
    console.error("Error updating label stats:", error);
  }
}

// New function to analyze and consolidate labels across entities
async function analyzeAndConsolidateLabels(newTitle: string, newLabels: Label[]) {
  try {
    console.log(`🔍 Analyzing labels for consolidation after adding: ${newTitle}`);
    
    // Get existing label stats
    try {
      const existingStats = await storage.get(LABEL_STATS_PATH);
      if (!existingStats || typeof existingStats !== 'object') {
        console.log("No existing label stats found, skipping consolidation");
        return;
      }
    } catch {
      console.log("No existing label stats found, skipping consolidation");
      return;
    }
    
    // Get all classifications
    const paths = await storage.list(CLASSIFICATIONS_PATH);
    const classifications = new Map<string, Classification>();
    
    // Load all classifications
    await Promise.all(
      paths.map(async (path) => {
        try {
          const data = await storage.get(path);
          if (isClassification(data)) {
            const slug = path
              .replace(CLASSIFICATIONS_PATH, "")
              .replace(".json", "");
            classifications.set(slug, data);
          }
        } catch (error) {
          console.error(`Error loading classification: ${path}`, error);
        }
      })
    );
    
    // If we have fewer than 3 entities, skip consolidation
    if (classifications.size < 3) {
      console.log("Not enough entities for meaningful consolidation");
      return;
    }
    
    // Group entities by their labels to find patterns
    const entitiesByLabel: Record<string, string[]> = {};
    classifications.forEach((classification, slug) => {
      classification.labels.forEach(label => {
        if (label.source === 'ai') {
          if (!entitiesByLabel[label.name]) {
            entitiesByLabel[label.name] = [];
          }
          entitiesByLabel[label.name].push(classification.title || slug);
        }
      });
    });
    
    // Get all entities as an array for analysis
    const allEntities = Array.from(classifications.entries()).map(([slug, data]) => ({
      title: data.title || slug,
      labels: data.labels.filter(l => l.source === 'ai').map(l => l.name),
      slug
    }));
    
    // Only proceed if we have enough entities
    if (allEntities.length >= 5) {
      console.log(`Analyzing ${allEntities.length} entities for label patterns`);
      
      // Use AI to analyze entity patterns and suggest consolidations
      const result = await generateObject({
        model: openai("gpt-4o"),
        schema: z.object({
          consolidations: z.array(z.object({
            entities: z.array(z.string()),
            commonTheme: z.string(),
            explanation: z.string()
          }))
        }),
        prompt: `Analyze these entities and their current labels to identify groups that should share a common label but don't:

${allEntities.map(e => `- ${e.title}: ${e.labels.join(", ")}`).join("\n")}

Recently added: ${newTitle} with labels: ${newLabels.filter(l => l.source === 'ai').map(l => l.name).join(", ")}

Your task is to identify groups of 3+ entities that are clearly related but don't share a common label.
For example, if you see multiple tennis players labeled as "Athlete" and "Sports Figure" but none as "Tennis Player",
you should suggest consolidating them under "Tennis Player" while keeping their other labels.

Only suggest consolidations when there's a clear pattern and the entities are highly related.
Return an empty array if no clear consolidation opportunities exist.

For each consolidation opportunity, provide:
1. The list of entity titles that should share the label
2. The common theme/label they should all have
3. A brief explanation of why this consolidation makes sense`
      });
      
      // Process the suggested consolidations
      if (result.object.consolidations.length > 0) {
        console.log(`Found ${result.object.consolidations.length} potential label consolidations`);
        
        // Apply each consolidation
        for (const consolidation of result.object.consolidations) {
          const { entities, commonTheme, explanation } = consolidation;
          
          console.log(`Applying consolidation: "${commonTheme}" to ${entities.length} entities`);
          console.log(`Reason: ${explanation}`);
          
          // Update each entity's classification
          for (const entityTitle of entities) {
            // Find the entity by title
            const entity = allEntities.find(e => e.title === entityTitle);
            if (entity) {
              const classification = classifications.get(entity.slug);
              if (classification) {
                // Check if the entity already has this label
                const hasLabel = classification.labels.some(l => 
                  l.name.toLowerCase() === commonTheme.toLowerCase()
                );
                
                if (!hasLabel) {
                  // Add the new common label
                  const updatedLabels = [
                    ...classification.labels,
                    { name: commonTheme, source: 'ai' as const }
                  ];
                  
                  // Update the classification
                  const updatedClassification = {
                    ...classification,
                    labels: updatedLabels,
                    timestamp: Date.now()
                  };
                  
                  // Save the updated classification
                  await storage.put(`${CLASSIFICATIONS_PATH}${entity.slug}.json`, updatedClassification);
                  console.log(`Updated classification for ${entityTitle} with new label: ${commonTheme}`);
                  
                  // Update label stats
                  await updateLabelStats(entityTitle, [{ name: commonTheme, source: 'ai' as const }]);
                }
              }
            }
          }
        }
      } else {
        console.log("No label consolidation opportunities found");
      }
    }
  } catch (error) {
    console.error("Error in label consolidation process:", error);
  }
}

const ClassificationSchema = z.object({
  labels: z.array(z.string()).max(MAX_VISIBLE_LABELS),
  explanation: z.string(),
});

// Add new cache management
let classificationsCache: {
  timestamp: number;
  data: Map<string, Classification>;
} | null = null;

// Add new helper function
async function getClassificationsCache() {
  // Return existing cache if fresh
  if (
    classificationsCache &&
    Date.now() - classificationsCache.timestamp < CACHE_DURATION
  ) {
    return classificationsCache.data;
  }

  try {
    // Use storage interface to list classifications
    const paths = await storage.list(CLASSIFICATIONS_PATH);
    const newCache = new Map<string, Classification>();

    // Process in parallel
    await Promise.all(
      paths.map(async (path) => {
        try {
          const data = await storage.get(path);
          if (isClassification(data)) {
            const slug = path
              .replace(CLASSIFICATIONS_PATH, "")
              .replace(".json", "");
            newCache.set(slug, data);
          }
        } catch (error) {
          console.error(
            `Error loading classification: ${path}`,
            error,
          );
        }
      }),
    );

    classificationsCache = {
      timestamp: Date.now(),
      data: newCache,
    };

    return newCache;
  } catch (error) {
    console.error("Error loading classifications cache:", error);
    return new Map();
  }
}

export async function POST(req: Request) {
  try {
    const { title, extract, forceReclassify = false } = await req.json();
    const slug = slugify(title);

    // Get trending topics first since we need them regardless of cache
    const trendingResponse = await fetch("https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics");
    if (!trendingResponse.ok) {
      console.error(`Trending API error: ${trendingResponse.status} ${trendingResponse.statusText}`);
      throw new Error(`Failed to fetch trending topics: ${trendingResponse.status}`);
    }

    const trendingData = await trendingResponse.json();
    const trendingLabels = (trendingData.topics || []).map((t: { topic: string }) => ({
      name: t.topic
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" "),
      source: 'trending' as const
    }));

    // Get cached classifications
    const classifications = await getClassificationsCache();
    const cached = classifications.get(slug);
    const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;

    // If we have a valid cache and not forcing reclassification, return it with current trending topics
    if (!forceReclassify && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📦 Using cached classification for ${title}`);
      return NextResponse.json({
        labels: cached.labels,
        trendingLabels,
        explanation: cached.explanation
      });
    }

    // Check for existing classification in storage if not forcing reclassification
    if (!forceReclassify) {
      const existingClassification = await storage.get(classificationPath);

      if (existingClassification && isClassification(existingClassification) && 
          !('needsReclassification' in existingClassification)) {
        console.log(`📦 Using stored classification for ${title}`);
        // Cache the result
        classifications.set(slug, existingClassification);
        return NextResponse.json({
          labels: existingClassification.labels,
          trendingLabels,
          explanation: existingClassification.explanation
        });
      }
    }

    console.log(`🤖 ${forceReclassify ? 'Force re-classifying' : 'Generating new classification'} for ${title}`);

    // Get current stats to find top viewed nodes
    const stats = await storage.get(STATS_PATH);
    const topNodes = stats && isStatsMap(stats)
      ? Object.entries(stats)
        .sort((a, b) => (b[1].views || 0) - (a[1].views || 0))
        .slice(0, MAX_VISIBLE_NODES)
        .map(([slug, data]) => ({
          slug,
          title: data.title,
          views: data.views,
          labels: data.labels?.filter(l => l.source === 'ai') || [], // Only use AI labels for context
        }))
      : [];

    // Generate classification considering top nodes and trending topics
    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: ClassificationSchema,
      prompt: `Based on this Wikipedia description:

${extract || 'No description available.'}

IMPORTANT: Select EXACTLY 1-3 labels for "${title}" that will be displayed in a knowledge graph visualization. You MUST follow these strict rules:

1. CONSISTENCY IS THE HIGHEST PRIORITY - use EXACTLY the same labels for similar entities
2. You MUST select 1-3 labels total - no more, no less
3. ALWAYS prioritize reusing existing labels from the list below
4. Create new labels ONLY if absolutely necessary and none of the existing ones fit
5. Labels should be categorized into these types (in order of priority):
   - DOMAIN: The primary field/domain (e.g., "Physics", "Computer Science", "Music")
   - ROLE: The primary role/occupation (e.g., "Physicist", "Entrepreneur", "Musician")
   - CONTEXT: Additional relevant context (e.g., "Nobel Laureate", "AI Research")
6. If this entity is related to any currently trending topics, you MUST include those exact trending topics as labels

LABEL CONSOLIDATION RULES:
- Use the EXACT same label for the same concept (e.g., "Physicist" not "Physics Researcher")
- Use broader categories when possible (e.g., "Musician" instead of "Guitarist" unless specificity is crucial)
- For people, prioritize their primary role over secondary attributes
- For concepts/events, prioritize the domain and historical context

Here are ALL existing labels organized by category (YOU MUST REUSE THESE EXACT LABELS when appropriate):

${topNodes.length > 0 ?
          `EXISTING LABELS (by entity):
${topNodes.map((n) => `- ${n.title}: ${n.labels.map(l => l.name).join(", ")}`).join("\n")}

CONSOLIDATED LABEL LIST (reuse these exact terms):
${Array.from(new Set(topNodes.flatMap(n => n.labels.map(l => l.name)))).sort().join(", ")}`
          : 'No existing labels yet.'}

Currently trending on Bluesky: ${trendingLabels.map((l: Label) => l.name).join(", ")}

Your task is to maintain a consistent, well-organized knowledge graph by selecting the most appropriate labels for "${title}" that align with the existing labeling patterns. Prioritize consistency over creativity.`
    });

    // Transform AI-generated labels to include source
    const aiLabels = result.object.labels.map(label => {
      // Normalize label text - trim whitespace and ensure consistent capitalization
      const normalizedLabel = label.trim().replace(/\s+/g, ' ');

      // Check if this label matches a trending topic (case-insensitive)
      const matchingTrending = trendingLabels.find((t: Label) =>
        t.name.toLowerCase() === normalizedLabel.toLowerCase());

      // Check if this label matches an existing AI label (case-insensitive)
      const existingLabel = Array.from(new Set(
        topNodes.flatMap(n => n.labels.map(l => l.name))
      )).find(name => name.toLowerCase() === normalizedLabel.toLowerCase());

      return {
        // Use exact match from existing labels if available, otherwise use the normalized label
        name: matchingTrending ? matchingTrending.name :
          existingLabel || normalizedLabel,
        source: matchingTrending ? 'trending' as const : 'ai' as const
      };
    });

    // Store only AI-generated labels in classification
    const classification: Classification = {
      labels: aiLabels,
      explanation: result.object.explanation,
      timestamp: Date.now(),
      title,
    };

    // Store classification using storage interface
    await storage.put(classificationPath, classification);

    // Cache the result
    classifications.set(slug, classification);

    // Update label usage statistics
    await updateLabelStats(title, aiLabels);
    
    // Analyze and consolidate labels across entities
    await analyzeAndConsolidateLabels(title, aiLabels);

    // Return both AI and trending labels separately
    return NextResponse.json({
      labels: aiLabels,
      trendingLabels,
      explanation: result.object.explanation
    });
  } catch (error) {
    console.error("Error in classification process:", error);
    return NextResponse.json({
      error: "Classification failed",
      details: error instanceof Error ? error.message : String(error),
      labels: [],
      trendingLabels: []
    }, { status: 500 });
  }
}
