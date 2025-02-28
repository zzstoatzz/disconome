import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { StatsMap, Label } from "@/lib/types";
import { slugify, isClassification } from "@/lib/utils";
import { STATS_PATH, CLASSIFICATIONS_PATH } from "@/app/constants";

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
      return new NextResponse(JSON.stringify([]), {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        }
      });
    }

    console.log(`📊 GET /api/track-visit - Raw stats has ${Object.keys(stats).length} entries`);

    // Get all classifications first
    const classificationPaths = await storage.list(CLASSIFICATIONS_PATH);
    console.log(`📊 Found ${classificationPaths.length} classification paths`);

    const classifications = new Map();

    // Load all classifications in parallel
    await Promise.all(
      classificationPaths.map(async (path) => {
        try {
          const data = await storage.get(path);
          if (isClassification(data)) {
            const slug = path.replace(CLASSIFICATIONS_PATH, "").replace(".json", "");
            console.log(`📑 Classification for ${slug}:`, {
              labels: data.labels?.map(l => `${l.name} (${l.source})`),
              explanation: data.explanation?.slice(0, 50) + '...'
            });
            classifications.set(slug, data);
          }
        } catch (error) {
          console.error(`Error loading classification: ${path}`, error);
        }
      })
    );

    // Transform data to array format
    const transformedData = Object.entries(stats)
      .map(([slug, entity]) => {
        // Basic structure validation
        const isValidStructure = entity &&
          typeof entity === 'object' &&
          'title' in entity;

        if (!isValidStructure) {
          console.warn("⚠️ GET /api/track-visit - Skipping malformed entry:", entity);
          return null;
        }

        // Use existing views, defaulting to 1 if missing
        const views = ('views' in entity && typeof entity.views === 'number' && entity.views >= 1)
          ? entity.views
          : 1;

        // Get classification if it exists
        const classification = classifications.get(slug);
        console.log(`🔍 Processing ${entity.title} (${slug}):`, {
          classificationLabels: classification?.labels?.map((l: Label) => `${l.name} (${l.source})`)
        });

        return {
          slug,
          title: entity.title,
          count: views,
          lastVisited: entity.lastVisited || Date.now(),
          labels: classification?.labels || [],
          explanation: classification?.explanation
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.count - a.count);

    console.log(`📊 GET /api/track-visit - Returning ${transformedData.length} valid entities`);

    // just show the names of the labels
    console.log("Labels summary:", transformedData.map(e => e.labels.map((l: Label) => l.name)));

    return new NextResponse(JSON.stringify(transformedData), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    });
  } catch (error) {
    console.error("❌ GET /api/track-visit - Error:", error);
    return new NextResponse(JSON.stringify([]), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    });
  }
}

export async function POST(req: Request) {
  try {
    const { title, extract } = await req.json();
    const slug = slugify(title);
    const normalizedTitle = normalizeTitle(title);
    console.log(`📥 POST /api/track-visit - Tracking visit for: ${normalizedTitle}`);

    // Get current stats
    const stats = await storage.get<StatsMap>(STATS_PATH) || {};
    console.log(`📊 Current stats has ${Object.keys(stats).length} entries`);

    // Check if we already have an entry with this title
    const existingEntry = Object.entries(stats).find(([, data]) =>
      normalizeTitle(data.title) === normalizedTitle
    );

    // Create new stats object with all existing entries
    const updatedStats = { ...stats };

    if (existingEntry) {
      const [existingSlug] = existingEntry;
      // Update just this entry - without labels
      updatedStats[existingSlug] = {
        title: normalizedTitle,
        views: (stats[existingSlug].views || 0) + 1,
        lastVisited: Date.now()
      };
      console.log(`✅ POST /api/track-visit - Updated views for ${normalizedTitle} to ${updatedStats[existingSlug].views}`);
    } else {
      // Add new entry - without labels
      updatedStats[slug] = {
        title: normalizedTitle,
        views: 1,
        lastVisited: Date.now()
      };
      console.log(`📝 POST /api/track-visit - Created new entry for ${normalizedTitle}`);
    }

    // Classify the entity if extract is provided
    let classificationLabels: Label[] = [];
    if (extract) {
      try {
        // Get all existing classifications for context
        const existingClassifications = await storage.list(CLASSIFICATIONS_PATH);
        const existingLabels = await Promise.all(
          existingClassifications.map(async (path) => {
            const data = await storage.get(path);
            if (isClassification(data)) {
              return data.labels;
            }
            return [];
          })
        );

        // Flatten and filter unique labels for context
        const uniqueExistingLabels = Array.from(new Set(
          existingLabels.flat().filter(Boolean).map(l => l.name)
        ));

        console.log(`🏷️ Existing labels for context:`, uniqueExistingLabels);

        const classifyResponse = await fetch('http://localhost:3000/api/classify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            extract,
            existingLabels: uniqueExistingLabels // Pass existing labels for context
          }),
        });

        if (classifyResponse.ok) {
          const classification = await classifyResponse.json();
          const targetSlug = existingEntry ? existingEntry[0] : slug;

          // Log the classification response
          console.log(`🤖 Classification response for ${title}:`, {
            aiLabels: classification.labels?.map((l: Label) => `${l.name} (${l.source})`),
            trendingLabels: classification.trendingLabels?.map((l: Label) => `${l.name} (${l.source})`)
          });

          // Only include trending labels that match the entity title
          const matchingTrendingLabels = (classification.trendingLabels || [])
            .filter((topic: { name: string; source: 'trending' }) => {
              const topicSlug = slugify(topic.name);
              const entitySlug = slugify(title);
              return topicSlug === entitySlug;
            });

          // Combine AI and matching trending labels
          classificationLabels = [...(classification.labels || []), ...matchingTrendingLabels];

          // Save classification
          await storage.put(`${CLASSIFICATIONS_PATH}${targetSlug}.json`, {
            labels: classificationLabels,
            explanation: classification.explanation,
            timestamp: Date.now()
          });

          console.log(`💾 Saved classification for ${title}:`, {
            labels: classificationLabels.map((l: Label) => `${l.name} (${l.source})`),
            explanation: classification.explanation?.slice(0, 50) + '...'
          });
        }
      } catch (error) {
        console.error("Failed to classify entity:", error);
      }
    }

    // Save stats object (without labels)
    await storage.put(STATS_PATH, updatedStats);

    // Return response with labels from classification
    return new NextResponse(JSON.stringify({
      success: true,
      data: {
        ...updatedStats[existingEntry ? existingEntry[0] : slug],
        labels: classificationLabels
      },
      totalEntities: Object.keys(updatedStats).length
    }), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    });
  } catch (error) {
    console.error("❌ POST /api/track-visit - Error:", error);
    return new NextResponse(JSON.stringify({
      success: false,
      error: "Failed to track visit",
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    });
  }
}
