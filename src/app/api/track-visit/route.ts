import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { StatsMap } from "@/types";
import { MAX_VISIBLE_NODES } from "@/app/constants";

const STATS_FILE = "stats/views.json";
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

export async function GET() {
  try {
    const stats = await storage.get(STATS_FILE);
    if (!stats) {
      return NextResponse.json([]);
    }

    // Transform data to array format
    const transformedData = Object.entries(stats)
      .map(([slug, entity]: [string, any]) => ({
        slug,
        title: entity.title || slug,
        count: entity.views || 0,
        lastVisited: entity.lastVisited,
        labels: entity.labels || [],
      }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    console.log(`📊 GET /api/track-visit - Found ${transformedData.length} viewed entities`);
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error("❌ GET /api/track-visit - Error:", error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const { slug, title } = await req.json();
    console.log(`📥 POST /api/track-visit - Tracking visit for: ${title}`);

    // Get current stats
    const currentStats = await storage.get(STATS_FILE) || {};
    const currentViews = currentStats[slug]?.views || 0;

    // Update stats
    const updatedStats = {
      ...currentStats,
      [slug]: {
        ...(currentStats[slug] || {}),
        title,
        views: currentViews + 1,
        lastVisited: Date.now(),
      },
    };

    // Save updated stats
    await storage.put(STATS_FILE, updatedStats);
    console.log(`✅ POST /api/track-visit - Updated views for ${title} to ${currentViews + 1}`);

    return NextResponse.json(updatedStats[slug]);
  } catch (error) {
    console.error("❌ POST /api/track-visit - Error:", error);
    return NextResponse.json({ error: "Failed to track visit" }, { status: 500 });
  }
}
