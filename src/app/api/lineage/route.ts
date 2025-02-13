"use server";

import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { z } from "zod";
import { put, list } from "@vercel/blob";

const schema = z.object({
  events: z.object({
    items: z
      .array(
        z.object({
          date: z.string().describe("The date of the event"),
          title: z.string().describe("The title of the event"),
          description: z.string().describe("Description of what happened"),
        }),
      )
      .describe("A chronological list of life events"),
  }),
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    console.log("📥 Processing request for:", prompt);

    // Check blob storage first
    const blobPath = `events/${prompt.toLowerCase().replace(/\s+/g, "-")}.json`;
    const blobs = await list({ prefix: blobPath });

    if (blobs.blobs.length > 0) {
      console.log("📦 Found cached data");
      const response = await fetch(blobs.blobs[0].url);
      const data = await response.json();
      return new Response(JSON.stringify(data));
    }

    // Generate new data if not found
    console.log("🤖 Generating new data");
    const result = await streamObject({
      model: openai("gpt-4o"),
      system:
        "You are helping create a chronological timeline of important life events.",
      schemaName: "Timeline",
      schema,
      prompt: `Generate 5 significant life events for ${prompt}. Order them chronologically.`,
    });

    // Stream the response to the client
    const response = result.toTextStreamResponse();

    // Save final object to blob storage after streaming starts
    result.object.then(async (finalObject) => {
      await put(blobPath, JSON.stringify(finalObject), {
        access: "public",
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    });

    return response;
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
    });
  }
}
