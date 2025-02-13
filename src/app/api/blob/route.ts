import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  const blobs = await list({
    prefix: path,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  if (blobs.blobs.length > 0) {
    const response = await fetch(blobs.blobs[0].url);
    const data = await response.json();
    return NextResponse.json(data);
  }

  return NextResponse.json(null);
}
