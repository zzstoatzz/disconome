"use server";

import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { z } from "zod";
import { storage } from "@/lib/storage";
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
      .describe("A chronological list of significant events").max(8),
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
    const existingData = await storage.get(blobPath);

    if (existingData) {
      console.log("📦 Found cached data");
      return new Response(JSON.stringify(existingData), {
        headers: {
          "x-cache": "HIT",
        },
      });
    }

    // Generate new data if not found
    console.log("🤖 Generating new data");
    const result = await streamObject({
      model: openai("gpt-4o"),
      system: `You are an expert historian with deep knowledge of world history. When using dates, make sure they are as specific and consistent with each other as possible.`,
      schemaName: "Timeline",
      schema,
      prompt: `Using this Wikipedia content as context:

${wikiContent}

Generate significant events for ${prompt}. Order them chronologically. 
Use the provided Wikipedia content for specific citations but use your 
own knowledge to aptly partition the timeline into multiple significant events,
extrapolate as needed to make at least 3 timeline events.
    `,
    });

    // Stream the response to the client
    const response = result.toTextStreamResponse();

    // Save final object to storage after streaming starts
    result.object.then(async (finalObject) => {
      await storage.put(blobPath, finalObject);
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
