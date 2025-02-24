import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  try {
    const data = await storage.get(path);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in blob route:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
