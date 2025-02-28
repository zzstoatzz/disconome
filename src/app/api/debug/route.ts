import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { STATS_PATH, CLASSIFICATIONS_PATH } from "@/app/constants";

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