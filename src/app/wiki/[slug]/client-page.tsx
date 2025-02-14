"use client";

import { experimental_useObject as useObject } from "ai/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { z } from "zod";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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

const hasVisited = (slug: string) => {
  try {
    const visits = JSON.parse(localStorage.getItem("visits") || "{}");
    return !!visits[slug];
  } catch {
    return false;
  }
};

const markVisited = (slug: string) => {
  try {
    const visits = JSON.parse(localStorage.getItem("visits") || "{}");
    visits[slug] = Date.now();
    localStorage.setItem("visits", JSON.stringify(visits));
  } catch (e) {
    console.error("Failed to mark visit:", e);
  }
};

export default function ClientPage({ slug }: { slug: string }) {
  const [wikiData, setWikiData] = useState<WikiData | null>(null);
  const [hasRequested, setHasRequested] = useState(false);
  const [isWikiLoading, setIsWikiLoading] = useState(true);

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
      submit({
        prompt: wikiData.title,
        wikiContent: wikiData.extract,
      });
      setHasRequested(true);
    }
  }, [submit, hasRequested, wikiData]);

  // Load Wikipedia data
  useEffect(() => {
    async function loadWikiData() {
      setIsWikiLoading(true);
      const name = decodeURIComponent(slug)
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      const data = await getWikiData(name);
      if (data) {
        setWikiData(data);
      }
      setIsWikiLoading(false);
    }
    loadWikiData();
  }, [slug]);

  // Track visit when Wikipedia data is loaded
  useEffect(() => {
    if (wikiData && !hasVisited(slug)) {
      console.log("🚀 Attempting to track visit for:", slug);
      fetch("/api/track-visit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          title: wikiData.title,
        }),
      })
        .then(async (response) => {
          const data = await response.json();
          console.log("✅ Track visit response:", data);
          if (data.success) {
            markVisited(slug);
          }
        })
        .catch((error) => {
          console.error("❌ Failed to track visit:", error);
        });
    }
  }, [slug, wikiData]);

  // Debug logs
  useEffect(() => {
    console.log("📊 Current state:", {
      hasWikiData: !!wikiData,
      hasEvents: !!eventData,
      isLoading,
      error,
    });
  }, [wikiData, eventData, isLoading, error]);

  if (isWikiLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-white">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center text-lg text-gray-900 dark:text-white hover:text-blue-500 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Search
          </Link>
        </nav>
        <div className="flex items-center space-x-3">
          <LoadingSpinner />
          <span>Searching Wikipedia...</span>
        </div>
      </div>
    );
  }

  if (!wikiData) {
    return (
      <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-white">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center text-lg text-gray-900 dark:text-white hover:text-blue-500 transition-colors"
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
    <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-white">
      <nav className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center text-lg text-gray-900 dark:text-white hover:text-blue-500 transition-colors"
        >
          <span className="mr-2">←</span>
          Back to Search
        </Link>
      </nav>

      <h1 className="text-4xl font-mono mb-8 text-gray-900 dark:text-white">
        {wikiData.title}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left side: Events */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Timeline
          </h2>
          {isLoading && (
            <div className="flex items-center space-x-3 text-gray-900 dark:text-white">
              <LoadingSpinner />
              <span>Generating timeline... (this may take a minute)</span>
            </div>
          )}
          {error && (
            <div className="text-red-600 dark:text-red-400">
              Error: {error.message}
            </div>
          )}
          {!isLoading && !error && (!events || events.length === 0) && (
            <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
              <p className="text-gray-700 dark:text-gray-300">
                No timeline events could be generated from the available
                information. This might be because:
              </p>
              <ul className="list-disc ml-6 mt-2 text-gray-600 dark:text-gray-400">
                <li>
                  The Wikipedia excerpt doesn&apos;t contain enough
                  chronological information
                </li>
                <li>
                  The subject matter might not have a clear timeline of events
                </li>
              </ul>
              <p className="mt-2 text-gray-700 dark:text-gray-300">
                You can still read the Wikipedia description on the right.
              </p>
            </div>
          )}
          <div className="space-y-4">
            {events?.map((event, i) => (
              <div
                key={i}
                className="p-4 border-l-4 border-blue-300 rounded-lg 
                         bg-white dark:bg-gray-800 shadow-sm 
                         hover:shadow-md transition-all duration-200"
              >
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {event?.date}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {event?.title}
                </h3>
                <p className="mt-2 text-gray-800 dark:text-gray-200">
                  {event?.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Wikipedia Content */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Description
          </h2>
          <div
            className="prose lg:prose-xl max-w-none
                     prose-headings:text-gray-900 prose-headings:dark:text-white
                     prose-p:text-gray-800 prose-p:dark:text-gray-200
                     prose-a:text-blue-600 prose-a:dark:text-blue-400"
            dangerouslySetInnerHTML={{ __html: wikiData.extract }}
          />
        </div>
      </div>
    </div>
  );
}
