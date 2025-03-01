import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { STATS_PATH, CLASSIFICATIONS_PATH } from "@/app/constants";
import { StatsMap } from "@/lib/types";
import { slugify } from "@/lib/utils";

export async function GET() {
    try {
        console.log("🔧 GET /api/debug - Starting debug request");

        // Check environment variables
        const envVars = {
            BLOB_NAMESPACE: process.env.BLOB_NAMESPACE || "dev",
            HAS_BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
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
    const { action, title, removeClassification = false } = await req.json();
    const slug = title ? slugify(title) : "";

    // Handle different debug actions
    switch (action) {
      case "removeEntity":
        if (!title) {
          return NextResponse.json({
            success: false,
            error: "Title is required for removeEntity action"
          }, { status: 400 });
        }

        // Get current stats
        const stats = await storage.get<StatsMap>(STATS_PATH) || {};
        
        // Check if entity exists
        if (!stats[slug]) {
          return NextResponse.json({
            success: false,
            error: `Entity "${title}" (${slug}) not found in stats`
          }, { status: 404 });
        }

        // Create a backup of the entity data
        const entityBackup = stats[slug];
        
        // Remove entity from stats
        delete stats[slug];
        
        // Save updated stats
        await storage.put(STATS_PATH, stats);
        
        // Handle classification
        if (removeClassification) {
          const classificationPath = `${CLASSIFICATIONS_PATH}${slug}.json`;
          
          // Instead of deleting, mark it as needing re-classification
          // by storing a special flag in the classification
          await storage.put(classificationPath, {
            needsReclassification: true,
            removedAt: Date.now(),
            originalTitle: title
          });
          
          console.log(`Marked ${title} for re-classification`);
        }
        
        return NextResponse.json({
          success: true,
          message: `Removed entity "${title}" from graph${removeClassification ? ' and marked for re-classification' : ''}`,
          entityBackup,
          remainingEntities: Object.keys(stats).length
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