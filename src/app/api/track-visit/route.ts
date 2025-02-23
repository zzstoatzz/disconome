import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

const STATS_FILE = "stats/views.json";

type StatsData = {
  title: string;
  views: number;
  labels?: string[];
  lastVisited: number;
};

type StatsMap = Record<string, StatsData>;

export async function GET() {
  try {
    const stats = await storage.get(STATS_FILE) as StatsMap;
    if (!stats) {
      return NextResponse.json([]);
    }

    // Transform data to array format
    const transformedData = Object.entries(stats)
      .map(([slug, entity]) => ({
        slug,
        title: entity.title,
        count: entity.views || 0,
        lastVisited: entity.lastVisited,
        labels: entity.labels || [],
      }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    console.log(`📊 GET /api/track-visit - Found ${transformedData.length} entities`);
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
    const currentStats = await storage.get(STATS_FILE) as StatsMap || {};

    // Check if we already have an entry with this title
    const existingEntry = Object.entries(currentStats).find(([, data]) => data.title === title);

    if (existingEntry) {
      const [existingSlug, existingData] = existingEntry;

      // If the existing entry has a different slug, combine them
      if (existingSlug !== slug) {
        console.log(`🔄 Combining duplicate entries for "${title}"`);
        // Delete the old entry
        delete currentStats[slug];
        // Update the existing entry
        currentStats[existingSlug] = {
          ...existingData,
          views: (existingData.views || 0) + 1,
          lastVisited: Date.now(),
        };

        // Save updated stats
        await storage.put(STATS_FILE, currentStats);
        console.log(`✅ POST /api/track-visit - Combined and updated views for ${title} to ${currentStats[existingSlug].views}`);
        return NextResponse.json(currentStats[existingSlug]);
      }

      // If it's the same slug, just update the views
      currentStats[existingSlug] = {
        ...existingData,
        views: (existingData.views || 0) + 1,
        lastVisited: Date.now(),
      };
    } else {
      // Create new entry
      currentStats[slug] = {
        title,
        views: 1,
        lastVisited: Date.now(),
      };
    }

    // Save updated stats
    await storage.put(STATS_FILE, currentStats);
    console.log(`✅ POST /api/track-visit - Updated views for ${title}`);

    return NextResponse.json(currentStats[slug]);
  } catch (error) {
    console.error("❌ POST /api/track-visit - Error:", error);
    return NextResponse.json({ error: "Failed to track visit" }, { status: 500 });
  }
}
