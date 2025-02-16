import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { StatsMap } from "@/types";
import { MAX_VISIBLE_NODES } from "@/app/constants";

const STATS_PATH = "stats/views.json";
const CACHE_MAX_AGE = 300; // 5 minutes, maximum edge cache time
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 5000,
): Promise<Response> => {
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

const BATCH_SIZE = 10; // Process 10 unclassified items at a time
const DEBOUNCE_DELAY = 100; // ms

const RECENCY_WEIGHT = 0.6; // Increased from 0.3 to give more weight to recent views
const TIME_DECAY = 24 * 60 * 60 * 1000; // One day in milliseconds
const RANDOM_NEW_NODES = 3; // Number of random unclassified nodes to include

// Process unclassified items sequentially
const processUnclassifiedItems = async (
  items: [string, { title: string }][],
  stats: StatsMap,
) => {
  let hasUpdates = false;
  const batchPromises = [];

  // Process items in smaller chunks for smoother loading
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const promise = new Promise(async (resolve) => {
      await new Promise((r) => setTimeout(r, i * DEBOUNCE_DELAY)); // Stagger requests

      for (const [slug, data] of batch) {
        try {
          const classifyResponse = await fetch(`${BASE_URL}/api/classify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: data.title,
              labelCounts: stats[slug]?.labels?.length
                ? { [stats[slug].labels[0]]: 1 }
                : {},
            }),
          });

          if (classifyResponse.ok) {
            const classification = await classifyResponse.json();
            if (classification.labels) {
              // Initialize or update the stats entry
              stats[slug] = {
                ...stats[slug],
                title: data.title,
                views: stats[slug]?.views || 0,
                labels: classification.labels,
                lastClassified: Date.now(),
              };
              hasUpdates = true;
            }
          }
        } catch (error) {
          console.error(`Classification failed for ${data.title}:`, error);
        }
      }
      resolve(null);
    });
    batchPromises.push(promise);
  }

  await Promise.all(batchPromises);
  return hasUpdates;
};

export async function POST(req: Request) {
  try {
    const { slug, title } = await req.json();

    if (!slug || !title) {
      return NextResponse.json(
        { error: "Slug and title are required" },
        { status: 400 },
      );
    }

    // Get current stats with timeout
    const { blobs } = await list({ prefix: "stats/" });
    const statsBlob = blobs.find((b) => b.pathname === STATS_PATH);
    let stats: StatsMap = {};

    if (statsBlob) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(statsBlob.url, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        stats = await response.json();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.error("Stats fetch timeout");
        } else {
          console.error("Error fetching stats:", error);
        }
        // Continue with empty stats rather than failing
      }
    }

    // Classify immediately if unclassified
    if (!stats[slug]?.labels?.length) {
      try {
        const classifyResponse = await fetch(`${BASE_URL}/api/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });

        if (classifyResponse.ok) {
          const classification = await classifyResponse.json();
          if (classification.labels?.length) {
            stats[slug] = {
              ...stats[slug],
              labels: classification.labels,
              lastClassified: Date.now(),
            };
          }
        }
      } catch (error) {
        console.error("Classification failed:", error);
      }
    }

    // Update entity stats
    stats[slug] = {
      ...stats[slug],
      title,
      views: (stats[slug]?.views || 0) + 1,
      lastClassified: stats[slug]?.lastClassified || Date.now(),
    };

    try {
      await put(STATS_PATH, JSON.stringify(stats), {
        access: "public",
        addRandomSuffix: false,
        cacheControlMaxAge: CACHE_MAX_AGE,
      });
    } catch (putError) {
      console.error("Error saving stats:", putError);
      // Still return success to client but with old stats
      return NextResponse.json(stats);
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error tracking visit:", error);
    return NextResponse.json(
      { error: "Failed to track visit" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // Use cached data if available and fresh
    if (cachedStats && Date.now() - lastFetch < CACHE_DURATION) {
      return NextResponse.json(
        Object.entries(cachedStats)
          .filter(([, data]) => data.labels?.length && data.labels?.length > 0)
          .map(([, data]) => ({
            slug: data.title.toLowerCase().replace(/\s+/g, "-"),
            title: data.title,
            count: data.views,
            labels: data.labels,
            isClassified: !!data.lastClassified,
          }))
          .sort((a, b) => b.count - a.count),
      );
    }

    const { blobs } = await list({ prefix: "stats/" });
    const statsBlob = blobs.find((b) => b.pathname === STATS_PATH);

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
      total: cachedStats ? Object.keys(cachedStats).length : 0,
      classified: cachedStats
        ? Object.values(cachedStats).filter(
          (d) => d.labels?.length && d.labels?.length > 0,
        ).length
        : 0,
    });

    // Calculate scores combining views and recency
    const scoredStats = Object.entries(cachedStats || {})
      .filter(([, data]) => data.labels?.length && data.labels?.length > 0)
      .map(([, data]) => {
        // Calculate time decay factor using only lastClassified
        const timeSinceLastView = Date.now() - (data.lastClassified || 0);
        const recencyScore = Math.exp(-timeSinceLastView / TIME_DECAY);

        // Combine view count with recency
        const score =
          (data.views || 0) * (1 - RECENCY_WEIGHT) +
          recencyScore * RECENCY_WEIGHT;

        return {
          slug: data.title.toLowerCase().replace(/\s+/g, "-"),
          title: data.title,
          count: data.views,
          labels: data.labels,
          isClassified: true,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_VISIBLE_NODES - RANDOM_NEW_NODES);

    // Get random selection of unclassified items
    const unclassifiedPool = Object.entries(cachedStats || {})
      .filter(([, data]) => !data.labels?.length)
      .map(([, data]) => ({
        slug: data.title.toLowerCase().replace(/\s+/g, "-"),
        title: data.title,
        count: data.views || 0,
        labels: [],
        isClassified: false,
      }));

    // Randomly select a few unclassified items
    const randomUnclassified = unclassifiedPool
      .sort(() => Math.random() - 0.5)
      .slice(0, RANDOM_NEW_NODES);

    // Combine scored and random items
    const combinedStats = [...scoredStats, ...randomUnclassified];

    // Process unclassified items in background
    if (unclassifiedPool.length > 0) {
      const itemsToClassify = [...randomUnclassified].map((item) => [
        item.slug,
        { title: item.title },
      ]);

      console.log(`Processing ${itemsToClassify.length} unclassified items`);

      // Process items in parallel but don't await
      processUnclassifiedItems(
        itemsToClassify as [string, { title: string }][],
        cachedStats || {},
      )
        .then((hasUpdates) => {
          if (hasUpdates) {
            console.log("Updated stats saved");
          }
        })
        .catch(console.error);
    }

    return NextResponse.json(combinedStats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json([]);
  }
}
