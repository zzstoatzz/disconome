import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { StatsData, StatsMap } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { STATS_PATH } from "@/app/constants";

// Helper function to normalize title casing
function normalizeTitle(title: string): string {
  return title
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export async function GET() {
  try {
    const stats = await storage.get<StatsMap>(STATS_PATH);
    if (!stats) {
      console.log("📊 GET /api/track-visit - No stats found");
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
    const { slug: rawSlug, title } = await req.json();
    const slug = slugify(rawSlug);
    const normalizedTitle = normalizeTitle(title);
    console.log(`📥 POST /api/track-visit - Tracking visit for: ${normalizedTitle}`);

    // Get current stats
    let currentStats = await storage.get<StatsMap>(STATS_PATH);

    // Initialize stats if they don't exist
    if (!currentStats) {
      console.log("📝 POST /api/track-visit - Creating new stats file");
      currentStats = {};
    }

    // Check if we already have an entry with this title
    const existingEntry = Object.entries(currentStats).find(([, data]) =>
      normalizeTitle(data.title) === normalizedTitle
    );

    if (existingEntry) {
      const [existingSlug, existingData] = existingEntry;

      // If the existing entry has a different slug, combine them
      if (existingSlug !== slug) {
        console.log(`🔄 Combining duplicate entries for "${normalizedTitle}"`);
        // Delete the old entry
        delete currentStats[slug];
        // Update the existing entry
        currentStats[existingSlug] = {
          ...existingData,
          title: normalizedTitle, // Use normalized title
          views: (existingData.views || 0) + 1,
          lastVisited: Date.now(),
        };

        // Save updated stats
        await storage.put(STATS_PATH, currentStats);
        console.log(`✅ POST /api/track-visit - Combined and updated views for ${normalizedTitle} to ${currentStats[existingSlug].views}`);
        return NextResponse.json({ success: true, data: currentStats[existingSlug] });
      }

      // If it's the same slug, just update the views
      currentStats[existingSlug] = {
        ...existingData,
        title: normalizedTitle, // Use normalized title
        views: (existingData.views || 0) + 1,
        lastVisited: Date.now(),
      };
    } else {
      // Create new entry
      const newEntry: StatsData = {
        title: normalizedTitle, // Use normalized title
        views: 1,
        lastVisited: Date.now(),
      };
      currentStats[slug] = newEntry;
    }

    // Save updated stats
    await storage.put(STATS_PATH, currentStats);
    console.log(`✅ POST /api/track-visit - Updated views for ${normalizedTitle}`);

    return NextResponse.json({ success: true, data: currentStats[slug] });
  } catch (error) {
    console.error("❌ POST /api/track-visit - Error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to track visit",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
