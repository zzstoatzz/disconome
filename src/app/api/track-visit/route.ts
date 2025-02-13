import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

const LEADERBOARD_KEY = "leaderboard.json";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const TOP_N = 3; // Show top 3 instead of 5

interface LeaderboardEntry {
  slug: string;
  title: string;
  count: number;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateLeaderboard(
  slug: string,
  title: string,
  retryCount = 0,
): Promise<boolean> {
  try {
    // Get current leaderboard
    const { blobs } = await list();
    let leaderboard: LeaderboardEntry[] = [];

    const existingLeaderboard = blobs.find(
      (blob) => blob.pathname === LEADERBOARD_KEY,
    );
    if (existingLeaderboard) {
      const response = await fetch(existingLeaderboard.url);
      leaderboard = await response.json();
    }

    // Update the leaderboard
    const existingIndex = leaderboard.findIndex(
      (item: LeaderboardEntry) => item.slug === slug,
    );

    if (existingIndex >= 0) {
      leaderboard[existingIndex].count += 1;
    } else {
      leaderboard.push({
        slug,
        title,
        count: 1,
      });
    }

    const sortedLeaderboard = leaderboard
      .sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.count - a.count)
      .slice(0, TOP_N);

    // Save updated leaderboard
    await put(LEADERBOARD_KEY, JSON.stringify(sortedLeaderboard), {
      access: "public",
    });

    return true;
  } catch (error) {
    // If we hit a conflict or error, retry with backoff
    if (retryCount < MAX_RETRIES) {
      await sleep(RETRY_DELAY * Math.pow(2, retryCount));
      return updateLeaderboard(slug, title, retryCount + 1);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { slug, title } = await request.json();

    if (!slug || !title) {
      return new Response("Missing slug or title", { status: 400 });
    }

    const success = await updateLeaderboard(slug, title);
    return NextResponse.json({ success });
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
    const { blobs } = await list();
    const existingLeaderboard = blobs.find(
      (blob) => blob.pathname === LEADERBOARD_KEY,
    );

    if (existingLeaderboard) {
      const response = await fetch(existingLeaderboard.url);
      const leaderboard = await response.json();
      return NextResponse.json(leaderboard);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}
