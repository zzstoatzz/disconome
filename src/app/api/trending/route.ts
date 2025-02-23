import { NextResponse } from "next/server";

const BLUESKY_API = "https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple in-memory cache
let memoryCache: {
    data: {
        topics: Array<{ topic: string }>;
        labels: Array<{ name: string; source: string; timestamp: number }>;
    };
    timestamp: number;
} | null = null;

// Helper to normalize topic for use as a label
function normalizeTopicAsLabel(topic: string): string {
    return topic
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

// Helper to ensure we always have an array of topics
function ensureTopicsArray(data: { topics: Array<{ topic: string }> }): Array<{ topic: string }> {
    if (!data || !data.topics || !Array.isArray(data.topics)) {
        console.warn("Invalid topics data received:", data);
        return [];
    }
    return data.topics;
}

export async function GET() {
    try {
        // Check memory cache
        if (memoryCache && (Date.now() - memoryCache.timestamp < CACHE_DURATION)) {
            return NextResponse.json(memoryCache.data);
        }

        // Fetch fresh data from Bluesky
        const response = await fetch(BLUESKY_API);
        const data = await response.json();
        const topics = ensureTopicsArray(data);

        // Transform topics into both formats
        const transformedData = {
            topics,
            labels: topics.map((t: { topic: string }) => ({
                name: normalizeTopicAsLabel(t.topic),
                source: 'trending',
                timestamp: Date.now()
            }))
        };

        // Update memory cache
        memoryCache = {
            data: transformedData,
            timestamp: Date.now()
        };

        return NextResponse.json(transformedData);
    } catch (error) {
        console.error("❌ Error fetching trending topics:", error);
        return NextResponse.json({
            topics: [],
            labels: [],
            error: "Failed to fetch trending topics"
        }, { status: 500 });
    }
} 