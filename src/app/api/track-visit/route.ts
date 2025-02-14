import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

const STATS_PATH = "stats/views.json";
const CACHE_MAX_AGE = 300; // 5 minutes, maximum edge cache time

export async function POST(request: Request) {
  try {
    const { slug, title } = await request.json();
    if (!slug || !title) {
      return NextResponse.json(
        { error: "Missing slug or title" },
        { status: 400 },
      );
    }

    // Get current stats with prefix to ensure we get the right file
    const { blobs } = await list({ prefix: "stats/" });
    const existingBlob = blobs.find((b) => b.pathname === STATS_PATH);

    let stats: Record<string, { title: string; views: number }> = {};
    if (existingBlob) {
      const response = await fetch(existingBlob.url);
      if (response.ok) {
        stats = await response.json();
      }
    }

    // Update stats
    stats[slug] = {
      title,
      views: (stats[slug]?.views || 0) + 1,
    };

    // Save with improved caching configuration
    await put(STATS_PATH, JSON.stringify(stats), {
      access: "public",
      addRandomSuffix: false,
      cacheControlMaxAge: CACHE_MAX_AGE,
      contentType: "application/json",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking visit:", error);
    return NextResponse.json(
      { error: "Failed to track visit" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: "stats/" });
    const existingBlob = blobs.find((b) => b.pathname === STATS_PATH);

    if (!existingBlob) {
      return NextResponse.json([]);
    }

    const response = await fetch(existingBlob.url);
    if (!response.ok) {
      return NextResponse.json([]);
    }

    const stats = await response.json();

    // Convert to array and sort by views
    const sortedStats = Object.entries(stats)
      .map(([slug, data]) => ({
        slug,
        title: (data as { title: string }).title,
        count: (data as { views: number }).views,
      }))
      .sort((a, b) => b.count - a.count);

    // Return all stats instead of just top 3
    return NextResponse.json(sortedStats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json([]);
  }
}
