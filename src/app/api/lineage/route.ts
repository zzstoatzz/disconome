import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { put } from "@vercel/blob";

const lineageSchema = z.object({
  name: z.string(),
  influences: z.array(z.string()),
  influencedBy: z.array(z.string()),
  description: z.string(),
  genres: z.array(z.string()),
  era: z.string(),
});

export async function POST(request: Request) {
  const { artistName } = await request.json();

  try {
    const { object: newLineage } = await generateObject({
      model: openai("gpt-4o"),
      schema: lineageSchema,
      prompt: `Create a musical lineage for ${artistName}. Include their influences, who they influenced, and their place in musical history.`,
    });

    const blobPath = `lineages/${artistName.toLowerCase().replace(/\s+/g, "-")}.json`;

    await put(blobPath, JSON.stringify(newLineage), {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json(newLineage);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate lineage" },
      { status: 500 },
    );
  }
}
