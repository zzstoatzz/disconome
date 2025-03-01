import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { StatsMap, Label, Classification } from "@/lib/types";
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
    console.log("🔍 GET /api/track-visit - Starting request");
    const stats = await storage.get<StatsMap>(STATS_PATH);

    // If no stats found, create some sample data
    if (!stats || Object.keys(stats).length === 0) {
      console.log("📊 GET /api/track-visit - No stats found at path:", STATS_PATH);
      console.log("📊 GET /api/track-visit - Creating sample data");

      // Sample entities
      const sampleEntities = [
        { title: "Artificial Intelligence", views: 100 },
        { title: "Machine Learning", views: 85 },
        { title: "Neural Networks", views: 70 },
        { title: "Deep Learning", views: 65 },
        { title: "Natural Language Processing", views: 60 },
        { title: "Computer Vision", views: 55 },
        { title: "Robotics", views: 50 },
        { title: "Data Science", views: 45 },
        { title: "Quantum Computing", views: 40 },
        { title: "Blockchain", views: 35 }
      ];

      // Create sample stats
      const sampleStats: StatsMap = {};
      for (const entity of sampleEntities) {
        const slug = slugify(entity.title);
        sampleStats[slug] = {
          title: entity.title,
          views: entity.views,
          lastVisited: Date.now() - Math.floor(Math.random() * 1000000)
        };
      }

      // Create sample classifications
      for (const entity of sampleEntities) {
        const slug = slugify(entity.title);
        const sampleLabels: Label[] = [
          { name: "Technology", source: "ai" },
          { name: "Computing", source: "ai" }
        ];

        // Add specific labels based on title
        if (entity.title.includes("Intelligence") || entity.title.includes("Learning") ||
          entity.title.includes("Neural") || entity.title.includes("Language")) {
          sampleLabels.push({ name: "Artificial Intelligence", source: "ai" });
        }

        if (entity.title.includes("Data") || entity.title.includes("Science")) {
          sampleLabels.push({ name: "Data Science", source: "ai" });
        }

        if (entity.title.includes("Quantum") || entity.title.includes("Blockchain")) {
          sampleLabels.push({ name: "Emerging Technology", source: "ai" });
        }

        // Save classification
        await storage.put(`${CLASSIFICATIONS_PATH}${slug}.json`, {
          labels: sampleLabels,
          explanation: `This is a sample classification for ${entity.title}`,
          timestamp: Date.now()
        });

        console.log(`📊 GET /api/track-visit - Created sample classification for ${entity.title}`);
      }

      // Save sample stats
      await storage.put(STATS_PATH, sampleStats);
      console.log(`📊 GET /api/track-visit - Saved sample stats with ${Object.keys(sampleStats).length} entities`);

      // Return sample data in the expected format
      const sampleData = Object.entries(sampleStats).map(([slug, entity]) => {
        const classification = {
          labels: [
            { name: "Technology", source: "ai" },
            { name: "Computing", source: "ai" }
          ],
          explanation: `This is a sample classification for ${entity.title}`
        };

        return {
          slug,
          title: entity.title,
          count: entity.views,
          lastVisited: entity.lastVisited,
          labels: classification.labels,
          explanation: classification.explanation
        };
      });

      return new NextResponse(JSON.stringify(sampleData), {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    }

    console.log(`📊 GET /api/track-visit - Raw stats has ${Object.keys(stats).length} entries`);
    console.log(`📊 GET /api/track-visit - First few stats keys:`, Object.keys(stats).slice(0, 5));

    // Get all classifications first
    console.log(`📊 GET /api/track-visit - Looking for classifications at path:`, CLASSIFICATIONS_PATH);
    const classificationPaths = await storage.list(CLASSIFICATIONS_PATH);
    console.log(`📊 GET /api/track-visit - Found ${classificationPaths.length} classification paths`);
    if (classificationPaths.length > 0) {
      console.log(`📊 GET /api/track-visit - First few classification paths:`, classificationPaths.slice(0, 5));
    }

    const classifications = new Map<string, Classification>();
    const deletedEntities = new Set<string>(); // Track entities that have been deleted

    // Load all classifications in parallel
    await Promise.all(
      classificationPaths.map(async (path) => {
        try {
          console.log(`📊 GET /api/track-visit - Loading classification from path:`, path);
          const data = await storage.get(path);
          if (data === null) {
            // This means the classification was marked as deleted
            const slug = path.replace(CLASSIFICATIONS_PATH, "").replace(".json", "");
            deletedEntities.add(slug);
            console.log(`🗑️ GET /api/track-visit - Found deleted entity: ${slug}`);
          } else if (data && typeof data === 'object' && 'needsReclassification' in data) {
            // This entity was removed and needs re-classification
            // We'll exclude it from the graph until it's visited again
            const slug = path.replace(CLASSIFICATIONS_PATH, "").replace(".json", "");
            deletedEntities.add(slug);
            console.log(`🔄 GET /api/track-visit - Found entity marked for re-classification: ${slug}`);
          } else if (isClassification(data)) {
            const slug = path.replace(CLASSIFICATIONS_PATH, "").replace(".json", "");
            console.log(`📑 GET /api/track-visit - Classification for ${slug}:`, {
              labels: data.labels?.map(l => `${l.name} (${l.source})`),
              explanation: data.explanation?.slice(0, 50) + '...'
            });
            classifications.set(slug, data);
          } else {
            console.log(`⚠️ GET /api/track-visit - Invalid classification data for path:`, path, data);
          }
        } catch (error) {
          console.error(`❌ GET /api/track-visit - Error loading classification: ${path}`, error);
        }
      })
    );

    console.log(`📊 GET /api/track-visit - Loaded ${classifications.size} valid classifications`);
    console.log(`📊 GET /api/track-visit - Found ${deletedEntities.size} deleted entities`);

    // Filter out entities that are in the deletedEntities set
    const transformedData = Object.entries(stats)
      .filter(([slug]) => !deletedEntities.has(slug)) // Filter out deleted entities
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
        if (!classification) {
          console.log(`⚠️ GET /api/track-visit - No classification found for slug: ${slug}`);
        }

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
    if (transformedData.length > 0) {
      console.log(`📊 GET /api/track-visit - First entity:`, transformedData[0]);
    } else {
      console.log(`⚠️ GET /api/track-visit - No valid entities found to return`);
    }

    return new NextResponse(JSON.stringify(transformedData), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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

    // If extract is provided, classify the entity
    let classificationLabels: Label[] = [];
    if (extract) {
      try {
        // Fetch existing classifications for context
        const classificationPaths = await storage.list(CLASSIFICATIONS_PATH);
        const classifications = new Map<string, Classification>();
        
        // Load all classifications
        await Promise.all(
          classificationPaths.map(async (path) => {
            try {
              const data = await storage.get(path);
              if (isClassification(data)) {
                const slug = path.replace(CLASSIFICATIONS_PATH, "").replace(".json", "");
                classifications.set(slug, data);
              }
            } catch (error) {
              console.error(`Error loading classification: ${path}`, error);
            }
          })
        );
        
        // Get unique labels for context
        const uniqueLabels = Array.from(
          new Set(
            Array.from(classifications.values()).flatMap((c: Classification) =>
              c.labels.filter((l: Label) => l.source === "ai").map((l: Label) => l.name)
            )
          )
        );
        
        console.log(`🏷️ POST /api/track-visit - Classifying entity: ${title}`);
        console.log(`🧠 POST /api/track-visit - Context labels: ${uniqueLabels.join(", ")}`);
        
        // Call classification API
        const classifyResponse = await fetch(
          "http://localhost:3000/api/classify",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title,
              extract,
            }),
          }
        );
        
        if (classifyResponse.ok) {
          const classifyData = await classifyResponse.json();
          console.log(`✅ POST /api/track-visit - Classification successful:`, {
            labels: classifyData.labels?.map((l: Label) => `${l.name} (${l.source})`),
            explanation: classifyData.explanation?.slice(0, 50) + "...",
          });
          
          // Save classification
          const classification: Classification = {
            labels: classifyData.labels,
            explanation: classifyData.explanation,
            timestamp: Date.now(),
            title,
          };
          
          await storage.put(`${CLASSIFICATIONS_PATH}${slug}.json`, classification);
          
          // Update labels for response
          classificationLabels = classifyData.labels || [];
        } else {
          console.error(`❌ POST /api/track-visit - Classification failed:`, await classifyResponse.text());
        }
      } catch (error) {
        console.error(`❌ POST /api/track-visit - Error during classification:`, error);
      }
    } else {
      // Check if this entity needs re-classification (was previously removed)
      try {
        const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;
        const existingClassification = await storage.get(classificationPath);
        
        if (existingClassification && typeof existingClassification === 'object' && 'needsReclassification' in existingClassification) {
          console.log(`🔄 POST /api/track-visit - Entity needs re-classification: ${title}`);
          
          // Fetch Wikipedia extract for this entity
          try {
            const wikiResponse = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
            );
            
            if (wikiResponse.ok) {
              const wikiData = await wikiResponse.json();
              const extract = wikiData.extract;
              
              if (extract) {
                console.log(`📝 POST /api/track-visit - Fetched Wikipedia extract for ${title}`);
                
                // Call classification API with force reclassify flag
                const classifyResponse = await fetch(
                  "http://localhost:3000/api/classify",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      title,
                      extract,
                      forceReclassify: true
                    }),
                  }
                );
                
                if (classifyResponse.ok) {
                  const classifyData = await classifyResponse.json();
                  console.log(`✅ POST /api/track-visit - Re-classification successful:`, {
                    labels: classifyData.labels?.map((l: Label) => `${l.name} (${l.source})`),
                    explanation: classifyData.explanation?.slice(0, 50) + "...",
                  });
                  
                  // Save classification
                  const classification: Classification = {
                    labels: classifyData.labels,
                    explanation: classifyData.explanation,
                    timestamp: Date.now(),
                    title,
                  };
                  
                  await storage.put(`${CLASSIFICATIONS_PATH}${slug}.json`, classification);
                  
                  // Update labels for response
                  classificationLabels = classifyData.labels || [];
                } else {
                  console.error(`❌ POST /api/track-visit - Re-classification failed:`, await classifyResponse.text());
                }
              } else {
                console.error(`❌ POST /api/track-visit - No extract found in Wikipedia response for ${title}`);
              }
            } else {
              console.error(`❌ POST /api/track-visit - Failed to fetch Wikipedia extract for ${title}:`, await wikiResponse.text());
            }
          } catch (error) {
            console.error(`❌ POST /api/track-visit - Error fetching Wikipedia extract:`, error);
          }
        }
      } catch (error) {
        console.error(`❌ POST /api/track-visit - Error checking for re-classification:`, error);
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
        'Pragma': 'no-cache',
        'Expires': '0',
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
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  }
}
