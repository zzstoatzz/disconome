import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

const BLUESKY_API = "https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics";
const CACHE_PATH = "trending/topics.json";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
    try {
        // Check cache first
        const { blobs } = await list({ prefix: CACHE_PATH });
        const cacheBlob = blobs.find((b) => b.pathname === CACHE_PATH);

        if (cacheBlob) {
            const cacheResponse = await fetch(cacheBlob.url);
            const cacheData = await cacheResponse.json();

            // Return cache if fresh
            if (Date.now() - cacheData.timestamp < CACHE_DURATION) {
                return NextResponse.json(cacheData.topics);
            }
        }

        // Fetch fresh data from Bluesky
        const response = await fetch(BLUESKY_API);
        const data = await response.json();

        // Cache the result with timestamp
        await put(CACHE_PATH, JSON.stringify({
            topics: data.topics,
            timestamp: Date.now()
        }), {
            access: "public",
            addRandomSuffix: false,
        });

        return NextResponse.json(data.topics);
    } catch (error) {
        console.error("Error fetching trending topics:", error);
        return NextResponse.json({ error: "Failed to fetch trending topics" }, { status: 500 });
    }
} 