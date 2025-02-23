import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { put, list } from "@vercel/blob";
import { StatsMap } from "@/types";
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

// Helper to sanitize paths for blob storage
function sanitizePath(path: string): string {
  return path
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-") // Replace any non-alphanumeric chars with dash
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
}

// Add new cache management
let classificationsCache: {
  timestamp: number;
  data: Map<
    string,
    {
      labels: string[];
      timestamp: number;
    }
  >;
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
    // Fetch all classifications at once
    const { blobs } = await list({ prefix: CLASSIFICATIONS_PATH });
    const newCache = new Map();

    // Process in parallel
    await Promise.all(
      blobs.map(async (blob) => {
        try {
          const data = await (await fetch(blob.url)).json();
          const slug = blob.pathname
            .replace(`${CLASSIFICATIONS_PATH}`, "")
            .replace(".json", "");
          newCache.set(slug, {
            labels: Array.isArray(data.labels) ? data.labels : [],
            timestamp: data.timestamp || Date.now(),
          });
        } catch (error) {
          console.error(
            `Error loading classification: ${blob.pathname}`,
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
    const slug = sanitizePath(title);

    // Get cached classifications
    const classifications = await getClassificationsCache();
    const cached = classifications.get(slug);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ labels: cached.labels });
    }

    // Get trending topics as potential labels
    const trendingResponse = await fetch(new URL("/api/trending", req.url));
    const trendingData = await trendingResponse.json();
    const trendingLabels = (trendingData.labels || []).map((l: { name: string }) => ({
      name: l.name,
      source: 'trending'
    }));

    // Check for existing classification first
    const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;
    const { blobs: classificationBlobs } = await list({
      prefix: classificationPath,
    });
    if (classificationBlobs.length > 0) {
      const existingClassification = await (
        await fetch(classificationBlobs[0].url)
      ).json();
      // Ensure labels is always an array and include source
      const existingLabels = Array.isArray(existingClassification.labels)
        ? existingClassification.labels.map((l: string) => ({ name: l, source: 'ai' }))
        : [];
      return NextResponse.json({ labels: existingLabels });
    }

    // Get current stats to find top viewed nodes
    const { blobs } = await list({ prefix: "stats/" });
    const statsBlob = blobs.find((b) => b.pathname === STATS_PATH);
    if (!statsBlob) {
      return NextResponse.json({ error: "No stats found" }, { status: 404 });
    }

    const stats: StatsMap = await (await fetch(statsBlob.url)).json();

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
            ${trendingLabels.map((l: { name: string }) => l.name).join(", ")}

            Focus on finding or creating categories that could meaningfully connect multiple entities.
            If the content is clearly related to any of the trending topics, include those as labels.`,
    });

    // Transform AI-generated labels to include source
    const aiLabels = result.object.labels.map(label => ({
      name: label,
      source: 'ai'
    }));

    // Combine AI-generated labels with any matching trending topics
    const finalLabels = [...new Set([
      ...aiLabels,
      ...trendingLabels.filter((tl: { name: string }) =>
        title.toLowerCase().includes(tl.name.toLowerCase()) ||
        aiLabels.some(al =>
          al.name.toLowerCase().includes(tl.name.toLowerCase()) ||
          tl.name.toLowerCase().includes(al.name.toLowerCase())
        )
      )
    ])];

    const finalResult = {
      ...result.object,
      labels: finalLabels
    };

    // Store classification
    await put(
      classificationPath,
      JSON.stringify({
        ...finalResult,
        timestamp: Date.now(),
        title,
      }),
      {
        access: "public",
        addRandomSuffix: false,
      },
    );

    // Cache the result
    classifications.set(slug, {
      labels: finalLabels,
      timestamp: Date.now(),
    });

    return NextResponse.json(finalResult);
  } catch (error) {
    console.error("Error classifying entity:", error);
    return NextResponse.json({ labels: [] });
  }
}
