import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { STATS_PATH, CLASSIFICATIONS_PATH } from "@/app/constants";
import { StatsMap, Label, Classification } from "@/lib/types";
import { slugify } from "@/lib/utils";

export async function GET() {
    try {
        console.log("🔧 GET /api/debug - Starting debug request");

        // Check environment variables
        const envVars = {
            SUPABASE_URL: process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing',
            SUPABASE_KEY: process.env.SUPABASE_KEY ? '✓ Set' : '✗ Missing',
            NODE_ENV: process.env.NODE_ENV,
        };

        console.log("🔧 GET /api/debug - Environment variables:", envVars);

        // Check stats
        const stats = await storage.get(STATS_PATH);
        const statsCount = stats ? Object.keys(stats).length : 0;
        console.log(`🔧 GET /api/debug - Stats count: ${statsCount}`);

        // Check classifications
        const classificationPaths = await storage.list(CLASSIFICATIONS_PATH);
        console.log(`🔧 GET /api/debug - Classification paths count: ${classificationPaths.length}`);

        // Load a sample of classifications
        const sampleSize = Math.min(5, classificationPaths.length);
        const samplePaths = classificationPaths.slice(0, sampleSize);

        const classifications = [];
        for (const path of samplePaths) {
            const data = await storage.get(path);
            classifications.push({
                path,
                data
            });
        }

        // Return debug info
        return new NextResponse(JSON.stringify({
            timestamp: new Date().toISOString(),
            environment: envVars,
            storage: {
                statsPath: STATS_PATH,
                statsCount,
                classificationsPath: CLASSIFICATIONS_PATH,
                classificationsCount: classificationPaths.length,
                sampleClassifications: classifications
            }
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            }
        });
    } catch (error) {
        console.error("❌ GET /api/debug - Error:", error);
        return new NextResponse(JSON.stringify({
            error: "Debug error",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            }
        });
    }
}

// Debug API for development and testing purposes
export async function POST(req: Request) {
  try {
    const { action, title } = await req.json();
    const slug = title ? slugify(title) : "";

    // Handle different debug actions
    switch (action) {
      case "clearAllData":
        try {
          console.log("Clearing all data from the database");
          
          // Use the new clearAll method
          await storage.clearAll();
          
          return NextResponse.json({
            success: true,
            message: "Successfully cleared all data from the database"
          });
        } catch (error) {
          console.error(`Error clearing all data:`, error);
          return NextResponse.json({
            success: false,
            error: `Error clearing all data: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "removeDefaultData":
        try {
          console.log("Removing all default data from the database");
          
          // Get all paths
          const allPaths = await storage.list("");
          console.log(`Found ${allPaths.length} total paths to remove`);
          
          // Delete all entities
          const deletedPaths = [];
          for (const path of allPaths) {
            try {
              await storage.delete(path);
              deletedPaths.push(path);
              console.log(`Deleted: ${path}`);
            } catch (deleteError) {
              console.error(`Failed to delete ${path}:`, deleteError);
            }
          }
          
        } catch (error) {
          console.error(`Error removing default data:`, error);
          return NextResponse.json({
            success: false,
            error: `Error removing default data: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "removeEntity":
        if (!title) {
          return NextResponse.json({
            success: false,
            error: "Title is required for removeEntity action"
          }, { status: 400 });
        }

        try {
          // Get current stats
          console.log(`Removing entity "${title}" (${slug}) from stats at path: ${STATS_PATH}`);
          const stats = await storage.get<StatsMap>(STATS_PATH) || {};
          console.log(`Current stats has ${Object.keys(stats).length} entries`);
          
          // Check if entity exists
          if (!stats[slug]) {
            return NextResponse.json({
              success: false,
              error: `Entity "${title}" (${slug}) not found in stats`
            }, { status: 404 });
          }

          // Create a backup of the entity data
          const entityBackup = stats[slug];
          console.log(`Found entity in stats:`, entityBackup);
          
          // Remove entity from stats
          delete stats[slug];
          console.log(`Removed entity from stats, remaining: ${Object.keys(stats).length}`);
          
          // Save updated stats
          await storage.put(STATS_PATH, stats);
          console.log(`Saved updated stats to ${STATS_PATH}`);
          
          return NextResponse.json({
            success: true,
            message: `Removed entity "${title}" from graph`,
            entityBackup,
            remainingEntities: Object.keys(stats).length
          });
        } catch (error) {
          console.error(`Error removing entity:`, error);
          return NextResponse.json({
            success: false,
            error: `Error removing entity: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "examineClassification":
        if (!title) {
          return NextResponse.json({
            success: false,
            error: "Title is required for examineClassification action"
          }, { status: 400 });
        }
        
        const classificationPath = `${CLASSIFICATIONS_PATH}${slugify(title)}.json`;
        console.log(`Examining classification at ${classificationPath}`);
        
        try {
          // Get the data through the storage interface
          const data = await storage.get(classificationPath);
          
          if (!data) {
            return NextResponse.json({
              success: false,
              error: `No classification found for "${title}"`
            }, { status: 404 });
          }
          
          return NextResponse.json({
            success: true,
            title,
            slug: slugify(title),
            path: classificationPath,
            data
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Error examining classification: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "listAllClassifications":
        try {
          // Get all classification paths
          const classificationPaths = await storage.list(CLASSIFICATIONS_PATH);
          
          // Process each classification
          const results = [];
          for (const path of classificationPaths) {
            try {
              const data = await storage.get(path);
              const slug = path.replace(CLASSIFICATIONS_PATH, "").replace(".json", "");
              const typedData = data as { labels?: Label[]; };
              
              results.push({
                slug,
                path,
                data,
                hasLabels: typedData && typeof typedData === 'object' && Array.isArray(typedData.labels) && typedData.labels.length > 0,
                labelCount: typedData && typeof typedData === 'object' && Array.isArray(typedData.labels) ? typedData.labels.length : 0
              });
            } catch (error) {
              results.push({
                path,
                error: `Error loading: ${error instanceof Error ? error.message : String(error)}`
              });
            }
          }
          
          return NextResponse.json({
            success: true,
            totalPaths: classificationPaths.length,
            classifications: results
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Error listing classifications: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "resetReclassificationFlags":
        try {
          // Get all classification paths
          const classificationPaths = await storage.list(CLASSIFICATIONS_PATH);
          const updatedEntities = [];
          
          // Process each classification
          for (const path of classificationPaths) {
            try {
              const data = await storage.get(path);
              if (data && typeof data === 'object' && 'needsReclassification' in data) {
                const slug = path.replace(CLASSIFICATIONS_PATH, "").replace(".json", "");
                console.log(`Resetting re-classification flag for ${slug}`);
                
                // First delete the existing file
                await storage.delete(path);
                
                // Create a new classification with basic data
                const newClassification = {
                  labels: [
                    { name: "Uncategorized", source: "ai" }
                  ],
                  explanation: "This entity was reset from a re-classification state and needs proper classification.",
                  timestamp: Date.now(),
                  title: data.originalTitle || slug
                };
                
                // Save the new classification
                await storage.put(path, newClassification);
                updatedEntities.push({
                  slug,
                  title: data.originalTitle || slug,
                  path
                });
              }
            } catch (error) {
              console.error(`Error processing ${path}:`, error);
            }
          }
          
          return NextResponse.json({
            success: true,
            message: `Reset re-classification flags for ${updatedEntities.length} entities`,
            updatedEntities
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Error resetting re-classification flags: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "forceCreateClassifications":
        try {
          // Get current stats
          const stats = await storage.get<StatsMap>(STATS_PATH) || {};
          const entities = Object.entries(stats);
          const createdClassifications = [];
          
          // Create a classification for each entity
          for (const [slug, entity] of entities) {
            try {
              const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;
              
              // Create a basic classification
              const classification = {
                labels: [
                  { name: "Uncategorized", source: "ai" }
                ],
                explanation: `This is a placeholder classification for ${entity.title}. Visit the entity to trigger proper classification.`,
                timestamp: Date.now(),
                title: entity.title
              };
              
              // First delete any existing classification
              try {
                await storage.delete(classificationPath);
              } catch {
                console.log(`No existing classification to delete for ${entity.title}`);
              }
              
              // Save the new classification
              await storage.put(classificationPath, classification);
              
              createdClassifications.push({
                slug,
                title: entity.title,
                path: classificationPath
              });
            } catch (error) {
              console.error(`Error creating classification for ${slug}:`, error);
            }
          }
          
          return NextResponse.json({
            success: true,
            message: `Created classifications for ${createdClassifications.length} entities`,
            createdClassifications
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Error creating classifications: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "getGraphState":
        try {
          // Get current stats
          const stats = await storage.get<StatsMap>(STATS_PATH) || {};
          const entities = Object.entries(stats);
          
          // Get classifications for each entity
          const entityStates = [];
          for (const [slug, entity] of entities) {
            try {
              const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;
              const classification = await storage.get(classificationPath);
              
              entityStates.push({
                slug,
                title: entity.title,
                views: entity.views,
                lastVisited: entity.lastVisited,
                hasClassification: !!classification,
                classification: classification || null,
                hasLabels: classification && 
                           typeof classification === 'object' && 
                           Array.isArray((classification as Classification).labels) && 
                           (classification as Classification).labels.length > 0,
                labelCount: classification && 
                            typeof classification === 'object' && 
                            Array.isArray((classification as Classification).labels) ? 
                            (classification as Classification).labels.length : 0
              });
            } catch (error) {
              entityStates.push({
                slug,
                title: entity.title,
                views: entity.views,
                lastVisited: entity.lastVisited,
                hasClassification: false,
                classification: null,
                hasLabels: false,
                labelCount: 0,
                error: `Error loading classification: ${error instanceof Error ? error.message : String(error)}`
              });
            }
          }
          
          return NextResponse.json({
            success: true,
            totalEntities: entities.length,
            entities: entityStates
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Error getting graph state: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "listAllEntities":
        try {
          // List all entities in the database
          const allPaths = await storage.list("");
          
          // Group by path pattern
          const pathsByPattern: Record<string, string[]> = {};
          
          for (const path of allPaths) {
            // Extract the pattern (e.g., stats/, classifications/, etc.)
            const pattern = path.split('/')[0] + '/';
            
            if (!pathsByPattern[pattern]) {
              pathsByPattern[pattern] = [];
            }
            
            pathsByPattern[pattern].push(path);
          }
          
          return NextResponse.json({
            success: true,
            totalPaths: allPaths.length,
            patterns: Object.keys(pathsByPattern),
            pathsByPattern
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Error listing all entities: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "clearCache":
        try {
          const path = title || "";
          const entriesCleared = storage.clearCache(path);
          
          if (path) {
            return NextResponse.json({
              success: true,
              message: `Cache cleared for path: ${path}`,
              entriesCleared
            });
          } else {
            return NextResponse.json({
              success: true,
              message: `Entire cache cleared`,
              entriesCleared
            });
          }
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Error clearing cache: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }

      case "checkConstants":
        return NextResponse.json({
          success: true,
          constants: {
            STATS_PATH,
            CLASSIFICATIONS_PATH,
            supabaseUrl: process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing',
            supabaseKey: process.env.SUPABASE_KEY ? '✓ Set' : '✗ Missing',
            nodeEnv: process.env.NODE_ENV
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in debug API:", error);
    return NextResponse.json({
      success: false,
      error: "Debug operation failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}