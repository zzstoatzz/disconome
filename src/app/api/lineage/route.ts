"use server";

import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { z } from "zod";
import { put, list } from "@vercel/blob";
import { createHash } from "crypto";

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
      .describe("A chronological list of significant events"),
  }),
});

export async function POST(req: Request) {
  try {
    const { prompt, wikiContent } = await req.json();
    console.log("📥 Processing request for:", prompt);

    const contentHash = createHash("sha256")
      .update(prompt + wikiContent)
      .digest("hex")
      .slice(0, 10);

    const blobPath = `events/${prompt.toLowerCase().replace(/\s+/g, "-")}-${contentHash}.json`;
    const blobs = await list({ prefix: blobPath });

    if (blobs.blobs.length > 0) {
      console.log("📦 Found cached data");
      const response = await fetch(blobs.blobs[0].url);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: {
          "x-cache": "HIT",
        },
      });
    }

    // Generate new data if not found
    console.log("🤖 Generating new data");
    const result = await streamObject({
      model: openai("gpt-4o"),
      system: `You are an expert historian with deep knowledge of world history. 
              Use the provided Wikipedia content for specific citations but use your 
              own knowledge to aptrly partition the timeline into 5 significant events.
              Dates should be as specific and consistent with each other as possible.`,
      schemaName: "Timeline",
      schema,
      prompt: `Using this Wikipedia content as context:

${wikiContent}

Generate 5 significant events for ${prompt}. Order them chronologically. 
Only include events that are explicitly mentioned in the Wikipedia content.
If there aren't enough explicit events, you can include fewer than 5 events.`,
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

    return new Response(response.body, {
      headers: {
        ...response.headers,
        "x-cache": "MISS",
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
    });
  }
}
