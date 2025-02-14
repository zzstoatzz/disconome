import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

const STATS_FILE = "stats.json";

interface ViewStats {
  [key: string]: {
    title: string;
    views: number;
  };
}

export async function POST(request: Request) {
  try {
    const { slug, title } = await request.json();
    if (!slug || !title) {
      return NextResponse.json(
        { error: "Missing slug or title" },
        { status: 400 },
      );
    }

    // Get current stats
    const { blobs } = await list();
    const existingBlob = blobs.find((b) => b.pathname === STATS_FILE);

    let stats: ViewStats = {};
    if (existingBlob) {
      const response = await fetch(existingBlob.url);
      if (response.ok) {
        const existingStats = await response.json();
        stats = { ...existingStats };
      }
    }

    // Update the entry
    stats[slug] = {
      title,
      views: (stats[slug]?.views || 0) + 1,
    };

    // Save the stats
    await put(STATS_FILE, JSON.stringify(stats), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking visit:", error);
    return NextResponse.json(
      {
        error: "Failed to track visit",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const { blobs } = await list();
    const existingBlob = blobs.find((b) => b.pathname === STATS_FILE);

    if (existingBlob) {
      const response = await fetch(existingBlob.url);
      if (response.ok) {
        const stats: ViewStats = await response.json();
        console.log("GET: Found stats:", stats); // Debug log

        // Convert to sorted array for display
        const topEntities = Object.entries(stats)
          .map(([slug, data]) => ({
            slug,
            title: data.title,
            count: data.views,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        console.log("GET: Returning entities:", topEntities); // Debug log
        return NextResponse.json(topEntities);
      }
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json([]);
  }
}
