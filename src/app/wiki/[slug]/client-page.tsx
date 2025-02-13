"use client";

import { experimental_useObject as useObject } from "ai/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { z } from "zod";

const schema = z.object({
  events: z.object({
    items: z.array(
      z.object({
        date: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    ),
  }),
});

interface WikiData {
  extract: string;
  title: string;
}

async function getWikiData(name: string) {
  // First, try to get an exact match
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(name)}&origin=*`;

  try {
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.query?.search?.length) {
      return null;
    }

    // Take the first result as it's usually the most relevant
    const searchResult = searchData.query.search[0];

    // Get the full page content
    const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${encodeURIComponent(searchResult.title)}&origin=*`;
    const response = await fetch(pageUrl);
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pageId === "-1") {
      return null;
    }

    const page = pages[pageId];

    return {
      extract: page.extract,
      title: page.title,
    };
  } catch (error) {
    console.error("Error fetching Wikipedia data:", error);
    return null;
  }
}

export default function ClientPage({ slug }: { slug: string }) {
  const [wikiData, setWikiData] = useState<WikiData | null>(null);
  const [hasRequested, setHasRequested] = useState(false);

  const {
    object: eventData,
    isLoading,
    error,
    submit,
  } = useObject({
    api: "/api/lineage",
    schema: schema,
  });

  // Show either partial or final data
  const events = eventData?.events?.items;

  // Only submit once and only if we have Wikipedia data
  useEffect(() => {
    if (!hasRequested && wikiData) {
      submit({ prompt: wikiData.title });
      setHasRequested(true);
    }
  }, [submit, hasRequested, wikiData]);

  // Load Wikipedia data
  useEffect(() => {
    async function loadWikiData() {
      const name = decodeURIComponent(slug)
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      const data = await getWikiData(name);
      if (data) {
        setWikiData(data);
      }
    }
    loadWikiData();
  }, [slug]);

  // Debug logs
  useEffect(() => {
    console.log("📊 Current state:", {
      hasWikiData: !!wikiData,
      hasEvents: !!eventData,
      isLoading,
      error,
    });
  }, [wikiData, eventData, isLoading, error]);

  if (!wikiData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center text-lg hover:text-blue-500 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Search
          </Link>
        </nav>
        <div>No Wikipedia information found.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Add navigation header */}
      <nav className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center text-lg hover:text-blue-500 transition-colors"
        >
          <span className="mr-2">←</span>
          Back to Search
        </Link>
      </nav>

      <h1 className="text-4xl font-mono mb-8">{wikiData.title}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left side: Events */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Timeline</h2>
          {isLoading && (
            <div>Generating events... (this may take a minute)</div>
          )}
          {error && <div>Error: {error.message}</div>}
          <div className="space-y-4">
            {events?.map((event, i) => (
              <div
                key={i}
                className="p-4 border-l-4 border-blue-300 rounded-lg 
                                         bg-white dark:bg-gray-800 shadow-sm 
                                         hover:shadow-md transition-all duration-200"
              >
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {event?.date}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {event?.title}
                </h3>
                <p className="mt-2 text-gray-700 dark:text-gray-300">
                  {event?.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Wikipedia Content */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Description</h2>
          <div
            className="prose lg:prose-xl dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: wikiData.extract }}
          />
        </div>
      </div>
    </div>
  );
}
