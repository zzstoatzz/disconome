import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  try {
    const result = await list({ prefix: path });

    if (result.blobs.length > 0) {
      const response = await fetch(result.blobs[0].url);
      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(null);
  } catch (error) {
    console.error("Error fetching blob:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
