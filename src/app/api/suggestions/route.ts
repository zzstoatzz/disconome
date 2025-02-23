// app/api/suggestions/route.ts
import { NextResponse } from "next/server";
import { MAX_VISIBLE_SUGGESTIONS } from "@/app/constants";
import { storage } from "@/lib/storage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() || "";

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // Fetch viewed items from stats
    const stats = await storage.get("stats/views.json");
    if (!stats?.data?.data) {
      return NextResponse.json([]);
    }

    // Convert stats to array and filter by query
    const matches = Object.entries(stats.data.data)
      .map(([slug, data]: [string, any]) => ({
        title: data.title,
        slug,
        count: data.views || 0,
      }))
      .filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.slug.includes(query)
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_VISIBLE_SUGGESTIONS)
      .map(({ title, slug }) => ({
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
