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
    const { title, extract } = await req.json();
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

    // If we have a valid cache, return it with current trending topics
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📦 Using cached classification for ${title}`);
      return NextResponse.json({
        labels: cached.labels,
        trendingLabels,
        explanation: cached.explanation
      });
    }

    // Check for existing classification in storage
    const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;
    const existingClassification = await storage.get(classificationPath);

    if (existingClassification && isClassification(existingClassification)) {
      console.log(`📦 Using stored classification for ${title}`);
      // Cache the result
      classifications.set(slug, existingClassification);
      return NextResponse.json({
        labels: existingClassification.labels,
        trendingLabels,
        explanation: existingClassification.explanation
      });
    }

    console.log(`🤖 Generating new classification for ${title}`);

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

IMPORTANT: Select EXACTLY 1-3 labels for "${title}". You MUST follow these rules:

1. You MUST use EXACTLY 1-3 labels total - no more, no less
2. CONSISTENCY IS CRITICAL - if someone has been labeled as a "Record Producer", use EXACTLY that label for others in that role, not "Producer" or "Music Producer"
3. Look at the existing labels and trending topics first and reuse them EXACTLY when they fit - no variations allowed
4. Only create new labels if none of the existing ones truly fit
5. New labels must be broad enough to be reused for other similar entities
6. If this entity is currently trending on Bluesky, make sure to capture relevant context about why (e.g. "Television Host" for a TV personality)
7. CRITICAL: If this entity is related to any currently trending topics, you MUST include those exact trending topics as labels

Here are ALL existing labels and trending topics (REUSE THESE EXACT LABELS when they fit):
${topNodes.length > 0 ? topNodes.map((n) => `- ${n.title}: ${n.labels.map(l => l.name).join(", ")}`).join("\n") : 'No existing labels yet.'}

Currently trending on Bluesky: ${trendingLabels.map((l: Label) => l.name).join(", ")}

Remember: If this entity is related to any of the trending topics listed above, you MUST include those exact trending topics as labels.`
    });

    // Transform AI-generated labels to include source
    const aiLabels = result.object.labels.map(label => {
      // Check if this label matches a trending topic
      const matchingTrending = trendingLabels.find((t: Label) => t.name.toLowerCase() === label.toLowerCase());
      return {
        name: matchingTrending ? matchingTrending.name : label,
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
