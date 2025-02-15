import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { StatsMap } from "@/types";

const STATS_PATH = "stats/views.json";
const CACHE_MAX_AGE = 300; // 5 minutes, maximum edge cache time
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Add caching for stats blob
let cachedStats: StatsMap | null = null;
let lastFetch = 0;
const CACHE_DURATION = 60000; // 1 minute

const BATCH_SIZE = 5; // Process 5 unclassified items at a time

// Process unclassified items sequentially
async function processUnclassifiedItems(items: [string, any][], cachedStats: StatsMap) {
  let hasUpdates = false;

  // Get current label usage
  const labelCounts = new Map<string, number>();
  Object.values(cachedStats).forEach(entity =>
    entity.labels?.forEach(label =>
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1)
    )
  );

  // Process each item
  for (const [slug, data] of items) {
    try {
      const classifyResponse = await fetch(`${BASE_URL}/api/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          labelCounts: Object.fromEntries(labelCounts)
        })
      });

      if (classifyResponse.ok) {
        const classification = await classifyResponse.json();
        if (classification.labels) {
          cachedStats[slug].labels = classification.labels;
          cachedStats[slug].lastClassified = Date.now();
          hasUpdates = true;

          // Update label counts for next classification
          classification.labels.forEach(label =>
            labelCounts.set(label, (labelCounts.get(label) || 0) + 1)
          );
        }
      }
    } catch (error) {
      console.error(`Classification failed for ${data.title}:`, error);
    }
  }

  if (hasUpdates) {
    await put(STATS_PATH, JSON.stringify(cachedStats), {
      access: "public",
      addRandomSuffix: false,
      cacheControlMaxAge: CACHE_MAX_AGE
    });
  }

  return hasUpdates;
}

export async function POST(req: Request) {
  try {
    const { slug, title } = await req.json();

    // Get current stats
    const { blobs } = await list({ prefix: "stats/" });
    const statsBlob = blobs.find(b => b.pathname === STATS_PATH);
    let stats: StatsMap = {};

    if (statsBlob) {
      const response = await fetch(statsBlob.url);
      stats = await response.json();
    }

    // If entity exists but isn't classified, classify it
    if (stats[slug] && !stats[slug].labels) {
      try {
        const classifyResponse = await fetch(`${BASE_URL}/api/classify`, {
          method: 'POST',
          body: JSON.stringify({ title })
        });

        if (classifyResponse.ok) {
          const { labels } = await classifyResponse.json();
          stats[slug].labels = labels;
          stats[slug].lastClassified = Date.now();
        }
      } catch (error) {
        console.error("Classification failed:", error);
      }
    }

    // Update or create entity stats
    stats[slug] = {
      ...stats[slug],
      title,
      views: (stats[slug]?.views || 0) + 1,
    };

    // Save updated stats
    await put(STATS_PATH, JSON.stringify(stats), {
      access: "public",
      addRandomSuffix: false,
      cacheControlMaxAge: CACHE_MAX_AGE
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error tracking visit:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Use cached data if available and fresh
    if (cachedStats && (Date.now() - lastFetch < CACHE_DURATION)) {
      return NextResponse.json(
        Object.entries(cachedStats)
          .map(([slug, data]) => ({
            slug,
            title: data.title,
            count: data.views,
            labels: data.labels,
            isClassified: !!data.lastClassified,
          }))
          .sort((a, b) => b.count - a.count)
      );
    }

    const { blobs } = await list({ prefix: "stats/" });
    const statsBlob = blobs.find(b => b.pathname === STATS_PATH);

    if (!statsBlob) {
      console.warn("No stats blob found");
      return NextResponse.json([]);
    }

    const response = await fetchWithTimeout(statsBlob.url);
    if (!response.ok) {
      console.warn("Failed to fetch stats blob");
      return NextResponse.json([]);
    }

    cachedStats = await response.json();
    lastFetch = Date.now();

    console.log("Stats loaded:", {
      total: Object.keys(cachedStats).length,
      classified: Object.values(cachedStats).filter(d => d.labels?.length > 0).length
    });

    // Get classified nodes for display
    const sortedStats = Object.entries(cachedStats)
      .filter(([_, data]) => data.labels?.length > 0)
      .map(([slug, data]) => ({
        slug,
        title: data.title,
        count: data.views,
        labels: data.labels,
        isClassified: true
      }))
      .sort((a, b) => b.count - a.count);

    // Get batch of unclassified items
    const unclassifiedItems = Object.entries(cachedStats)
      .filter(([_, data]) => !data.labels?.length)
      .slice(0, BATCH_SIZE);

    if (unclassifiedItems.length > 0) {
      console.log(`Processing ${unclassifiedItems.length} unclassified items`);

      // Process items in parallel
      const hasUpdates = await processUnclassifiedItems(unclassifiedItems, cachedStats);

      if (hasUpdates) {
        console.log("Updated stats saved");
      }
    }

    return NextResponse.json(sortedStats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json([]);
  }
}
