// app/api/suggestions/route.ts
import { NextResponse } from "next/server";
import { MAX_VISIBLE_SUGGESTIONS } from "@/app/constants";
import { storage } from "@/lib/storage";
import { StatsMap } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { STATS_PATH } from "@/app/constants";

interface Suggestion {
  title: string;
  slug: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() || "";

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // Fetch viewed items from stats
    const stats = await storage.get<StatsMap>(STATS_PATH);
    if (!stats) {
      return NextResponse.json([]);
    }

    // Filter and sort matches
    const matches = Object.entries(stats)
      .map(([slug, data]) => ({
        title: data.title,
        slug,
        count: data.views || 0,
      }))
      .filter(item =>
        item.title?.toLowerCase().includes(query) ||
        slugify(item.title).includes(query)
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_VISIBLE_SUGGESTIONS)
      .map(({ title, slug }): Suggestion => ({
        title,
        slug,
      }));

    console.log(`🔍 Found ${matches.length} suggestions for "${query}"`);
    return NextResponse.json(matches);
  } catch (error) {
    console.error("❌ Error fetching suggestions:", error);
    return NextResponse.json([]);
  }
}
