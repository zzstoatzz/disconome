// app/api/suggestions/route.ts
import { NextResponse } from "next/server";

const SAMPLE_SUGGESTIONS = [
  "Albert Einstein",
  "Bitcoin",
  "World War II",
  "The Internet",
  "Quantum Physics",
  "Mount Everest",
  "Renaissance",
  "Industrial Revolution",
  "Artificial Intelligence",
];

const BASE_URL = "https://qicebrgpjntm0klu.public.blob.vercel-storage.com"; // TODO: make this dynamic
const STATS_URL = `${BASE_URL}/stats/views.json`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() || "";

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // Fetch viewed items from stats
    const response = await fetch(STATS_URL);
    const stats = (await response.json()) as Record<
      string,
      { title: string; views: number }
    >;

    // Create a Map to handle duplicates, preferring stats entries over samples
    const itemsMap = new Map();

    // Add stats items first
    Object.entries(stats).forEach(([slug, data]) => {
      itemsMap.set(slug, {
        title: data.title,
        slug,
        count: data.views,
      });
    });

    // Add sample suggestions only if they don't exist in stats
    SAMPLE_SUGGESTIONS.forEach((title) => {
      const slug = title.toLowerCase().replace(/\s+/g, "-");
      if (!itemsMap.has(slug)) {
        itemsMap.set(slug, {
          title,
          slug,
          count: 0,
        });
      }
    });

    // Filter and sort results
    const matches = Array.from(itemsMap.values())
      .filter(
        (item) =>
          item.title.toLowerCase().includes(query) || item.slug.includes(query),
      )
      .sort((a, b) => b.count - a.count) // Sort by view count
      .slice(0, 5)
      .map((item) => ({
        title: item.title,
        slug: item.slug,
      }));

    return NextResponse.json(matches);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    // Fallback to sample suggestions if fetching fails
    const matches = SAMPLE_SUGGESTIONS.filter((item) =>
      item.toLowerCase().includes(query),
    )
      .slice(0, 5)
      .map((title) => ({
        title,
        slug: title.toLowerCase().replace(/\s+/g, "-"),
      }));
    return NextResponse.json(matches);
  }
}
