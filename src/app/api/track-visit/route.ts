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

    // Transform data to array format and ensure all entries are valid
    const transformedData = Object.entries(stats)
      .filter(([, entity]) => {
        // Filter out invalid entries
        const isValid = entity &&
          typeof entity === 'object' &&
          'title' in entity &&
          'views' in entity &&
          entity.views > 0;

        if (!isValid) {
          console.warn("⚠️ GET /api/track-visit - Found invalid entry:", entity);
        }
        return isValid;
      })
      .map(([slug, entity]) => ({
        slug,
        title: entity.title,
        count: entity.views || 0,
        lastVisited: entity.lastVisited,
        labels: entity.labels || [],
      }))
      .sort((a, b) => b.count - a.count);

    console.log(`📊 GET /api/track-visit - Found ${transformedData.length} valid entities`);
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

    // Maximum number of retries for optimistic locking
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let lastError = null;

    while (retryCount < MAX_RETRIES) {
      try {
        // Get current stats with version
        const { data: currentStats, version } = await storage.getWithVersion<StatsMap>(STATS_PATH);

        // Initialize stats if they don't exist
        const stats = currentStats || {};

        // Check if we already have an entry with this title
        const existingEntry = Object.entries(stats).find(([, data]) =>
          normalizeTitle(data.title) === normalizedTitle
        );

        let updatedStats: StatsMap;
        let updatedEntry: StatsData;

        if (existingEntry) {
          const [existingSlug, existingData] = existingEntry;

          // If the existing entry has a different slug, combine them
          if (existingSlug !== slug) {
            console.log(`🔄 Combining duplicate entries for "${normalizedTitle}"`);
            // Create new stats object to avoid modifying the original
            updatedStats = { ...stats };
            delete updatedStats[slug];

            updatedEntry = {
              title: normalizedTitle,
              views: (existingData.views || 0) + 1,
              lastVisited: Date.now(),
              labels: existingData.labels || []
            };
            updatedStats[existingSlug] = updatedEntry;
          } else {
            // If it's the same slug, just update the views
            updatedStats = { ...stats };
            updatedEntry = {
              title: normalizedTitle,
              views: (existingData.views || 0) + 1,
              lastVisited: Date.now(),
              labels: existingData.labels || []
            };
            updatedStats[existingSlug] = updatedEntry;
          }
        } else {
          // Create new entry if it doesn't exist
          updatedStats = { ...stats };
          updatedEntry = {
            title: normalizedTitle,
            views: 1,
            lastVisited: Date.now(),
            labels: []
          };
          updatedStats[slug] = updatedEntry;
          console.log(`📝 POST /api/track-visit - Created new entry for ${normalizedTitle}`);
        }

        // Try to save with version check
        const success = await storage.putWithVersion(STATS_PATH, updatedStats, version);

        if (success) {
          console.log(`✅ POST /api/track-visit - Updated views for ${normalizedTitle} to ${updatedEntry.views}`);
          return NextResponse.json({ success: true, data: updatedEntry });
        }

        // If version check failed, retry
        console.log(`⚠️ POST /api/track-visit - Version conflict, retrying (${retryCount + 1}/${MAX_RETRIES})`);
        retryCount++;

      } catch (error) {
        lastError = error;
        console.error(`❌ POST /api/track-visit - Error on attempt ${retryCount + 1}:`, error);
        retryCount++;
      }
    }

    // If we get here, we've exhausted our retries
    console.error(`❌ POST /api/track-visit - Failed after ${MAX_RETRIES} attempts`);
    return NextResponse.json({
      success: false,
      error: "Failed to update stats after multiple attempts",
      details: lastError instanceof Error ? lastError.message : String(lastError)
    }, { status: 500 });

  } catch (error) {
    console.error("❌ POST /api/track-visit - Error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to track visit",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
