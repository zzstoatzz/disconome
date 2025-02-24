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
    const { title, prompt } = await req.json();
    const slug = slugify(title);

    // Get cached classifications
    const classifications = await getClassificationsCache();
    const cached = classifications.get(slug);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ labels: cached.labels });
    }

    // Get trending topics as potential labels
    try {
      // Use absolute URL construction
      const trendingUrl = new URL("/api/trending", process.env.NEXT_PUBLIC_APP_URL || req.url);
      const trendingResponse = await fetch(trendingUrl);

      if (!trendingResponse.ok) {
        console.error(`Trending API error: ${trendingResponse.status} ${trendingResponse.statusText}`);
        throw new Error(`Failed to fetch trending topics: ${trendingResponse.status}`);
      }

      const trendingData = await trendingResponse.json();
      const trendingLabels = (trendingData.labels || []).map((l: { name: string; source: string }) => ({
        name: l.name,
        source: 'trending' as const
      }));

      // Check for existing classification
      const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;
      const existingClassification = await storage.get(classificationPath);

      if (existingClassification && isClassification(existingClassification)) {
        return NextResponse.json({ labels: existingClassification.labels });
      }

      // Get current stats to find top viewed nodes
      const stats = await storage.get(STATS_PATH);
      if (!stats || !isStatsMap(stats)) {
        return NextResponse.json({ error: "No stats found" }, { status: 404 });
      }

      // Get top viewed nodes and their labels
      const topNodes = Object.entries(stats)
        .sort((a, b) => (b[1].views || 0) - (a[1].views || 0))
        .slice(0, MAX_VISIBLE_NODES)
        .map(([slug, data]) => ({
          slug,
          title: data.title,
          views: data.views,
          labels: data.labels || [],
        }));

      // Generate classification considering top nodes and trending topics
      const result = await generateObject({
        model: openai("gpt-4o"),
        schema: ClassificationSchema,
        prompt: `${prompt || `Classify "${title}" into 1-3 categories that could connect it to these frequently viewed entities and trending topics:`}

              Top viewed entities and their current labels:
              ${topNodes.map((n) => `- ${n.title}: ${n.labels.join(", ")}`).join("\n")}

              Current trending topics that could be relevant labels:
              ${trendingLabels.map((l: Label) => l.name).join(", ")}

              Focus on finding or creating categories that could meaningfully connect multiple entities.
              If the content is clearly related to any of the trending topics, include those as labels.`,
      });

      // Transform AI-generated labels to include source
      const aiLabels = result.object.labels.map(label => ({
        name: label,
        source: 'ai' as const
      }));

      // Combine AI-generated labels with any matching trending topics
      const finalLabels = [...new Set([
        ...aiLabels,
        ...trendingLabels.filter((tl: Label) =>
          title.toLowerCase().includes(tl.name.toLowerCase()) ||
          aiLabels.some(al =>
            al.name.toLowerCase().includes(tl.name.toLowerCase()) ||
            tl.name.toLowerCase().includes(al.name.toLowerCase())
          )
        )
      ])];

      const classification: Classification = {
        labels: finalLabels,
        explanation: result.object.explanation,
        timestamp: Date.now(),
        title,
      };

      // Store classification using storage interface
      await storage.put(classificationPath, classification);

      // Cache the result
      classifications.set(slug, classification);

      return NextResponse.json(classification);
    } catch (error) {
      console.error("Error in classification process:", error);
      // Return a more specific error response
      return NextResponse.json({
        error: "Classification failed",
        details: error instanceof Error ? error.message : String(error),
        labels: []
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error parsing request:", error);
    return NextResponse.json({
      error: "Invalid request",
      details: error instanceof Error ? error.message : String(error),
      labels: []
    }, { status: 400 });
  }
}
